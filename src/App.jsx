import { useEffect, useRef, useState } from "react";
import "./App.css";
import "./imagetracer_v1.2.6.js";

const DPI = 96; // pixels per inch

// in inches
const WIDTH = 7;
const HEIGHT = 7;

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

const MODE_DRAW = 1, MODE_STAR = 2;

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
    const [showGrid, setShowGrid] = useState([]);
    const [mode, setMode] = useState(MODE_STAR);
    const [stars, setStars] = useState([]);

    const lineColor = "black";

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
            if (stars.find(star => star.x === x && star.y === y)) {
                setStars(stars.filter(star => star.x !== x || star.y !== y));
            } else {
                setStars([...stars, { x, y }]);
            }
        } else {
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
        if (mode === MODE_STAR) {
            return;
        }
        computeCtxRef.current.closePath();
        viewCtxRef.current.closePath();
        setIsDrawing(false);

        const options = { strokewidth: lineWidth }; // Use the current line width for stroke
        // Adding custom palette. This will override numberofcolors.
        options.pal = [{ r: 255, g: 0, b: 0, a: 255 }, { r: 255, g: 255, b: 255, a: 255 }];
        const data = window.ImageTracer.getImgdata(computeCanvasRef.current);
        const paths = window.ImageTracer.imagedataToSVG(data, options);
        setDrawingPaths(paths);

        viewCtxRef.current.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    };

    const draw = (e) => {
        e.preventDefault();
        if (mode === MODE_STAR) {
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

    let grid = null;
    if (showGrid) {
        grid = [];
        for (let i = 0; i < GRID_WIDTH; i++) {
            //if (i % 5 === 0)
                grid.push(<text key={i+'label'} x={grixXtoSVGX(i)} y={grixYtoSVGY(0) + 0.15} fill={GRID_COLOR} fontSize={0.14} dominantBaseline="middle" textAnchor="middle">{i}</text>);
            grid.push(<line key={i} x1={grixXtoSVGX(i)} y1={grixYtoSVGY(0)} x2={grixXtoSVGX(i)} y2={grixYtoSVGY(GRID_HEIGHT- 1)} stroke={GRID_COLOR}/>);
        }
        for (let j = 0; j < GRID_HEIGHT; j++) {
            //if (j % 5 === 0 && j !== 0)
                grid.push(<text key={j + GRID_WIDTH+'label'} x={grixXtoSVGX(0) - 0.15} y={grixYtoSVGY(j)} fill={GRID_COLOR} fontSize={0.14} dominantBaseline="middle" textAnchor="middle">{j}</text>);
            grid.push(<line key={j + GRID_WIDTH} x1={grixXtoSVGX(0)} y1={grixYtoSVGY(j)} x2={grixXtoSVGX(GRID_WIDTH - 1)} y2={grixYtoSVGY(j)} stroke={GRID_COLOR} />);
        }

        grid.push(<g key="xAxis" stroke={X_AXIS_COLOR}>
            <line x1={grixXtoSVGX(0)} y1={grixYtoSVGY(0)} x2={grixXtoSVGX(GRID_WIDTH)} y2={grixYtoSVGY(0)} />
            <line x1={grixXtoSVGX(GRID_WIDTH)} y1={grixYtoSVGY(0)} x2={grixXtoSVGX(GRID_WIDTH) - 0.1} y2={grixYtoSVGY(0) + 0.1} />
            <line x1={grixXtoSVGX(GRID_WIDTH)} y1={grixYtoSVGY(0)} x2={grixXtoSVGX(GRID_WIDTH) - 0.1} y2={grixYtoSVGY(0) - 0.1} />
        </g>);

        grid.push(<g key="yAxis" stroke={Y_AXIS_COLOR}>
            <line x1={grixXtoSVGX(0)} y1={grixYtoSVGY(0)} x2={grixXtoSVGX(0)} y2={grixYtoSVGY(GRID_HEIGHT)} />
            <line x1={grixXtoSVGX(0)} y1={grixYtoSVGY(GRID_HEIGHT)} x2={grixXtoSVGX(0) + 0.1} y2={grixYtoSVGY(GRID_HEIGHT) + 0.1} />
            <line x1={grixXtoSVGX(0)} y1={grixYtoSVGY(GRID_HEIGHT)} x2={grixXtoSVGX(0) - 0.1} y2={grixYtoSVGY(GRID_HEIGHT) + 0.1} />
        </g>);
    }

    const starPaths = stars.map((star, index) => {
        const x = grixXtoSVGX(star.x);
        const y = grixYtoSVGY(star.y);
        return <g key={index}>
            <circle cx={x} cy={y} r={0.1} stroke="red" strokeWidth={0.01} fill="none"/>
            <text x={x + 0.15} y={y} fontSize={0.14} fill="black" dominantBaseline="middle">({star.x},{star.y})</text>
        </g>;
    });

    const drawingSVG = <div ref={svgRef} id="drawingSvg"><svg
        xmlns="http://www.w3.org/2000/svg"
        width={WIDTH + 'in'}
        height={HEIGHT + 'in'}
        viewBox={"0 0 " + WIDTH + " " + HEIGHT}
    >
        <g stroke={GRID_COLOR} strokeWidth={0.01}>
        {grid}
        </g>
        <g transform={"scale(" + 1/DPI +")"}>
        {drawingPaths.map((path, index) => <path key={index} fill="red" stroke="none" d={path} />)}
        </g>
        {starPaths}
    </svg></div>;

    return (
        <div className="App">
            <Menu
                setLineWidth={setLineWidth}
                setIsErasing={setIsErasing}
                isErasing={isErasing}
                onExport={onExport}
                setShowGrid={setShowGrid}
                showGrid={showGrid}
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
                </div>
                
            
        </div>
    );
}

const Menu = ({ setLineWidth, setIsErasing, isErasing, setShowGrid, showGrid, onExport}) => {
  return (
      <div className="Menu">
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
          <label>Show Grid</label>
          <input
              type="checkbox"
              checked={showGrid}
              onChange={(e) => {
                  setShowGrid(e.target.checked);
              }}
          />
          <button onClick={onExport}>Export</button>
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

export default App;