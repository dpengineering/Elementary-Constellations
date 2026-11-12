// Converts a cut-outline template (DXF or SVG) into an SVG path in inches,
// centered in the app's view. Used both in the browser (outline settings
// panel) and by scripts/outline-to-path.mjs (to regenerate src/boxOutline.js).
//
// Supported input:
//   DXF: LWPOLYLINE (incl. bulge arcs), POLYLINE/VERTEX, LINE, ARC, CIRCLE in
//        the ENTITIES section. Units from $INSUNITS, else options.units (mm).
//   SVG: <path> elements using M/L/H/V/A/Z (absolute or relative) with an
//        optional matrix/translate/scale transform. Units from the root
//        width attribute + viewBox (e.g. width="181mm").
// Curves (splines, C/Q/S/T) are not supported.
//
// Geometry model: a list of subpaths; each subpath is a list of segments
//   ["M", x, y] | ["L", x, y] | ["A", rx, ry, rot, large, sweep, x, y] | ["Z"]
// with Y pointing down (SVG convention), in source units.

export const INCHES_PER_UNIT = {
  in: 1,
  mm: 1 / 25.4,
  cm: 1 / 2.54,
  pt: 1 / 72,
  pc: 1 / 6,
  px: 1 / 96,
  "": 1 / 96,
};

