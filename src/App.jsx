import { useEffect, useRef, useState } from "react";
import "./App.css";
import {ImageTracer} from "./imagetracer_v1.2.6.js";

const DPI = 96; // pixels per inch

// in inches
const WIDTH = 9;
const HEIGHT = 7;

const HOLE_RADIUS = 0.05;

const ENGRAVING_RENDER_COLOR = 'grey';
const ENGRAVING_EXPORT_COLOR = 'red';
const ENGRAVING_LINE_EXPORT_COLOR = 'blue';

const GRID_UNIT = 0.25;
const GRID_OFFSET_X = 1;
const GRID_OFFSET_Y = 1;
const GRID_COLOR = "lightgray";
const GRID_WIDTH = (WIDTH -  GRID_OFFSET_X) / GRID_UNIT - 1 ;
const GRID_HEIGHT = (HEIGHT - GRID_OFFSET_Y) / GRID_UNIT - 1;

const X_AXIS_COLOR = "blue";
const Y_AXIS_COLOR = "green";

const WIDTH_PIXELS = WIDTH * DPI;
const HEIGHT_PIXELS = HEIGHT * DPI;

const MODE_DRAW = 1, MODE_STAR = 2, MODE_RENDER = 3;

function App() {
    const canvasRef = useRef(null);
    const computeCanvasRef = useRef(null);
    const computeCtxRef = useRef(null); // for computing the svg
    const viewCtxRef = useRef(null); // for rendering what the user is doing
    const svgRef = useRef(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [lineWidth, setLineWidth] = useState(5);
    const [isErasing, setIsErasing] = useState(false);
    const [drawingPaths, setDrawingPaths] = useState([]);
    const [showGrid, setShowGrid] = useState(false);
    const [mode, setMode] = useState(MODE_STAR);
    const [stars, setStars] = useState([]);

    const lineColor = ENGRAVING_RENDER_COLOR;

    // Initialization when the component
    // mounts for the first time
    useEffect(() => {
        const ctxCompute = computeCanvasRef.current.getContext("2d", { willReadFrequently: true });
        const ctxView = canvasRef.current.getContext("2d");
        ctxView.lineCap = ctxCompute.lineCap = "round";
        ctxView.lineJoin = ctxCompute.lineJoin = "round";
        ctxView.strokeStyle = ctxCompute.strokeStyle = lineColor;
        ctxView.lineWidth = ctxCompute.lineWidth = lineWidth;
        viewCtxRef.current = ctxView;
        computeCtxRef.current = ctxCompute;
    }, [lineColor, lineWidth]);

    const onPointerDown = (e) => {
        if (mode === MODE_STAR) {
            const x = Math.floor((e.nativeEvent.offsetX - GRID_OFFSET_X * DPI) / (GRID_UNIT * DPI) + 0.5);
            const y = Math.floor((HEIGHT_PIXELS - e.nativeEvent.offsetY - GRID_OFFSET_Y * DPI) / (GRID_UNIT * DPI) + 0.5);
            const existingStar = stars.find(star => Math.abs(star.x - x) < 2 && Math.abs(star.y - y) < 2)
            if (existingStar) {
                setStars(stars.filter(star => star.x !== existingStar.x || star.y !== existingStar.y));
            } else {
                setStars([...stars, { x, y }]);
            }
        } else if (mode === MODE_DRAW){
            startDrawing(e);
        }
    };

    // Function for starting the drawing
    const startDrawing = (e) => {
        if (isErasing) {
          computeCtxRef.current.globalCompositeOperation="destination-out";
          viewCtxRef.current.strokeStyle = "white";
        } else {
          computeCtxRef.current.globalCompositeOperation="source-over";
          viewCtxRef.current.strokeStyle = lineColor;
        }
        
        viewCtxRef.current.beginPath();
        viewCtxRef.current.moveTo(
            e.nativeEvent.offsetX,
            e.nativeEvent.offsetY
        );
        computeCtxRef.current.beginPath();
        computeCtxRef.current.moveTo(
            e.nativeEvent.offsetX,
            e.nativeEvent.offsetY
        );
        setIsDrawing(true);
    };

    // Function for ending the drawing
    const endDrawing = () => {
        if (mode !== MODE_DRAW) {
            return;
        }
        computeCtxRef.current.closePath();
        viewCtxRef.current.closePath();
        setIsDrawing(false);

        const options = { strokewidth: lineWidth }; // Use the current line width for stroke
        // Adding custom palette. This will override numberofcolors.
        options.pal = [{ r: 255, g: 0, b: 0, a: 255 }, { r: 255, g: 255, b: 255, a: 255 }];
        const data = ImageTracer.getImgdata(computeCanvasRef.current);
        const paths = ImageTracer.imagedataToSVG(data, options);
        setDrawingPaths(paths);

        viewCtxRef.current.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    };

    const draw = (e) => {
        e.preventDefault();
        if (mode !== MODE_DRAW) {
            return;
        }
        if (!isDrawing) {
            return;
        }
        computeCtxRef.current.lineTo(
            e.nativeEvent.offsetX,
            e.nativeEvent.offsetY
        );
        computeCtxRef.current.stroke();
        viewCtxRef.current.lineTo(
            e.nativeEvent.offsetX,
            e.nativeEvent.offsetY
        );
        viewCtxRef.current.stroke();
    };
    const onExport = () => {
        downloadSVG(svgRef.current.innerHTML, Date.now())
    }

    const grixXtoSVGX = (x) => {
        return GRID_OFFSET_X + x * GRID_UNIT;
    }

    const grixYtoSVGY = (y) => {
        return HEIGHT - (GRID_OFFSET_Y + y * GRID_UNIT);
    }

    let grid = [];
    if (mode === MODE_STAR) {
        for (let i = 0; i < GRID_WIDTH; i++) {
            //if (i % 5 === 0)
                grid.push(<text key={i+'label'} x={grixXtoSVGX(i)} y={grixYtoSVGY(0) + 0.15} fill={GRID_COLOR} fontSize={0.14} dominantBaseline="middle" textAnchor="middle">{i}</text>);
            if (showGrid) {
                grid.push(<line key={i} x1={grixXtoSVGX(i)} y1={grixYtoSVGY(0)} x2={grixXtoSVGX(i)} y2={grixYtoSVGY(GRID_HEIGHT- 1)} stroke={GRID_COLOR}/>);
            }
        }
        for (let j = 0; j < GRID_HEIGHT; j++) {
            //if (j % 5 === 0 && j !== 0)
                grid.push(<text key={j + GRID_WIDTH+'label'} x={grixXtoSVGX(0) - 0.15} y={grixYtoSVGY(j)} fill={GRID_COLOR} fontSize={0.14} dominantBaseline="middle" textAnchor="middle">{j}</text>);
            if (showGrid) {
                grid.push(<line key={j + GRID_WIDTH} x1={grixXtoSVGX(0)} y1={grixYtoSVGY(j)} x2={grixXtoSVGX(GRID_WIDTH - 1)} y2={grixYtoSVGY(j)} stroke={GRID_COLOR} />);
            }
        }

        grid.push(<g key="xAxis" stroke={X_AXIS_COLOR}>
            <line x1={grixXtoSVGX(0)} y1={grixYtoSVGY(0)} x2={grixXtoSVGX(GRID_WIDTH)} y2={grixYtoSVGY(0)} />
            <line x1={grixXtoSVGX(GRID_WIDTH)} y1={grixYtoSVGY(0)} x2={grixXtoSVGX(GRID_WIDTH) - 0.1} y2={grixYtoSVGY(0) + 0.1} />
            <line x1={grixXtoSVGX(GRID_WIDTH)} y1={grixYtoSVGY(0)} x2={grixXtoSVGX(GRID_WIDTH) - 0.1} y2={grixYtoSVGY(0) - 0.1} />
            <text x={grixXtoSVGX(GRID_WIDTH) + 0.1} y={grixYtoSVGY(0)} fill={X_AXIS_COLOR} fontSize={0.16} dominantBaseline="middle" textAnchor="middle">X</text>
        </g>);

        grid.push(<g key="yAxis" stroke={Y_AXIS_COLOR}>
            <line x1={grixXtoSVGX(0)} y1={grixYtoSVGY(0)} x2={grixXtoSVGX(0)} y2={grixYtoSVGY(GRID_HEIGHT)} />
            <line x1={grixXtoSVGX(0)} y1={grixYtoSVGY(GRID_HEIGHT)} x2={grixXtoSVGX(0) + 0.1} y2={grixYtoSVGY(GRID_HEIGHT) + 0.1} />
            <line x1={grixXtoSVGX(0)} y1={grixYtoSVGY(GRID_HEIGHT)} x2={grixXtoSVGX(0) - 0.1} y2={grixYtoSVGY(GRID_HEIGHT) + 0.1} />
            <text x={grixXtoSVGX(0)} y={grixYtoSVGY(GRID_HEIGHT) - 0.1} fill={Y_AXIS_COLOR} fontSize={0.16} dominantBaseline="middle" textAnchor="middle">Y</text>
        </g>);
    }

    const starPaths = stars.map((star, index) => {
        const x = grixXtoSVGX(star.x);
        const y = grixYtoSVGY(star.y);
        return <g key={index}>
            {drawStar(x,y, mode === MODE_RENDER ? ENGRAVING_LINE_EXPORT_COLOR : ENGRAVING_RENDER_COLOR)}
            <circle cx={x} cy={y} r={HOLE_RADIUS} stroke="black" strokeWidth={0.01} fill="none"/>
            {mode === MODE_STAR && <text x={x + 0.13} y={y + 0.13} fontSize={0.14} fill="black" dominantBaseline="middle">({star.x},{star.y})</text>}
        </g>;
    });

    const drawingSVG = <div ref={svgRef} id="drawingSvg"><svg
        xmlns="http://www.w3.org/2000/svg"
        width={WIDTH + 'in'}
        height={HEIGHT + 'in'}
        viewBox={"0 0 " + WIDTH + " " + HEIGHT}
    >
        <g transform={"scale(" + 1/DPI +")"}>
        {drawingPaths.map((path, index) => <path key={index} fill={mode === MODE_RENDER ? ENGRAVING_EXPORT_COLOR : ENGRAVING_RENDER_COLOR} stroke="none" d={path} />)}
        </g>
        <g stroke={GRID_COLOR} strokeWidth={0.01}>
        {grid}
        </g>
        {mode != MODE_DRAW && starPaths}
    </svg></div>;

const starSVG = <div id="starSvg"><svg
xmlns="http://www.w3.org/2000/svg"
width={WIDTH + 'in'}
height={HEIGHT + 'in'}
viewBox={"0 0 " + WIDTH + " " + HEIGHT}
>
{starPaths}
</svg></div>;

    return (
        <div className="App">
            <ModeSelector mode={mode} onChange={(e) => setMode(parseInt(e.target.value))} />
            <Menu
                setLineWidth={setLineWidth}
                setIsErasing={setIsErasing}
                isErasing={isErasing}
                onExport={onExport}
                setShowGrid={setShowGrid}
                showGrid={showGrid}
                mode={mode}
            />
            <div id="canvasContainer" style={{ width: WIDTH_PIXELS, height: HEIGHT_PIXELS }}>
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
                {mode === MODE_DRAW && starSVG}
                </div>
        </div>
    );
}

function ModeSelector(props) {
  return <div className="mode-container">
    <div className="mode">
      <label htmlFor="brickIcon">
        <input type="radio" name="mode" className="brickIcon" id="brickIcon" value={MODE_STAR} checked={props.mode == MODE_STAR} onChange={props.onChange} />
        Stars
      </label>
      <label htmlFor="filledIcon">
        <input type="radio" name="mode" className="filledIcon" id="filledIcon" value={MODE_DRAW} checked={props.mode == MODE_DRAW} onChange={props.onChange} />
        Draw
      </label>
      <label htmlFor="outlineIcon">
        <input type="radio" name="mode" className="outlineIcon" id="outlineIcon" value={MODE_RENDER} checked={props.mode == MODE_RENDER} onChange={props.onChange} />
        Preview
      </label>
    </div>
  </div>
}

const Menu = ({ setLineWidth, setIsErasing, isErasing, setShowGrid, showGrid, onExport, mode}) => {
  return (
      <div className="Menu">
        {mode === MODE_DRAW && <>
          <label>Brush Width </label>
          <input
              type="range"
              min="3"
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
          </>}
          {mode === MODE_STAR && <>
          <label>Show Grid</label>
          <input
              type="checkbox"
              checked={showGrid}
              onChange={(e) => {
                  setShowGrid(e.target.checked);
              }}
          />
          </>}
          {mode === MODE_RENDER && <button onClick={onExport}>Export</button>}
      </div>
  );
};

function downloadSVG(svgContent, nameText) {
    // Create and trigger the download
    const blob = new Blob([svgContent], { type: "image/svg+xml" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "constellation_"+ nameText +".svg";
    link.click();
  }

  function drawStar(x,y, color) {
    return <g transform={`translate(${x}, ${y}) scale(0.0009765625) translate(-335, -687)`}><path d="M602.24 246.72m301.12 221.76m-376.64 195.52l-64-20.8a131.84 131.84 0 0 1-83.52-83.52l-20.8-64a25.28 25.28 0 0 0-47.68 0l-20.8 64a131.84 131.84 0 0 1-82.24 83.52l-64 20.8a25.28 25.28 0 0 0 0 47.68l64 20.8a131.84 131.84 0 0 1 83.52 83.84l20.8 64a25.28 25.28 0 0 0 47.68 0l20.8-64a131.84 131.84 0 0 1 83.52-83.52l64-20.8a25.28 25.28 0 0 0 0-47.68z" fill="none" stroke={color} strokeWidth={10}/></g>;
  }

export default App;