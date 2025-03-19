import { GRID_HEIGHT, GRID_WIDTH, GRID_OFFSET_X, GRID_OFFSET_Y, GRID_UNIT, gridXtoSVGX, gridYtoSVGY} from "./Grid";
import {ENGRAVING_LINE_EXPORT_COLOR, DPI, HEIGHT_PIXELS, CANVAS_OFFSET_X, CANVAS_OFFSET_Y} from "./App";

const HOLE_RADIUS = 0.03;

export function onPointerDownStarMode(e, stars, setStars) {
    let x = (e.nativeEvent.offsetX - GRID_OFFSET_X * DPI + CANVAS_OFFSET_X) / (GRID_UNIT * DPI);
    let y =
      (HEIGHT_PIXELS - e.nativeEvent.offsetY - GRID_OFFSET_Y * DPI - CANVAS_OFFSET_Y) /
      (GRID_UNIT * DPI);
    const existingStar = stars.find((star) => {
      const dist = Math.sqrt(
        (star.x - x) * (star.x - x) + (star.y - y) * (star.y - y)
      );
      return dist < 1;
    });
    if (existingStar) {
      setStars(
        stars.filter(
          (star) => star.x !== existingStar.x || star.y !== existingStar.y
        )
      );
    } else {
      x = Math.floor(x + 0.5);
      y = Math.floor(y + 0.5);
      if (x >= 0 && x < GRID_WIDTH && y >= 0 && y < GRID_HEIGHT) {
        setStars([...stars, { x, y }]);
      }
    }
}

export function Stars({stars, isStarMode}) {
  return <>{stars.map((star, index) => {
      const x = gridXtoSVGX(star.x);
      const y = gridYtoSVGY(star.y);
      return (
        <g key={index}>
          {drawStar(x, y, ENGRAVING_LINE_EXPORT_COLOR)}
          <circle
            cx={x}
            cy={y}
            r={HOLE_RADIUS}
            stroke="black"
            strokeWidth={0.01}
            fill="none"
          />
          {isStarMode && (
            <text
              x={x + 0.13}
              y={y + 0.13}
              fontSize={0.14}
              fill="black"
              dominantBaseline="middle"
            >
              ({star.x},{star.y})
            </text>
          )}
        </g>
      );
    })}</>
}

function drawStar(x, y, color) {
  return (
    <g
      transform={`translate(${x}, ${y}) scale(0.0009765625) translate(-335, -687)`}
    >
      <path
        d="M602.24 246.72m301.12 221.76m-376.64 195.52l-64-20.8a131.84 131.84 0 0 1-83.52-83.52l-20.8-64a25.28 25.28 0 0 0-47.68 0l-20.8 64a131.84 131.84 0 0 1-82.24 83.52l-64 20.8a25.28 25.28 0 0 0 0 47.68l64 20.8a131.84 131.84 0 0 1 83.52 83.84l20.8 64a25.28 25.28 0 0 0 47.68 0l20.8-64a131.84 131.84 0 0 1 83.52-83.52l64-20.8a25.28 25.28 0 0 0 0-47.68z"
        fill="none"
        stroke={color}
        strokeWidth={10}
      />
    </g>
  );
}