const DXF_INSUNITS = { 1: "in", 4: "mm", 5: "cm" };
const NUMBER_RE = /[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?/g;
const TWO_PI = 2 * Math.PI;

const mod = (a, m) => ((a % m) + m) % m;

// ------------------------------- DXF ---------------------------------------

function parseDxf(text) {
  const lines = text.split(/\r?\n/);
  const pairs = [];
  for (let i = 0; i + 1 < lines.length; i += 2) {
    const code = parseInt(lines[i].trim(), 10);
    if (Number.isNaN(code)) throw new Error("This doesn't look like a valid DXF file.");
    pairs.push([code, lines[i + 1].trim()]);
  }

  let units = null;
  for (let i = 0; i + 1 < pairs.length; i++) {
    if (pairs[i][0] === 9 && pairs[i][1] === "$INSUNITS") {
      units = DXF_INSUNITS[parseInt(pairs[i + 1][1], 10)] || null;
      break;
    }
  }

  // Split the ENTITIES section into [type, [[code, value], ...]].
  const entities = [];
  let inEntities = false;
  let current = null;
  for (let i = 0; i < pairs.length; i++) {
    const [code, val] = pairs[i];
    if (code === 2 && i > 0 && pairs[i - 1][0] === 0 && pairs[i - 1][1] === "SECTION") {
      inEntities = val === "ENTITIES";
      continue;
    }
    if (!inEntities) continue;
    if (code === 0) {
      if (current) entities.push(current);
      current = val === "ENDSEC" ? null : [val, []];
      if (val === "ENDSEC") inEntities = false;
    } else if (current) {
      current[1].push([code, val]);
    }
  }
  if (current) entities.push(current);

  const subpaths = []; // DXF coords (Y up); flipped at the end
  const ignored = new Set();

  const getter = (data) => (c, d = 0) => {
    const hit = data.find(([k]) => k === c);
    return hit ? parseFloat(hit[1]) : d;
  };

  function polyline(verts, closed) {
    if (verts.length < 2) return;
    const sp = [["M", verts[0][0], verts[0][1]]];
    const n = verts.length;
    for (let k = 0; k < (closed ? n : n - 1); k++) {
      const [x0, y0, b] = verts[k];
      const [x1, y1] = verts[(k + 1) % n];
      if (Math.abs(b) < 1e-12) {
        sp.push(["L", x1, y1]);
      } else {
        // Bulge b = tan(includedAngle / 4); positive means counter-clockwise.
        const chord = Math.hypot(x1 - x0, y1 - y0);
        const r = (chord * (1 + b * b)) / (4 * Math.abs(b));
        sp.push(["A", r, r, 0, Math.abs(b) > 1 ? 1 : 0, b > 0 ? 1 : 0, x1, y1]);
      }
    }
    if (closed) sp.push(["Z"]);
    subpaths.push(sp);
  }

  for (let i = 0; i < entities.length; i++) {
    const [type, data] = entities[i];
    const get = getter(data);
    if (type === "LWPOLYLINE") {
      const verts = [];
      for (const [code, val] of data) {
        if (code === 10) verts.push([parseFloat(val), 0, 0]);
        else if (code === 20 && verts.length) verts[verts.length - 1][1] = parseFloat(val);
        else if (code === 42 && verts.length) verts[verts.length - 1][2] = parseFloat(val);
      }
      polyline(verts, get(70) & 1);
    } else if (type === "POLYLINE") {
      const closed = get(70) & 1;
      const verts = [];
      while (i + 1 < entities.length && entities[i + 1][0] === "VERTEX") {
        const vget = getter(entities[++i][1]);
        verts.push([vget(10), vget(20), vget(42)]);
      }
      polyline(verts, closed);
    } else if (type === "LINE") {
      subpaths.push([["M", get(10), get(20)], ["L", get(11), get(21)]]);
    } else if (type === "CIRCLE") {
      const [cx, cy, r] = [get(10), get(20), get(40)];
      subpaths.push([
        ["M", cx + r, cy],
        ["A", r, r, 0, 0, 1, cx - r, cy],
        ["A", r, r, 0, 0, 1, cx + r, cy],
        ["Z"],
      ]);
    } else if (type === "ARC") {
      const [cx, cy, r] = [get(10), get(20), get(40)];
      const a0 = (get(50) * Math.PI) / 180;
      const a1 = (get(51) * Math.PI) / 180;
      subpaths.push([
        ["M", cx + r * Math.cos(a0), cy + r * Math.sin(a0)],
        ["A", r, r, 0, mod(a1 - a0, TWO_PI) > Math.PI ? 1 : 0, 1,
          cx + r * Math.cos(a1), cy + r * Math.sin(a1)],
      ]);
    } else if (type !== "SEQEND" && type !== "VERTEX") {
      ignored.add(type);
    }
  }

  // Flip Y (DXF is Y-up, SVG is Y-down). Flipping mirrors arc direction.
  const flip = (s) => {
    if (s[0] === "M" || s[0] === "L") return [s[0], s[1], -s[2]];
    if (s[0] === "A") {
      const [, rx, ry, rot, large, sweep, x, y] = s;
      return ["A", rx, ry, -rot, large, 1 - sweep, x, -y];
    }
    return s;
  };

  const warnings = [];
  if (ignored.size) {
    warnings.push(`Ignored unsupported DXF shapes: ${[...ignored].join(", ")}.`);
  }
  return { subpaths: subpaths.map((sp) => sp.map(flip)), units, warnings };
}

// ------------------------------- SVG ---------------------------------------

function attr(tag, name) {
  const m = tag.match(new RegExp(`\\s${name}\\s*=\\s*["']([^"']*)["']`));
  return m ? m[1] : null;
}

function parseTransform(t) {
  const mul = ([a1, b1, c1, d1, e1, f1], [a2, b2, c2, d2, e2, f2]) => [
    a1 * a2 + c1 * b2, b1 * a2 + d1 * b2,
    a1 * c2 + c1 * d2, b1 * c2 + d1 * d2,
    a1 * e2 + c1 * f2 + e1, b1 * e2 + d1 * f2 + f1,
  ];
  let m = [1, 0, 0, 1, 0, 0];
  for (const [, name, args] of (t || "").matchAll(/(\w+)\s*\(([^)]*)\)/g)) {
    const v = (args.match(NUMBER_RE) || []).map(Number);
    let q;
    if (name === "matrix") q = v;
    else if (name === "translate") q = [1, 0, 0, 1, v[0], v[1] ?? 0];
    else if (name === "scale") q = [v[0], 0, 0, v[1] ?? v[0], 0, 0];
    else throw new Error(`Unsupported SVG transform "${name}".`);
    m = mul(m, q);
  }
  return m;
}

