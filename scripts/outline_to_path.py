#!/usr/bin/env python3
"""Convert a cut-outline template (DXF or SVG) into src/boxOutline.js.

The generated module exports an SVG path string in inches, centered inside the
app's WIDTH x HEIGHT viewBox, which the Box component in src/App.jsx draws.

Usage:
    python3 scripts/outline_to_path.py acrylic_template.svg
    python3 scripts/outline_to_path.py new_template.dxf --units mm

Supported input:
  DXF: LWPOLYLINE (incl. bulge arcs), POLYLINE/VERTEX, LINE, ARC, CIRCLE in the
       ENTITIES section. Units come from $INSUNITS, else --units (default mm).
  SVG: <path> elements using M/L/H/V/A/Z commands (absolute or relative), with
       an optional transform="matrix(...)" or translate/scale. Units come from
       the root width attribute + viewBox (e.g. width="181mm").
Curves (C/Q/S/T) are not supported; convert them to lines/arcs in CAD first.
"""

import argparse
import math
import re
import sys
from pathlib import Path

# Must match WIDTH / HEIGHT in src/App.jsx (inches).
VIEW_WIDTH = 7.3
VIEW_HEIGHT = 5.0

INCHES_PER_UNIT = {
    "in": 1.0,
    "mm": 1 / 25.4,
    "cm": 1 / 2.54,
    "pt": 1 / 72,
    "pc": 1 / 6,
    "px": 1 / 96,
    "": 1 / 96,
}

# DXF $INSUNITS codes -> unit names
DXF_INSUNITS = {1: "in", 4: "mm", 5: "cm"}


# ---------------------------------------------------------------------------
# Geometry model: a list of subpaths; each subpath is a list of segments:
#   ("M", x, y) | ("L", x, y) | ("A", rx, ry, rot, large, sweep, x, y) | ("Z",)
# Coordinates are in source units with Y pointing DOWN (SVG convention).
# ---------------------------------------------------------------------------


def arc_bbox_points(cx, cy, r, a0, a1, ccw):
    """Sample points along a circular arc for bounding-box purposes."""
    span = (a1 - a0) % (2 * math.pi) if ccw else -((a0 - a1) % (2 * math.pi))
    if span == 0:
        span = 2 * math.pi if ccw else -2 * math.pi
    n = 64
    return [
        (cx + r * math.cos(a0 + span * i / n), cy + r * math.sin(a0 + span * i / n))
        for i in range(n + 1)
    ]


# ------------------------------- DXF ---------------------------------------


def read_dxf_pairs(text):
    lines = text.splitlines()
    for i in range(0, len(lines) - 1, 2):
        yield int(lines[i].strip()), lines[i + 1].strip()


