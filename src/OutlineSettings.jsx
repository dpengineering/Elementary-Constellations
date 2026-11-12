import { useMemo, useState } from "react";
import { parseOutline, layoutWarnings } from "./outline.js";
import { BOX_OUTLINE_PATH } from "./boxOutline.js";

// Modal for loading a custom cut outline (SVG or DXF) into this browser,
// or resetting back to the built-in default outline.
export function OutlineSettings({
  customOutline,
  viewWidth,
  viewHeight,
  drawingArea,
  onApply,
  onReset,
  onClose,
}) {
  const [file, setFile] = useState(null); // {name, text}
  const [units, setUnits] = useState(""); // "" = auto (DXF $INSUNITS, else mm)
  const [readError, setReadError] = useState(null);

  const isDxf = file?.name.toLowerCase().endsWith(".dxf");

  const result = useMemo(() => {
    if (!file) return null;
    const layout = { viewWidth, viewHeight, drawingArea };
    try {
      const outline = parseOutline(file.text, file.name, {
        units: units || undefined,
        viewWidth,
        viewHeight,
      });
      return {
        outline,
        warnings: [...outline.warnings, ...layoutWarnings(outline, layout)],
      };
    } catch (e) {
      return { error: e.message };
    }
  }, [file, units, viewWidth, viewHeight, drawingArea]);

  const onFileChange = (e) => {
    const f = e.target.files?.[0];
    setReadError(null);
    setFile(null);
    if (!f) return;
    f.text().then(
      (text) => setFile({ name: f.name, text }),
      () => setReadError("Couldn't read that file.")
    );
  };

  const apply = () => {
    const { d, widthIn, heightIn } = result.outline;
    onApply({ d, widthIn, heightIn, name: file.name, warnings: result.warnings });
  };

  const error = readError || result?.error;
  const previewPath = result?.outline?.d;

  return (
    <div className="modalBackdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Cut outline</h2>

        <p className="outlineStatus">
          Currently using:{" "}
          {customOutline ? (
            <strong>
              custom outline from {customOutline.name} (
              {customOutline.widthIn.toFixed(2)} × {customOutline.heightIn.toFixed(2)} in)
            </strong>
          ) : (
            <strong>default outline</strong>
          )}
        </p>

        <label className="outlineRow">
          Load an SVG or DXF:
          <input type="file" accept=".svg,.dxf" onChange={onFileChange} />
        </label>

        {isDxf && (
          <label className="outlineRow">
            DXF units:
            <select value={units} onChange={(e) => setUnits(e.target.value)}>
              <option value="">Auto (from file, else mm)</option>
              <option value="mm">Millimeters</option>
              <option value="cm">Centimeters</option>
              <option value="in">Inches</option>
            </select>
          </label>
        )}

        <svg
          className="outlinePreview"
          xmlns="http://www.w3.org/2000/svg"
          viewBox={`0 0 ${viewWidth} ${viewHeight}`}
        >
          <rect
            x={drawingArea.x}
            y={drawingArea.y}
            width={drawingArea.width}
            height={drawingArea.height}
            fill="none"
            stroke="gray"
            strokeWidth={0.015}
            strokeDasharray="0.06 0.04"
          />
          {/* the outline in use now, faint, for comparison */}
          <path
            d={customOutline?.d ?? BOX_OUTLINE_PATH}
            fill="none"
            stroke="#bbb"
            strokeWidth={0.015}
          />
          {previewPath && (
            <path d={previewPath} fill="none" stroke="blue" strokeWidth={0.02} />
          )}
        </svg>
        <p className="outlineLegend">
          <span style={{ color: "blue" }}>Blue</span>: new outline ·{" "}
          <span style={{ color: "#999" }}>gray</span>: current outline · dashed:
          drawing/star area
        </p>

        {result?.outline && (
          <p>
            Size: {result.outline.widthIn.toFixed(2)} ×{" "}
            {result.outline.heightIn.toFixed(2)} in (
            {(result.outline.widthIn * 25.4).toFixed(1)} ×{" "}
            {(result.outline.heightIn * 25.4).toFixed(1)} mm)
          </p>
        )}
        {error && <p className="outlineError">{error}</p>}
        {result?.warnings?.map((w) => (
          <p key={w} className="outlineWarning">
            ⚠ {w}
          </p>
        ))}

        <p className="outlineNote">
          A custom outline is saved in this browser only. Other devices keep using
          the default.
        </p>

        <div className="modalButtons">
          <button disabled={!customOutline} onClick={onReset}>
            Reset to default
          </button>
          <span className="spacer" />
          <button onClick={onClose}>Cancel</button>
          <button disabled={!result?.outline} onClick={apply}>
            Use this outline
          </button>
        </div>
      </div>
    </div>
  );
}
