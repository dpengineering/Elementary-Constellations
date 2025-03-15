import { useEffect, useRef, useState, useCallback } from "react";
import "./App.css";
import { ImageTracer } from "./imagetracer_v1.2.6.js";
import Webcam from "react-webcam";

const DPI = 96; // pixels per inch

// in inches
const WIDTH = 7.3;
const HEIGHT = 5;

const HOLE_RADIUS = 0.03;

const ENGRAVING_RENDER_COLOR = "grey";
const ENGRAVING_EXPORT_COLOR = "red";
const ENGRAVING_LINE_EXPORT_COLOR = "blue";

const GRID_UNIT = 0.2;
const GRID_OFFSET_X = 0.55;
const GRID_OFFSET_Y = 0.45;
const GRID_COLOR = "lightgray";
const GRID_WIDTH = 32;
const GRID_HEIGHT = 21;

const X_AXIS_COLOR = "blue";
const Y_AXIS_COLOR = "green";

const WIDTH_PIXELS = WIDTH * DPI;
const HEIGHT_PIXELS = HEIGHT * DPI;

const MODE_DRAW = 1,
  MODE_STAR = 2,
  MODE_SCAN = 3,
  MODE_RENDER = 4;

function App() {
  const canvasRef = useRef(null);
  const webcamRef = useRef(null);
  const webcamCanvasRef = useRef(null);
  const computeCanvasRef = useRef(null);
  const intervalRef = useRef(0);
  const computeCtxRef = useRef(null); // for computing the svg
  const viewCtxRef = useRef(null); // for rendering what the user is doing
  const webcamCtxRef = useRef(null);
  const svgRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [lineWidth, setLineWidth] = useState(5);
  const [isErasing, setIsErasing] = useState(false);
  const [drawingPaths, setDrawingPaths] = useState([]);
  const [showGrid, setShowGrid] = useState(false);
  const [mode, setMode] = useState(MODE_STAR);
  const [stars, setStars] = useState([]);
  const [threshold, setThreshold] = useState(127);
  const [isPictureTaken, setIsPictureTaken] = useState(false);

  const lineColor = ENGRAVING_RENDER_COLOR;

  // Initialization when the component
  // mounts for the first time
  useEffect(() => {
    const ctxCompute = computeCanvasRef.current.getContext("2d", {
      willReadFrequently: true,
    });
    const ctxView = canvasRef.current.getContext("2d", {
        willReadFrequently: true,
      });
    ctxView.lineCap = ctxCompute.lineCap = "round";
    ctxView.lineJoin = ctxCompute.lineJoin = "round";
    ctxView.strokeStyle = ctxCompute.strokeStyle = lineColor;
    ctxView.lineWidth = ctxCompute.lineWidth = lineWidth;
    viewCtxRef.current = ctxView;
    computeCtxRef.current = ctxCompute;
  }, [lineColor, lineWidth]);

  useEffect(() => {
    if (mode === MODE_SCAN) {
      webcamCtxRef.current = webcamCanvasRef.current.getContext("2d", {
        willReadFrequently: true,
      });
    }
  }, [mode]);

  const onPointerDown = (e) => {
    if (mode === MODE_STAR) {
      const x = Math.floor(
        (e.nativeEvent.offsetX - GRID_OFFSET_X * DPI) / (GRID_UNIT * DPI) + 0.5
      );
      const y = Math.floor(
        (HEIGHT_PIXELS - e.nativeEvent.offsetY - GRID_OFFSET_Y * DPI) /
          (GRID_UNIT * DPI) +
          0.5
      );
      const existingStar = stars.find(
        (star) => Math.abs(star.x - x) < 2 && Math.abs(star.y - y) < 2
      );
      if (existingStar) {
        setStars(
          stars.filter(
            (star) => star.x !== existingStar.x || star.y !== existingStar.y
          )
        );
      } else if (x >= 0 && x < GRID_WIDTH && y >= 0 && y < GRID_HEIGHT) {
        setStars([...stars, { x, y }]);
      }
    } else if (mode === MODE_DRAW) {
      startDrawing(e);
    }
  };

  // Function for starting the drawing
  const startDrawing = (e) => {
    if (isErasing) {
      computeCtxRef.current.globalCompositeOperation = "destination-out";
      viewCtxRef.current.strokeStyle = "white";
    } else {
      computeCtxRef.current.globalCompositeOperation = "source-over";
      viewCtxRef.current.strokeStyle = lineColor;
    }

    viewCtxRef.current.beginPath();
    viewCtxRef.current.moveTo(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
    computeCtxRef.current.beginPath();
    computeCtxRef.current.moveTo(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
    setIsDrawing(true);
  };

  const renderCanvasToSVG = () => {
    const options = { strokewidth: lineWidth }; // Use the current line width for stroke
    // Adding custom palette. This will override numberofcolors.
    options.pal = [
      { r: 255, g: 0, b: 0, a: 255 },
      { r: 255, g: 255, b: 255, a: 255 },
    ];
    const data = ImageTracer.getImgdata(computeCanvasRef.current);
    const paths = ImageTracer.imagedataToSVG(data, options);
    setDrawingPaths(paths);
  };

  // Function for ending the drawing
  const endDrawing = () => {
    if (mode !== MODE_DRAW) {
      return;
    }
    computeCtxRef.current.closePath();
    viewCtxRef.current.closePath();
    setIsDrawing(false);

    renderCanvasToSVG();

    viewCtxRef.current.clearRect(
      0,
      0,
      canvasRef.current.width,
      canvasRef.current.height
    );
  };

  const draw = (e) => {
    e.preventDefault();
    if (mode !== MODE_DRAW) {
      return;
    }
    if (!isDrawing) {
      return;
    }
    computeCtxRef.current.lineTo(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
    computeCtxRef.current.stroke();
    viewCtxRef.current.lineTo(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
    viewCtxRef.current.stroke();
  };

  useEffect(() => {
    clearInterval(intervalRef.current);
    if (mode !== MODE_SCAN) {
      setIsPictureTaken(false);
      viewCtxRef.current.clearRect(
        0,
        0,
        canvasRef.current.width,
        canvasRef.current.height
      );
      return;
    }
    if (isPictureTaken) {
      renderThreshold();
      return;
    }
    intervalRef.current = setInterval(renderWebcamtoViewCanvas, 500);
    renderWebcamtoViewCanvas();
    return () => clearInterval(intervalRef.current);
  }, [mode, threshold, isPictureTaken]);

  const renderWebcamtoViewCanvas = useCallback(() => {
    const imageSrc = webcamRef.current.getScreenshot();
    const image = new Image();
    image.onload = function () {
      webcamCtxRef.current.drawImage(image, 0, 0);
      renderThreshold();
    };
    image.src = imageSrc;
  }, [webcamRef, webcamCtxRef, threshold]);

  const onCapture = () => {
    setIsPictureTaken(true);
  };

  const renderThreshold = () => {
    if (webcamRef.current && webcamRef.current.video) {
      const { videoWidth, videoHeight } = webcamRef.current.video;
      webcamCanvasRef.current.style.width = videoWidth + "px";
      webcamCanvasRef.current.style.height = videoHeight + "px";
    }
    const imgData = webcamCtxRef.current.getImageData(
      0,
      0,
      webcamCanvasRef.current.width,
      webcamCanvasRef.current.height
    );
    let d = imgData.data,
      i = 0,
      l = d.length;
    const light = [0, 0, 0, 0],
      dark = [0, 0, 0, 255];

    while ((l -= 4 > 0)) {
      const v = d[i] * 0.2126 + d[i + 1] * 0.7152 + d[i + 2] * 0.0722;
      [d[i], d[i + 1], d[i + 2], d[i + 3]] = v >= threshold ? light : dark;
      i += 4;
    }
    const x = gridXtoSVGX(-1) * DPI;
    const y = gridYtoSVGY(GRID_HEIGHT) * DPI;
    viewCtxRef.current.putImageData(imgData, x, y, 0, 0, gridXtoSVGX(GRID_WIDTH) * DPI - x, gridYtoSVGY(-1) * DPI - y);
    return imgData;
  };

  const usePhoto = () => {
    const imgData = viewCtxRef.current.getImageData(
        0,
        0,
        canvasRef.current.width,
        canvasRef.current.height,
    );
    computeCtxRef.current.putImageData(imgData, 0, 0);
    renderCanvasToSVG();
    viewCtxRef.current.clearRect(
      0,
      0,
      canvasRef.current.width,
      canvasRef.current.height
    );
    setMode(MODE_DRAW);
  };

  const onExport = () => {
    downloadSVG(svgRef.current.innerHTML, Date.now());
  };

  const gridXtoSVGX = (x) => {
    return GRID_OFFSET_X + x * GRID_UNIT;
  };

  const gridYtoSVGY = (y) => {
    return HEIGHT - (GRID_OFFSET_Y + y * GRID_UNIT);
  };

  let grid = [];
  if (mode === MODE_STAR) {
    for (let i = 0; i < GRID_WIDTH; i++) {
      //if (i % 5 === 0)
      grid.push(
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
      if (showGrid) {
        grid.push(
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
        grid.push(
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
      if (showGrid) {
        grid.push(
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

    grid.push(
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
    );

    grid.push(
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
    );
  }

  const starPaths = stars.map((star, index) => {
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
        {mode === MODE_STAR && (
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
  });

  const drawingSVG = (
    <div ref={svgRef} id="drawingSvg">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width={WIDTH + "in"}
        height={HEIGHT + "in"}
        viewBox={"0 0 " + WIDTH + " " + HEIGHT}
      >
        <g transform={"scale(" + 1 / DPI + ")"}>
          {drawingPaths.map((path, index) => (
            <path
              key={index}
              fill={
                mode === MODE_RENDER
                  ? ENGRAVING_EXPORT_COLOR
                  : ENGRAVING_RENDER_COLOR
              }
              stroke="none"
              d={path}
            />
          ))}
        </g>
        <g stroke={GRID_COLOR} strokeWidth={0.01}>
          {grid}
        </g>
        {(mode !== MODE_DRAW && mode !== MODE_SCAN) && starPaths}
        {mode === MODE_RENDER && drawBox()}
      </svg>
    </div>
  );

  const starSVG = (
    <div id="starSvg">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width={WIDTH + "in"}
        height={HEIGHT + "in"}
        viewBox={"0 0 " + WIDTH + " " + HEIGHT}
      >
        {starPaths}
        {drawBox("blue")}
      </svg>
    </div>
  );

  return (
    <div className="App">
      {mode === MODE_SCAN && (
        <>
          <Webcam
            id="webcam"
            audio={false}
            ref={webcamRef}
            screenshotFormat="image/png"
          />
          <canvas
            id="webcamCanvas"
            muted={false}
            ref={webcamCanvasRef}
            width={WIDTH_PIXELS + `px`}
            height={HEIGHT_PIXELS + `px`}
          />
        </>
      )}
      <ModeSelector
        mode={mode}
        onChange={(e) => setMode(parseInt(e.target.value))}
      />
      <Menu
        setLineWidth={setLineWidth}
        setIsErasing={setIsErasing}
        isErasing={isErasing}
        onExport={onExport}
        setShowGrid={setShowGrid}
        showGrid={showGrid}
        mode={mode}
        setMode={setMode}
        onCapture={onCapture}
        threshold={threshold}
        setThreshold={setThreshold}
        usePhoto={usePhoto}
        isPictureTaken={isPictureTaken}
        onTryAgainPhoto={() => setIsPictureTaken(false)}
      />
      <div
        id="canvasContainer"
        style={{
          width: WIDTH_PIXELS,
          height: HEIGHT_PIXELS,
          minHeight: HEIGHT_PIXELS,
        }}
      >
        <canvas
          id="computeCanvas"
          ref={computeCanvasRef}
          width={WIDTH_PIXELS + `px`}
          height={HEIGHT_PIXELS + `px`}
        />
        {drawingSVG}
        <canvas
          id="drawingCanvas"
          onPointerDown={onPointerDown}
          onPointerUp={endDrawing}
          onPointerMove={draw}
          ref={canvasRef}
          width={WIDTH_PIXELS + `px`}
          height={HEIGHT_PIXELS + `px`}
        />
        {(mode === MODE_DRAW || mode === MODE_SCAN) && starSVG}
      </div>
    </div>
  );
}

function ModeSelector(props) {
  return (
    <div className="mode-container">
      <div className="mode">
        <label htmlFor="brickIcon">
          <input
            type="radio"
            name="mode"
            className="brickIcon"
            id="brickIcon"
            value={MODE_STAR}
            checked={props.mode == MODE_STAR}
            onChange={props.onChange}
          />
          Stars
        </label>
        <label htmlFor="filledIcon">
          <input
            type="radio"
            name="mode"
            className="filledIcon"
            id="filledIcon"
            value={MODE_DRAW}
            checked={props.mode == MODE_DRAW}
            onChange={props.onChange}
          />
          Draw
        </label>
        <label htmlFor="outlineIcon">
          <input
            type="radio"
            name="mode"
            className="outlineIcon"
            id="outlineIcon"
            value={MODE_RENDER}
            checked={props.mode == MODE_RENDER}
            onChange={props.onChange}
          />
          Preview
        </label>
      </div>
    </div>
  );
}

const Menu = ({
  setLineWidth,
  setIsErasing,
  isErasing,
  setShowGrid,
  showGrid,
  threshold,
  setThreshold,
  onExport,
  mode,
  setMode,
  onCapture,
  usePhoto,
  isPictureTaken,
  onTryAgainPhoto,
}) => {
  switch (mode) {
    case MODE_DRAW:
      return (
        <div className="Menu">
          <button onClick={() => setMode(MODE_SCAN)}>Scan</button>
          <label>Brush Width</label>
          <input
            type="range"
            min="1"
            max="20"
            onChange={(e) => {
              setLineWidth(e.target.value);
            }}
          />
          <label>Erase</label>
          <input
            type="checkbox"
            checked={isErasing}
            onChange={(e) => {
              setIsErasing(e.target.checked);
            }}
          />
        </div>
      );
    case MODE_RENDER:
      return (
        <div className="Menu">
          <button onClick={onExport}>Export</button>
        </div>
      );
    case MODE_SCAN:
      return (
        <div className="Menu">
            {isPictureTaken ?
          <button onClick={onTryAgainPhoto}>Try Again</button>
          : <button onClick={onCapture}>Capture</button>
            }
          <input
            type="range"
            min="1"
            max="255"
            value={threshold}
            onChange={(e) => {
              setThreshold(e.target.value);
            }}
          />
          <button disabled={!isPictureTaken} onClick={usePhoto}>
            UsePhoto
          </button>
        </div>
      );
    case MODE_STAR:
      return (
        <div className="Menu">
          <label>Show Grid</label>
          <input
            type="checkbox"
            checked={showGrid}
            onChange={(e) => {
              setShowGrid(e.target.checked);
            }}
          />
        </div>
      );
  }
};

function downloadSVG(svgContent, nameText) {
  // Create and trigger the download
  const blob = new Blob([svgContent], { type: "image/svg+xml" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "constellation_" + nameText + ".svg";
  link.click();
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

function drawBox(color = "black") {
  return (
    <g
      transform="translate(0,0.07)"
      fill="none"
      stroke={color}
      strokeWidth={0.01}
    >
      <path d="M1.905 4.732v.115h.5v-.115h2.5v.115h.5v-.115h1.701v-.46h.115v-.5h-.115v-2.5h.115v-.5h-.115v-.54h-.7V.02h-.5v.212H1.404V.02h-.5v.212h-.7v1.04H.09v.5h.115v1.5H.089v.5h.115v.96z" />
    </g>
  );
}

export default App;