def parse_dxf(text):
    pairs = list(read_dxf_pairs(text))

    units = None
    for i, (code, val) in enumerate(pairs):
        if code == 9 and val == "$INSUNITS" and i + 1 < len(pairs):
            units = DXF_INSUNITS.get(int(pairs[i + 1][1]))
            break

    # Split ENTITIES section into entities: (type, [(code, value), ...])
    entities = []
    in_entities = False
    current = None
    for i, (code, val) in enumerate(pairs):
        if code == 2 and i > 0 and pairs[i - 1] == (0, "SECTION"):
            in_entities = val == "ENTITIES"
            continue
        if not in_entities:
            continue
        if code == 0:
            if current:
                entities.append(current)
            current = (val, []) if val != "ENDSEC" else None
            if val == "ENDSEC":
                in_entities = False
        elif current:
            current[1].append((code, val))
    if current:
        entities.append(current)

    subpaths = []  # in DXF coords (Y up); flipped later
    extra_pts = []  # bbox points for arcs

    def polyline(verts, closed):
        # verts: list of (x, y, bulge)
        if len(verts) < 2:
            return
        sp = [("M", verts[0][0], verts[0][1])]
        n = len(verts)
        for k in range(n if closed else n - 1):
            x0, y0, b = verts[k]
            x1, y1, _ = verts[(k + 1) % n]
            if abs(b) < 1e-12:
                sp.append(("L", x1, y1))
            else:
                chord = math.hypot(x1 - x0, y1 - y0)
                r = chord * (1 + b * b) / (4 * abs(b))
                theta = 4 * math.atan(b)  # signed included angle, CCW positive
                # arc center: offset from chord midpoint along the left normal;
                # the sign of tan(theta/2) handles direction and major arcs.
                mx, my = (x0 + x1) / 2, (y0 + y1) / 2
                h = (chord / 2) / math.tan(theta / 2)
                nx, ny = -(y1 - y0) / chord, (x1 - x0) / chord
                cx, cy = mx + nx * h, my + ny * h
                a0 = math.atan2(y0 - cy, x0 - cx)
                a1 = math.atan2(y1 - cy, x1 - cx)
                extra_pts.extend(arc_bbox_points(cx, cy, r, a0, a1, b > 0))
                sp.append(("A", r, r, 0, int(abs(b) > 1), int(b > 0), x1, y1))
        if closed:
            sp.append(("Z",))
        subpaths.append(sp)

    i = 0
    while i < len(entities):
        etype, data = entities[i]
        get = lambda c, d=0.0: next((float(v) for k, v in data if k == c), d)  # noqa: E731
        if etype == "LWPOLYLINE":
            verts = []
            for code, val in data:
                if code == 10:
                    verts.append([float(val), 0.0, 0.0])
                elif code == 20:
                    verts[-1][1] = float(val)
                elif code == 42:
                    verts[-1][2] = float(val)
            polyline([tuple(v) for v in verts], int(get(70)) & 1)
        elif etype == "POLYLINE":
            closed = int(get(70)) & 1
            verts = []
            i += 1
            while i < len(entities) and entities[i][0] == "VERTEX":
                vd = entities[i][1]
                vget = lambda c, d=0.0: next((float(v) for k, v in vd if k == c), d)  # noqa: E731
                verts.append((vget(10), vget(20), vget(42)))
                i += 1
            polyline(verts, closed)
            continue  # entities[i] is SEQEND (or next entity); don't skip it blindly
        elif etype == "LINE":
            subpaths.append([("M", get(10), get(20)), ("L", get(11), get(21))])
        elif etype in ("ARC", "CIRCLE"):
            cx, cy, r = get(10), get(20), get(40)
            if etype == "CIRCLE":
                subpaths.append([
                    ("M", cx + r, cy),
                    ("A", r, r, 0, 0, 1, cx - r, cy),
                    ("A", r, r, 0, 0, 1, cx + r, cy),
                    ("Z",),
                ])
                extra_pts.extend([(cx - r, cy - r), (cx + r, cy + r)])
            else:
                a0, a1 = math.radians(get(50)), math.radians(get(51))
                span = (a1 - a0) % (2 * math.pi)
                subpaths.append([
                    ("M", cx + r * math.cos(a0), cy + r * math.sin(a0)),
                    ("A", r, r, 0, int(span > math.pi), 1,
                     cx + r * math.cos(a1), cy + r * math.sin(a1)),
                ])
                extra_pts.extend(arc_bbox_points(cx, cy, r, a0, a1, True))
        elif etype not in ("SEQEND", "VERTEX"):
            print(f"warning: ignoring DXF entity {etype}", file=sys.stderr)
        i += 1

    # Flip Y (DXF is Y-up, SVG is Y-down). Flipping mirrors arc direction.
    def flip(seg):
        if seg[0] in ("M", "L"):
            return (seg[0], seg[1], -seg[2])
        if seg[0] == "A":
            rx, ry, rot, large, sweep, x, y = seg[1:]
            return ("A", rx, ry, -rot, large, 1 - sweep, x, -y)
        return seg

    subpaths = [[flip(s) for s in sp] for sp in subpaths]
    extra_pts = [(x, -y) for x, y in extra_pts]
    return subpaths, extra_pts, units


# ------------------------------- SVG ---------------------------------------


def parse_transform(t):
    """Return affine (a, b, c, d, e, f) for a transform attribute."""
    m = (1, 0, 0, 1, 0, 0)

    def mul(p, q):
        a1, b1, c1, d1, e1, f1 = p
        a2, b2, c2, d2, e2, f2 = q
        return (a1 * a2 + c1 * b2, b1 * a2 + d1 * b2,
                a1 * c2 + c1 * d2, b1 * c2 + d1 * d2,
                a1 * e2 + c1 * f2 + e1, b1 * e2 + d1 * f2 + f1)

    for name, args in re.findall(r"(\w+)\s*\(([^)]*)\)", t or ""):
        v = [float(x) for x in re.findall(r"[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?", args)]
        if name == "matrix":
            q = tuple(v)
        elif name == "translate":
            q = (1, 0, 0, 1, v[0], v[1] if len(v) > 1 else 0)
        elif name == "scale":
            q = (v[0], 0, 0, v[1] if len(v) > 1 else v[0], 0, 0)
        else:
            sys.exit(f"error: unsupported SVG transform '{name}'")
        m = mul(m, q)
    return m


def parse_svg_path(d, tf):
    tokens = re.findall(r"[MmLlHhVvAaZzCcSsQqTt]|[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?", d)
    a, b, c, dd, e, f = tf
    det = a * dd - b * c
    rscale = math.sqrt(abs(det))
    T = lambda x, y: (a * x + c * y + e, b * x + dd * y + f)  # noqa: E731

    subpaths, sp = [], None
    x = y = sx = sy = 0.0
    i, cmd = 0, None
    while i < len(tokens):
        if re.match(r"[A-Za-z]", tokens[i]):
            cmd = tokens[i]
            i += 1
            if cmd in "Zz":
                sp.append(("Z",))
                x, y = sx, sy
                continue
        if cmd is None or cmd in "CcSsQqTt":
            sys.exit(f"error: unsupported SVG path command '{cmd}' (curves not supported)")
        rel = cmd.islower()
        C = cmd.upper()
        num = lambda k: float(tokens[i + k])  # noqa: E731
        if C in "ML":
            nx, ny = num(0), num(1)
            i += 2
            if rel:
                nx, ny = x + nx, y + ny
            if C == "M":
                sp = []
                subpaths.append(sp)
                sx, sy = nx, ny
                sp.append(("M", *T(nx, ny)))
                cmd = "l" if rel else "L"  # implicit lineto after moveto
            else:
                sp.append(("L", *T(nx, ny)))
            x, y = nx, ny
        elif C == "H":
            x = x + num(0) if rel else num(0)
            i += 1
            sp.append(("L", *T(x, y)))
        elif C == "V":
            y = y + num(0) if rel else num(0)
            i += 1
            sp.append(("L", *T(x, y)))
        elif C == "A":
            rx, ry, rot, large, sweep, nx, ny = (num(k) for k in range(7))
            i += 7
            if rel:
                nx, ny = x + nx, y + ny
            sp.append(("A", rx * rscale, ry * rscale, rot, int(large),
                       int(sweep) if det > 0 else 1 - int(sweep), *T(nx, ny)))
            x, y = nx, ny
    return subpaths


