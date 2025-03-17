import {HEIGHT } from "./App";

export const GRID_UNIT = 0.2; // in inches
export const GRID_OFFSET_X = 0.55;
export const GRID_OFFSET_Y = 0.45;
const GRID_COLOR = "lightgray";
export const GRID_WIDTH = 32;
export const GRID_HEIGHT = 21;

const X_AXIS_COLOR = "blue";
const Y_AXIS_COLOR = "green";

export function gridXtoSVGX(x) {
  return GRID_OFFSET_X + x * GRID_UNIT;
}

export function gridYtoSVGY(y) {
  return HEIGHT - (GRID_OFFSET_Y + y * GRID_UNIT);
}

export function Grid({ showGridLines }) {
  const lines = [];
  for (let i = 0; i < GRID_WIDTH; i++) {
    //if (i % 5 === 0)
    lines.push(
      <text
        key={i + "label"}
        x={gridXtoSVGX(i)}
        y={gridYtoSVGY(0) + 0.15}
        fill={GRID_COLOR}
        fontSize={0.14}
        dominantBaseline="middle"
        textAnchor="middle"
      >
        {i}
      </text>
    );
    if (showGridLines) {
      lines.push(
        <line
          key={i}
          x1={gridXtoSVGX(i)}
          y1={gridYtoSVGY(0)}
          x2={gridXtoSVGX(i)}
          y2={gridYtoSVGY(GRID_HEIGHT - 1)}
          stroke={GRID_COLOR}
        />
      );
    }
  }
  for (let j = 0; j < GRID_HEIGHT; j++) {
    if (j !== 0)
      lines.push(
        <text
          key={j + GRID_WIDTH + "label"}
          x={gridXtoSVGX(0) - 0.15}
          y={gridYtoSVGY(j)}
          fill={GRID_COLOR}
          fontSize={0.14}
          dominantBaseline="middle"
          textAnchor="middle"
        >
          {j}
        </text>
      );
    if (showGridLines) {
      lines.push(
        <line
          key={j + GRID_WIDTH}
          x1={gridXtoSVGX(0)}
          y1={gridYtoSVGY(j)}
          x2={gridXtoSVGX(GRID_WIDTH - 1)}
          y2={gridYtoSVGY(j)}
          stroke={GRID_COLOR}
        />
      );
    }
  }

  return (
    <g stroke={GRID_COLOR} strokeWidth={0.01}>
      {lines}
      <g key="xAxis" stroke={X_AXIS_COLOR}>
        <line
          x1={gridXtoSVGX(0)}
          y1={gridYtoSVGY(0)}
          x2={gridXtoSVGX(GRID_WIDTH)}
          y2={gridYtoSVGY(0)}
        />
        <line
          x1={gridXtoSVGX(GRID_WIDTH)}
          y1={gridYtoSVGY(0)}
          x2={gridXtoSVGX(GRID_WIDTH) - 0.1}
          y2={gridYtoSVGY(0) + 0.1}
        />
        <line
          x1={gridXtoSVGX(GRID_WIDTH)}
          y1={gridYtoSVGY(0)}
          x2={gridXtoSVGX(GRID_WIDTH) - 0.1}
          y2={gridYtoSVGY(0) - 0.1}
        />
        <text
          x={gridXtoSVGX(GRID_WIDTH) + 0.1}
          y={gridYtoSVGY(0)}
          fill={X_AXIS_COLOR}
          fontSize={0.16}
          dominantBaseline="middle"
          textAnchor="middle"
        >
          X
        </text>
      </g>
      <g key="yAxis" stroke={Y_AXIS_COLOR}>
        <line
          x1={gridXtoSVGX(0)}
          y1={gridYtoSVGY(0)}
          x2={gridXtoSVGX(0)}
          y2={gridYtoSVGY(GRID_HEIGHT)}
        />
        <line
          x1={gridXtoSVGX(0)}
          y1={gridYtoSVGY(GRID_HEIGHT)}
          x2={gridXtoSVGX(0) + 0.1}
          y2={gridYtoSVGY(GRID_HEIGHT) + 0.1}
        />
        <line
          x1={gridXtoSVGX(0)}
          y1={gridYtoSVGY(GRID_HEIGHT)}
          x2={gridXtoSVGX(0) - 0.1}
          y2={gridYtoSVGY(GRID_HEIGHT) + 0.1}
        />
        <text
          x={gridXtoSVGX(0)}
          y={gridYtoSVGY(GRID_HEIGHT) - 0.1}
          fill={Y_AXIS_COLOR}
          fontSize={0.16}
          dominantBaseline="middle"
          textAnchor="middle"
        >
          Y
        </text>
      </g>
    </g>
  );
}