function parseSvgPath(d, [a, b, c, dd, e, f]) {
  const tokens = d.match(/[A-Za-z]|[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?/g) || [];
  const det = a * dd - b * c;
  const rScale = Math.sqrt(Math.abs(det));
  const T = (x, y) => [a * x + c * y + e, b * x + dd * y + f];

  const subpaths = [];
  let sp = null;
  let x = 0, y = 0, sx = 0, sy = 0;
  let i = 0, cmd = null;
  const num = (k) => {
    const v = parseFloat(tokens[i + k]);
    if (Number.isNaN(v)) throw new Error("Malformed SVG path data.");
    return v;
  };
  while (i < tokens.length) {
    if (/[A-Za-z]/.test(tokens[i])) {
      cmd = tokens[i++];
      if (cmd === "Z" || cmd === "z") {
        sp?.push(["Z"]);
        x = sx;
        y = sy;
        continue;
      }
    }
    if (!cmd || /[CcSsQqTt]/.test(cmd)) {
      throw new Error(
        `This SVG uses curves (path command "${cmd}"), which aren't supported. ` +
          "Convert curves to lines or arcs in your CAD tool first."
      );
    }
    if (!/[MmLlHhVvAa]/.test(cmd)) throw new Error(`Unsupported SVG path command "${cmd}".`);
    if (!sp && cmd.toUpperCase() !== "M") throw new Error("Malformed SVG path data.");
    const rel = cmd === cmd.toLowerCase();
    const C = cmd.toUpperCase();
    if (C === "M" || C === "L") {
      let nx = num(0), ny = num(1);
      i += 2;
      if (rel) { nx += x; ny += y; }
      if (C === "M") {
        sp = [["M", ...T(nx, ny)]];
        subpaths.push(sp);
        sx = nx;
        sy = ny;
        cmd = rel ? "l" : "L"; // implicit lineto after moveto
      } else {
        sp.push(["L", ...T(nx, ny)]);
      }
      x = nx;
      y = ny;
    } else if (C === "H") {
      x = rel ? x + num(0) : num(0);
      i += 1;
      sp.push(["L", ...T(x, y)]);
    } else if (C === "V") {
      y = rel ? y + num(0) : num(0);
      i += 1;
      sp.push(["L", ...T(x, y)]);
    } else {
      const [rx, ry, rot, large, sweep] = [0, 1, 2, 3, 4].map(num);
      let nx = num(5), ny = num(6);
      i += 7;
      if (rel) { nx += x; ny += y; }
      // A mirroring transform (negative determinant) reverses arc direction.
      const s = sweep ? 1 : 0;
      sp.push(["A", rx * rScale, ry * rScale, rot, large ? 1 : 0, det > 0 ? s : 1 - s, ...T(nx, ny)]);
      x = nx;
      y = ny;
    }
  }
  return subpaths;
}

function parseSvg(text) {
  const root = text.match(/<svg\b[^>]*>/s);
  if (!root) throw new Error("This doesn't look like a valid SVG file.");

  // Source-unit -> inch scale from the root width + viewBox.
  let scale = INCHES_PER_UNIT[""];
  const width = attr(root[0], "width");
  const vb = attr(root[0], "viewBox");
  const wm = width && width.match(/^\s*([\d.]+)\s*([a-z]*)/);
  if (wm && wm[2] in INCHES_PER_UNIT) {
    const vbW = vb ? parseFloat(vb.trim().split(/[\s,]+/)[2]) : parseFloat(wm[1]);
    scale = (parseFloat(wm[1]) * INCHES_PER_UNIT[wm[2]]) / vbW;
  }

  const warnings = [];
  const subpaths = [];
  for (const [tag] of text.matchAll(/<path\b[^>]*>/gs)) {
    const d = attr(tag, "d");
    if (d) subpaths.push(...parseSvgPath(d, parseTransform(attr(tag, "transform"))));
  }
  if (/<(rect|polygon|polyline|line|circle|ellipse)\b/.test(text)) {
    warnings.push("Ignored non-<path> shapes in the SVG (rect, polygon, etc.).");
  }
  if (/<g\b[^>]*\stransform=/.test(text)) {
    warnings.push("Group transforms in the SVG were ignored; check the preview carefully.");
  }
  return { subpaths, scale, warnings };
}

// ----------------------------- sampling ------------------------------------

// Points along each segment, used for the bounding box and the overlap check.
// Arcs are treated as circular (average of rx/ry), which is all CAD exports use.
function samplePoints(subpaths) {
  const out = [];
  for (const sp of subpaths) {
    let prev = null, start = null;
    for (const s of sp) {
      if (s[0] === "Z") {
        if (prev && start) out.push(...sampleLine(prev, start));
        prev = start;
        continue;
      }
      const p = [s[s.length - 2], s[s.length - 1]];
      if (s[0] === "M") start = p;
      else if (s[0] === "L" && prev) out.push(...sampleLine(prev, p));
      else if (s[0] === "A" && prev) out.push(...sampleArc(prev, p, (s[1] + s[2]) / 2, s[4], s[5]));
      out.push(p);
      prev = p;
    }
  }
  return out;
}

function sampleLine([x0, y0], [x1, y1], n = 50) {
  const out = [];
  for (let i = 1; i < n; i++) out.push([x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n]);
  return out;
}

// SVG endpoint-form circular arc -> sampled points (sweep=1: increasing angle).
function sampleArc([x0, y0], [x1, y1], r, large, sweep, n = 32) {
  const dx = x1 - x0, dy = y1 - y0;
  const chord = Math.hypot(dx, dy);
  if (chord === 0) return [];
  r = Math.max(r, chord / 2);
  const h = Math.sqrt(Math.max(r * r - (chord / 2) ** 2, 0));
  const sign = large !== sweep ? 1 : -1;
  const cx = (x0 + x1) / 2 - (dy / chord) * h * sign;
  const cy = (y0 + y1) / 2 + (dx / chord) * h * sign;
  const a0 = Math.atan2(y0 - cy, x0 - cx);
  const a1 = Math.atan2(y1 - cy, x1 - cx);
  const span = sweep ? mod(a1 - a0, TWO_PI) : -mod(a0 - a1, TWO_PI);
  const out = [];
  for (let i = 1; i < n; i++) {
    const t = a0 + (span * i) / n;
    out.push([cx + r * Math.cos(t), cy + r * Math.sin(t)]);
  }
  return out;
}

// ------------------------------- public ------------------------------------

function fmt(v) {
  const s = v.toFixed(4).replace(/\.?0+$/, "");
  return s === "-0" || s === "" ? "0" : s;
}

/**
 * Parse an outline file and return it in inches, centered in the view.
 * @returns {{d: string, widthIn: number, heightIn: number,
 *            samples: number[][], warnings: string[]}}
 * Throws an Error with a user-facing message if the file can't be used.
 */
export function parseOutline(text, fileName, { units, viewWidth, viewHeight }) {
  const ext = fileName.toLowerCase().split(".").pop();
  let parsed, scale;
  if (ext === "dxf") {
    parsed = parseDxf(text);
    scale = INCHES_PER_UNIT[units || parsed.units || "mm"];
  } else if (ext === "svg") {
    parsed = parseSvg(text);
    scale = parsed.scale;
  } else {
    throw new Error("Please choose a .svg or .dxf file.");
  }
  const { subpaths, warnings } = parsed;
  if (!subpaths.length) throw new Error("No outline shapes were found in this file.");

  const raw = samplePoints(subpaths);
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const [x, y] of raw) {
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minY = Math.min(minY, y); maxY = Math.max(maxY, y);
  }
  const widthIn = (maxX - minX) * scale;
  const heightIn = (maxY - minY) * scale;
  if (!(widthIn > 0 && heightIn > 0)) throw new Error("The outline has no size.");

  // Center the outline in the view.
  const offX = (viewWidth - widthIn) / 2;
  const offY = (viewHeight - heightIn) / 2;
  const X = (v) => (v - minX) * scale + offX;
  const Y = (v) => (v - minY) * scale + offY;

  const parts = [];
  for (const sp of subpaths) {
    for (const s of sp) {
      if (s[0] === "Z") {
        parts.push("Z");
        continue;
      }
      const px = fmt(X(s[s.length - 2]));
      const py = fmt(Y(s[s.length - 1]));
      if (s[0] === "A") {
        const [, rx, ry, rot, large, sweep] = s;
        parts.push(`A${fmt(rx * scale)} ${fmt(ry * scale)} ${fmt(rot)} ${large} ${sweep} ${px} ${py}`);
      } else {
        parts.push(`${s[0]}${px} ${py}`);
      }
    }
  }
  return {
    d: parts.join(""),
    widthIn,
    heightIn,
    samples: raw.map(([x, y]) => [X(x), Y(y)]),
    warnings,
  };
}

/**
 * Warnings about how the outline fits the app's layout.
 * drawingArea: {x, y, width, height} in inches.
 */
export function layoutWarnings(outline, { viewWidth, viewHeight, drawingArea }) {
  const w = [];
  if (outline.widthIn > viewWidth + 1e-6 || outline.heightIn > viewHeight + 1e-6) {
    w.push(
      `The outline (${outline.widthIn.toFixed(2)} × ${outline.heightIn.toFixed(2)} in) is larger ` +
        `than the ${viewWidth} × ${viewHeight} in canvas, so parts of it will be cut off.`
    );
  }
  const { x, y, width, height } = drawingArea;
  const crosses = outline.samples.some(
    ([px, py]) => px > x && px < x + width && py > y && py < y + height
  );
  if (crosses) {
    w.push(
      "The outline crosses the drawing/star area (dashed box in the preview), " +
        "so drawings or stars may be cut through."
    );
  }
  return w;
}
