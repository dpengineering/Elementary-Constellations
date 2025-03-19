import { useEffect, useRef, useState, useCallback } from "react";
import "./App.css";
import { ImageTracer } from "./imagetracer_v1.2.6.js";
import { filterImageData } from "./ScanningUtils.jsx";
import { onPointerDownStarMode, Stars } from "./Stars.jsx";
import { Grid, gridXtoSVGX, gridYtoSVGY, GRID_HEIGHT, GRID_WIDTH } from "./Grid.jsx";
import Movie from "./Movie.jsx";

export const DPI = 96; // pixels per inch

// in inches
export const WIDTH = 7.3;
export const HEIGHT = 5;

const TEXT_X = 6.8;
const TEXT_Y = 4.5;
const TEXT_SIZE = 0.25;

const ENGRAVING_RENDER_COLOR = "rgb(128,128,128)";
const ENGRAVING_EXPORT_COLOR = "red";
export const ENGRAVING_LINE_EXPORT_COLOR = "blue";

const WIDTH_PIXELS = WIDTH * DPI;
export const HEIGHT_PIXELS = HEIGHT * DPI;

// this is the drawing canvas, smaller than the cut lines
// so that no one colors outside the lines
export const CANVAS_OFFSET_X = gridXtoSVGX(-1) * DPI;
export const CANVAS_OFFSET_Y = gridYtoSVGY(GRID_HEIGHT) * DPI;
export const CANVAS_WIDTH = gridXtoSVGX(GRID_WIDTH) * DPI - CANVAS_OFFSET_X;
export const CANVAS_HEIGHT = gridYtoSVGY(-1) * DPI - CANVAS_OFFSET_Y;

console.log(CANVAS_OFFSET_X, CANVAS_OFFSET_Y, CANVAS_WIDTH, CANVAS_HEIGHT);

const MODE_DRAW = 1,
  MODE_STAR = 2,
  MODE_SCAN = 3,
  MODE_RENDER = 4;

const WEBCAM_UPDATE_INTERVAL = 500;

