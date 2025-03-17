import { useEffect, useRef, useState, useCallback } from "react";
import "./App.css";
import { ImageTracer } from "./imagetracer_v1.2.6.js";
import Webcam from "react-webcam";
import { renderWebcamtoViewCanvas, renderThreshold } from "./ScanningUtils.jsx";
import { onPointerDownStarMode, Stars } from "./Stars.jsx";
import { Grid } from "./Grid.jsx";

export const DPI = 96; // pixels per inch

// in inches
export const WIDTH = 7.3;
export const HEIGHT = 5;

const ENGRAVING_RENDER_COLOR = "grey";
const ENGRAVING_EXPORT_COLOR = "red";
export const ENGRAVING_LINE_EXPORT_COLOR = "blue";

const WIDTH_PIXELS = WIDTH * DPI;
export const HEIGHT_PIXELS = HEIGHT * DPI;

const MODE_DRAW = 1,
  MODE_STAR = 2,
  MODE_SCAN = 3,
  MODE_RENDER = 4;

const WEBCAM_UPDATE_INTERVAL = 500;

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
  const [undoStack, setUndoStack] = useState([]);
  const [redoStack, setRedoStack] = useState([]);
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
      webcamCtxRef.current = webcamCanvasRef.current.getContext("2d", {
        willReadFrequently: true,
      });
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
      renderThreshold(webcamCtxRef, viewCtxRef, webcamCanvasRef, threshold);
      return;
    }
    const render = () =>
      renderWebcamtoViewCanvas(
        webcamRef,
        webcamCtxRef,
        webcamCanvasRef,
        viewCtxRef,
        threshold
      );

    intervalRef.current = setInterval(render, WEBCAM_UPDATE_INTERVAL);
    render();
    return () => clearInterval(intervalRef.current);
  }

  useEffect(() => {
    intializeWebcamView();
  }, [mode, threshold, isPictureTaken]);

  const onCapture = () => {
    setIsPictureTaken(true);
  };

  function usePhoto() {
    addStateToUndoStack();
    const imgData = viewCtxRef.current.getImageData(
      0,
      0,
      canvasRef.current.width,
      canvasRef.current.height
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
  }

  const onExport = () => {
    downloadSVG(svgRef.current.innerHTML, Date.now());
  };

  let grid = [];
  if (mode === MODE_STAR) {
  }

  const drawingSVG = (
    <div ref={svgRef} id="drawingSvg">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width={WIDTH + "in"}
        height={HEIGHT + "in"}
        viewBox={"0 0 " + WIDTH + " " + HEIGHT}
      >
        <g transform={"scale(" + 1 / DPI + ")"}>
          {mode !== MODE_SCAN &&
            drawingPaths.map((path, index) => (
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
        {mode === MODE_STAR && <Grid showGridLines={showGrid} />}
        {mode !== MODE_DRAW && mode !== MODE_SCAN && (
          <Stars stars={stars} isStarMode={mode === MODE_STAR} />
        )}
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
        <Stars stars={stars} isStarMode={mode === MODE_STAR} />
        {drawBox("blue")}
      </svg>
    </div>
  );

  return (
    <div className="App">
      <ModeSelector
        mode={mode}
        onChange={(e) => setMode(parseInt(e.target.value))}
      />
      <Menu
        lineWidth={lineWidth}
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
        onUndo={onUndo}
        undoStack={undoStack}
        onRedo={onRedo}
        redoStack={redoStack}
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
      {mode === MODE_SCAN && (
        <>
          <Webcam
            id="webcam"
            audio={false}
            ref={webcamRef}
            videoConstraints={{
              facingMode: { ideal: "environment" },
              width: { min: 640, exact: 640, max: 640 },
              height: { exact: 480 },
              aspectRatio: 1.33333333333,
            }}
            screenshotFormat="image/png"
          />
          <canvas
            id="webcamCanvas"
            ref={webcamCanvasRef}
            width={WIDTH_PIXELS + `px`}
            height={HEIGHT_PIXELS + `px`}
          />
        </>
      )}
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
  lineWidth,
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
  onUndo,
  onRedo,
  undoStack,
  redoStack,
}) => {
  switch (mode) {
    case MODE_DRAW:
      return (
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
    case MODE_RENDER:
      return (
        <div className="Menu">
          <button onClick={onExport}>Export</button>
        </div>
      );
    case MODE_SCAN:
      return (
        <div className="Menu">
          {isPictureTaken ? (
            <button onClick={onTryAgainPhoto}>Retake</button>
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
            Use Photo
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