def parse_svg(text):
    root = re.search(r"<svg\b[^>]*>", text, re.S).group(0)
    attr = lambda tag, n: (re.search(rf'\b{n}\s*=\s*"([^"]*)"', tag) or [None, None])[1]  # noqa: E731

    # Work out source-unit -> inch scale from width + viewBox.
    units_scale = INCHES_PER_UNIT[""]
    width, vb = attr(root, "width"), attr(root, "viewBox")
    if width:
        m = re.match(r"([\d.]+)\s*([a-z]*)", width)
        w_inches = float(m.group(1)) * INCHES_PER_UNIT[m.group(2)]
        vb_w = float(vb.split()[2]) if vb else float(m.group(1))
        units_scale = w_inches / vb_w

    subpaths = []
    for tag in re.findall(r"<path\b[^>]*>", text, re.S):
        subpaths += parse_svg_path(attr(tag, "d"), parse_transform(attr(tag, "transform")))
    return subpaths, [], units_scale


# ------------------------------- output ------------------------------------


def fmt(v):
    s = f"{v:.4f}".rstrip("0").rstrip(".")
    return "0" if s in ("-0", "") else s


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("input", type=Path)
    ap.add_argument("--units", choices=["mm", "cm", "in"], help="DXF units if $INSUNITS is missing (default mm)")
    ap.add_argument("-o", "--output", type=Path,
                    default=Path(__file__).resolve().parent.parent / "src" / "boxOutline.js")
    args = ap.parse_args()

    text = args.input.read_text()
    if args.input.suffix.lower() == ".dxf":
        subpaths, extra, units = parse_dxf(text)
        scale = INCHES_PER_UNIT[args.units or units or "mm"]
    elif args.input.suffix.lower() == ".svg":
        subpaths, extra, scale = parse_svg(text)
    else:
        sys.exit("error: input must be a .dxf or .svg file")

    if not subpaths:
        sys.exit("error: no outline geometry found")

    pts = [(s[-2], s[-1]) for sp in subpaths for s in sp if s[0] != "Z"] + extra
    min_x, max_x = min(p[0] for p in pts), max(p[0] for p in pts)
    min_y, max_y = min(p[1] for p in pts), max(p[1] for p in pts)
    w_in, h_in = (max_x - min_x) * scale, (max_y - min_y) * scale
    if w_in > VIEW_WIDTH or h_in > VIEW_HEIGHT:
        print(f"warning: outline {w_in:.3f}x{h_in:.3f}in is larger than the "
              f"{VIEW_WIDTH}x{VIEW_HEIGHT}in view; update WIDTH/HEIGHT in App.jsx", file=sys.stderr)

    # Center the outline in the view.
    off_x = (VIEW_WIDTH - w_in) / 2
    off_y = (VIEW_HEIGHT - h_in) / 2
    X = lambda v: fmt((v - min_x) * scale + off_x)  # noqa: E731
    Y = lambda v: fmt((v - min_y) * scale + off_y)  # noqa: E731

    parts = []
    for sp in subpaths:
        for s in sp:
            if s[0] in ("M", "L"):
                parts.append(f"{s[0]}{X(s[1])} {Y(s[2])}")
            elif s[0] == "A":
                rx, ry, rot, large, sweep, x, y = s[1:]
                parts.append(f"A{fmt(rx * scale)} {fmt(ry * scale)} {fmt(rot)} {large} {sweep} {X(x)} {Y(y)}")
            else:
                parts.append("Z")
    d = "".join(parts)

    args.output.write_text(
        f"// Generated by scripts/outline_to_path.py from {args.input.name}. Do not edit by hand;\n"
        f"// re-run: python3 scripts/outline_to_path.py <template.dxf|svg>\n"
        f"// Outline size: {w_in:.3f} x {h_in:.3f} in, centered in the {VIEW_WIDTH} x {VIEW_HEIGHT} in view.\n"
        f'export const BOX_OUTLINE_PATH =\n  "{d}";\n'
    )
    print(f"wrote {args.output} ({w_in:.3f} x {h_in:.3f} in)")


if __name__ == "__main__":
    main()