function App() {
  const canvasRef = useRef(null);
  const webcamRef = useRef(null);
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
  const [undoStack, setUndoStack] = useState([]);
  const [redoStack, setRedoStack] = useState([]);
  const [nameText, setNameText] = useState("<your name here>");
  const MAX_UNDO = 5;

  const lineColor = ENGRAVING_RENDER_COLOR;

  function setCookies() {
    const d = new Date();
    const expiration_days = 1;
    d.setTime(d.getTime() + expiration_days * 24 * 60 * 60 * 1000);
    const expires = "expires=" + d.toUTCString();
    document.cookie = "stars" + "=" + JSON.stringify(stars);
    +";" + expires + ";path=/";
  }

  function getCookies() {
    if (document.cookie.length === 0) {
      return;
    }
    const name = "stars=";
    const cookieStars = JSON.parse(
      document.cookie
        .split(";")
        .find((row) => row.startsWith(name))
        .split("=")[1]
    );
    if (cookieStars) {
      setStars(cookieStars);
    }
  }

  useEffect(() => {
    if (stars.length === 0) {
      return;
    }
    setCookies();
  }, [stars]);

  useEffect(() => {
    getCookies();
  }, []);

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
      webcamCtxRef.current = webcamRef.current.getContext("2d", {
        willReadFrequently: true,
      });
    } else {
        if (isPictureTaken) {
            setIsPictureTaken(false);
            onUndo();
        }
        
    }
  }, [mode]);

  const addStateToUndoStack = () => {
    undoStack.push(
      computeCtxRef.current.getImageData(
        0,
        0,
        computeCanvasRef.current.width,
        computeCanvasRef.current.height
      )
    );
    if (undoStack.length > MAX_UNDO) {
      undoStack.shift();
    }
    setUndoStack(undoStack);
    setRedoStack([]);
  };

  const addStateToRedoStack = () => {
    redoStack.push(
      computeCtxRef.current.getImageData(
        0,
        0,
        computeCanvasRef.current.width,
        computeCanvasRef.current.height
      )
    );
    setRedoStack(redoStack);
  };

  const onUndo = () => {
    if (undoStack.length === 0) {
      return;
    }
    addStateToRedoStack();

    computeCtxRef.current.putImageData(undoStack.pop(), 0, 0);
    setUndoStack(undoStack);
    renderCanvasToSVG();
  };

  const onRedo = () => {
    if (redoStack.length === 0) {
      return;
    }
    addStateToUndoStack();
    computeCtxRef.current.putImageData(redoStack.pop(), 0, 0);
    setRedoStack(redoStack);
    renderCanvasToSVG();
  };

  const onPointerDown = (e) => {
    if (mode === MODE_STAR) {
      onPointerDownStarMode(e, stars, setStars);
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

    addStateToUndoStack();

    const x = e.nativeEvent.offsetX;
    const y = e.nativeEvent.offsetY;
    console.log(e.nativeEvent.offsetX, CANVAS_OFFSET_X);

    viewCtxRef.current.beginPath();
    viewCtxRef.current.moveTo(x,y);
    computeCtxRef.current.beginPath();
    computeCtxRef.current.moveTo(x,y);
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
    const x = e.nativeEvent.offsetX;
    const y = e.nativeEvent.offsetY;

    computeCtxRef.current.lineTo(x,y);
    computeCtxRef.current.stroke();
    viewCtxRef.current.lineTo(x,y);
    viewCtxRef.current.stroke();
  };

  function intializeWebcamView() {
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
      renderThreshold(webcamCtxRef, viewCtxRef, threshold);
      return;
    }
    const render = () =>
      renderWebcamtoViewCanvas(
        webcamRef,
        webcamCtxRef,
        viewCtxRef,
        threshold
      );

    intervalRef.current = setInterval(render, WEBCAM_UPDATE_INTERVAL);
    render();
    return () => clearInterval(intervalRef.current);
  }

  useEffect(() => {
    // intializeWebcamView();
  }, [mode, threshold, isPictureTaken]);

  function onCapture() {
    addStateToUndoStack();
    const imgData = webcamCtxRef.current.getImageData(
      0,
      0,
      webcamRef.current.width,
      webcamRef.current.height
    );
    filterImageData(imgData);
    computeCtxRef.current.putImageData(imgData, 0, 0);
    renderCanvasToSVG();
    // setIsPictureTaken(false);
    setMode(MODE_DRAW);
  };

  function usePhoto() {
    setMode(MODE_DRAW);
    setIsPictureTaken(false);
  }

  function retakePhoto() {
    setIsPictureTaken(false);
    onUndo();
  }

  const onExport = () => {
    downloadSVG(svgRef.current.innerHTML, nameText);
  };

  const engravingFillColor = mode === MODE_RENDER
  ? ENGRAVING_EXPORT_COLOR
  : ENGRAVING_RENDER_COLOR;

  const nameLabel = (
    <text
      x={TEXT_X}
      y={TEXT_Y}
      stroke={ENGRAVING_LINE_EXPORT_COLOR}
      strokeWidth={0.007}
      fill="none"
      fontSize={TEXT_SIZE}
      textAnchor="end"
    >
      {nameText}
    </text>
  );

  const drawingSVG = (
    <div ref={svgRef} id="drawingSvg">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width={WIDTH + "in"}
        height={HEIGHT + "in"}
        viewBox={"0 0 " + WIDTH + " " + HEIGHT}
      >
        <g transform={`scale(${1/DPI}) translate(${CANVAS_OFFSET_X} ${CANVAS_OFFSET_Y})`}>
          {(mode !== MODE_SCAN || isPictureTaken) &&
            drawingPaths.map((path, index) => (
              <path
                key={index}
                fill={engravingFillColor}
                stroke="none"
                d={path}
              />
            ))}
        </g>
        {mode === MODE_STAR && <Grid showGridLines={showGrid} />}
        {mode !== MODE_DRAW && mode !== MODE_SCAN && (
          <Stars stars={stars} isStarMode={mode === MODE_STAR} />
        )}
        {mode === MODE_RENDER && (
          <>
            <Box />
            {nameLabel}
          </>
        )}
      </svg>
    </div>
  );

  // this is rendered on top the drawing layer so that we can still see this
  // over the drawing, even when we're erasing
  const topLayerSVG = (
    <div id="starSvg">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width={WIDTH + "in"}
        height={HEIGHT + "in"}
        viewBox={"0 0 " + WIDTH + " " + HEIGHT}
      >
        <Stars stars={stars} isStarMode={mode === MODE_STAR} />
        {<Box color="blue" />}
        {nameLabel}
      </svg>
    </div>
  );

  let menu = null;
    switch (mode) {
      case MODE_STAR:
        menu = (
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
        break;
      case MODE_DRAW:
        menu = (
          <div className="Menu">
            <button onClick={() => setMode(MODE_SCAN)}>Scan</button>
            <label>Brush Width</label>
            <input
              type="range"
              min="0.1"
              max="40"
              value={lineWidth}
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
            <button disabled={undoStack.length === 0} onClick={onUndo}>
              Undo
            </button>
            <button disabled={redoStack.length === 0} onClick={onRedo}>
              Redo
            </button>
          </div>
        );
        break;
      case MODE_SCAN:
        menu = (
          <div className="Menu">
            {isPictureTaken ? (
              <button onClick={retakePhoto}>Retake</button>
            ) : (
              <button onClick={onCapture}>Capture</button>
            )}
            <label>Threshold</label>
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
              OK
            </button>
          </div>
        );
        break;
      case MODE_RENDER:
        menu =  (
          <div className="Menu">
            <label>Name:</label>
            <input
              type="text"
              value={nameText}
              onChange={(e) => {
                setNameText(e.target.value.slice(0,28));
              }}
            />
            <button onClick={onExport}>Export</button>
          </div>
        );
        break;
    }

  return (
    <div className="App">
      <ModeSelector
        mode={mode}
        onChange={(e) => setMode(parseInt(e.target.value))}
      />
      {menu}
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
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          style={{
            top: CANVAS_OFFSET_X,
            left: CANVAS_OFFSET_Y,
            width: CANVAS_WIDTH,
            height: CANVAS_HEIGHT,
            }}
        />
        {drawingSVG}
        {(mode === MODE_SCAN && !isPictureTaken) ? <Movie threshold={threshold/256} ref={webcamRef}/> : <canvas
          className="drawingCanvas"
          onPointerDown={onPointerDown}
          onPointerUp={endDrawing}
          onPointerMove={draw}
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          style={{
            top: CANVAS_OFFSET_X,
            left: CANVAS_OFFSET_Y,
            width: CANVAS_WIDTH,
            height: CANVAS_HEIGHT,
            }}
        />}
        {(mode === MODE_DRAW || mode === MODE_SCAN) && topLayerSVG}
      </div>
      
    </div>
  );
}

function ModeSelector(props) {
  return (
    <div className="mode-container">
      <div className="mode">
        <label>
          <input
            type="radio"
            name="mode"
            value={MODE_STAR}
            checked={props.mode == MODE_STAR}
            onChange={props.onChange}
          />
          Stars
        </label>
        <label>
          <input
            type="radio"
            name="mode"
            value={MODE_DRAW}
            checked={props.mode == MODE_DRAW}
            onChange={props.onChange}
          />
          Draw
        </label>
        <label>
          <input
            type="radio"
            name="mode"
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

function downloadSVG(svgContent, nameText) {
  // Create and trigger the download
  const blob = new Blob([svgContent], { type: "image/svg+xml" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "constellation_" + nameText + ".svg";
  link.click();
}

function Box({color = "black"}) {
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
