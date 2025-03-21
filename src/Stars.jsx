import {
  GRID_HEIGHT,
  GRID_WIDTH,
  GRID_OFFSET_X,
  GRID_OFFSET_Y,
  GRID_UNIT,
  gridXtoSVGX,
  gridYtoSVGY,
} from "./Grid";
import {
  ENGRAVING_LINE_EXPORT_COLOR,
  DPI,
  HEIGHT_PIXELS,
  CANVAS_OFFSET_X,
  CANVAS_OFFSET_Y,
} from "./App";

const HOLE_RADIUS = 0.03;
export const NUM_STAR_TYPES = 8;

export function onPointerDownStarMode(e, stars, setStars) {
  let x =
    (e.nativeEvent.offsetX - GRID_OFFSET_X * DPI + CANVAS_OFFSET_X) /
    (GRID_UNIT * DPI);

  let y =
    (HEIGHT_PIXELS -
      e.nativeEvent.offsetY -
      GRID_OFFSET_Y * DPI -
      CANVAS_OFFSET_Y) /
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

export function Stars({ stars, isStarMode, type }) {
  return (
    <>
      {stars.map((star, index) => {
        const x = gridXtoSVGX(star.x);
        const y = gridYtoSVGY(star.y);
        return (
          <g key={index}>
            <Star x={x} y={y} color={ENGRAVING_LINE_EXPORT_COLOR} type={type}/>
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
      })}
    </>
  );
}

export function Star({ x, y, color, type }) {
  switch (type) {
    case 0:
      return <FourPointedStar x={x} y={y} color={color} />;
    case 1:
      return <FourPointedStar2 x={x} y={y} color={color} />;
    case 2:
      return <FivePointedStarRounded x={x} y={y} color={color} />;
    case 3:
      return <SwirlyStar2 x={x} y={y} color={color} />;
    case 4:
      return <SwirlyStar x={x} y={y} color={color} />;
    case 5:
      return <FivePointedStar x={x} y={y} color={color} />;
    case 6:
      return <CrescentsStar x={x} y={y} color={color} />;
    case 7:
      return null; // display no star so they can draw their own
  }
}

function ScaledStar({ children, x, y, centerX, centerY, size, color }) {
  // scales the star to 1 grid unit in radius
  const scale = (2 * GRID_UNIT) / size;
  return (
    <g
      transform={`translate(${x}, ${y}) scale(${scale}) translate(${-centerX}, ${-centerY})`}
      fill="none"
      stroke={color}
      strokeWidth={0.01 / scale}
    >
      {children}
    </g>
  );
}

function FourPointedStar({ x, y, color }) {
  return (
    <ScaledStar
      x={x}
      y={y}
      centerX={335}
      centerY={687}
      size={425}
      color={color}
    >
      <path d="M602.24 246.72m301.12 221.76m-376.64 195.52l-64-20.8a131.84 131.84 0 0 1-83.52-83.52l-20.8-64a25.28 25.28 0 0 0-47.68 0l-20.8 64a131.84 131.84 0 0 1-82.24 83.52l-64 20.8a25.28 25.28 0 0 0 0 47.68l64 20.8a131.84 131.84 0 0 1 83.52 83.84l20.8 64a25.28 25.28 0 0 0 47.68 0l20.8-64a131.84 131.84 0 0 1 83.52-83.52l64-20.8a25.28 25.28 0 0 0 0-47.68z" />
    </ScaledStar>
  );
}

function FourPointedStar2({ x, y, color }) {
  return (
    <ScaledStar
      x={x}
      y={y}
      centerX={528}
      centerY={528}
      size={700}
      color={color}
    >
      <path d="M526.53,862.58c-49,0-81-56.88-97.94-173.89A73.39,73.39,0,0,0,366,626.15c-117-16.94-173.88-49-173.88-97.94s56.87-81,173.89-97.94a73.4,73.4,0,0,0,62.54-62.54c16.94-117,49-173.89,97.94-173.89s81,56.88,97.93,173.89A73.4,73.4,0,0,0,687,430.27c117,16.94,173.88,49,173.88,97.94S804,609.2,687,626.15a73.39,73.39,0,0,0-62.55,62.54C607.52,805.7,575.48,862.58,526.53,862.58Z" />
      <path d="M821.31,528.21c0-24.84-56-46.6-140-58.76a113.32,113.32,0,0,1-96.05-96.05c-12.16-84-33.93-140-58.76-140s-46.6,56-58.77,140a113.3,113.3,0,0,1-96,96.05c-84,12.16-140,33.92-140,58.76s56,46.6,140,58.76a113.3,113.3,0,0,1,96,96c12.17,84,33.93,140,58.77,140s46.6-56,58.76-140a113.32,113.32,0,0,1,96.05-96C765.33,574.81,821.31,553.05,821.31,528.21Z" />{" "}
    </ScaledStar>
  );
}

function FivePointedStar({ x, y, color }) {
  return (
    <ScaledStar x={x} y={y} centerX={25} centerY={26} size={52} color={color}>
      <path d="m25,1 6,17h18l-14,11 5,17-15-10-15,10 5-17-14-11h18z" />
    </ScaledStar>
  );
}

function FivePointedStarRounded({ x, y, color }) {
  return (
    <ScaledStar
      x={x}
      y={y}
      centerX={530}
      centerY={560}
      size={700}
      color={color}
    >
      <path d="M694.09,841.6A43.06,43.06,0,0,1,667,832L529.49,720.7,392,832a43.11,43.11,0,0,1-68.35-46.1l53-173.46L230.4,511.84a43.1,43.1,0,0,1,24.42-78.61H431.4l56.86-186.1a43.11,43.11,0,0,1,82.45,0l56.86,186.1H805.06a43.1,43.1,0,0,1,24.37,78.65l-147,100.8,52.92,173.23a43.09,43.09,0,0,1-41.22,55.69Z" />
    </ScaledStar>
  );
}

function SwirlyStar({ x, y, color }) {
  return (
    <ScaledStar
      x={x}
      y={y}
      centerX={545}
      centerY={545}
      size={700}
      color={color}
    >
      <path d="M540,192.74c-52.09,134.74-56.24,197.11-34.59,231.92,31.3-51.59,101.45-101.6,196.57-143.1-68.56,61-105.48,107.74-108.08,147.88,60.83-16.61,149.67-10.72,298.72,59.18-133.94-23.58-200.34-21-231.93,3.67,58.13,26.89,121.17,96.91,178.9,193.26-76.43-73.63-128.81-104.74-170.06-105.09,26.29,60,34.08,151.75-7.07,306.8C656.46,763.08,644.23,687,616,655,596,719.86,531.17,800.49,417.54,887.26,510,777.88,538.12,716.67,534.06,673.7c-51.18,37.36-133.59,63.75-259.19,66.46,92.36-36.37,158-67.52,179.8-103.5-65.31-4.32-153-42.92-267.29-148C315,561.44,377.55,575,417.29,560.89c-46.82-39.5-86.91-112.79-112.57-217.24C354.79,417.23,396.2,466.21,436,476.93,427.53,414.87,447,327.41,540,192.74Z" />
    </ScaledStar>
  );
}

function SwirlyStar2({ x, y, color }) {
  return (
    <ScaledStar
      x={x}
      y={y}
      centerX={535}
      centerY={545}
      size={650}
      color={color}
    >
      <path d="M453.19,508.08c-133,15.35-17.91-368.31,319.72-204.62C476.21,47.69,164.16,549,486.44,623.18c5.11,112.54-327.4,69.06-191.83-337.62C59.29,710.15,576,873.84,619.44,574.59c122.77-38.37,12.79,370.87-337.62,220C668,1019.63,888,469.72,568.28,462,519.69,308.58,962.18,454.37,778,802.23,1041.47,393,460.86,190.92,453.19,508.08Z" />{" "}
    </ScaledStar>
  );
}

function CrescentsStar({ x, y, color }) {
  return (
    <ScaledStar
      x={x}
      y={y}
      centerX={545}
      centerY={545}
      size={850}
      color={color}
    >
      <path d="M500,297.29a141.67,141.67,0,0,0-199.5,198.93A141.69,141.69,0,1,1,500,297.29Z" />
      <path d="M580,297.29a141.67,141.67,0,0,1,199.5,198.93A141.69,141.69,0,1,0,580,297.29Z" />
      <path d="M500,782.71a141.67,141.67,0,0,1-199.5-198.93A141.69,141.69,0,1,0,500,782.71Z" />
      <path d="M580,782.71a141.67,141.67,0,0,0,199.5-198.93A141.69,141.69,0,1,1,580,782.71Z" />
    </ScaledStar>
  );
}
