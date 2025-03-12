import { useEffect, useRef, useState } from "react";
import "./App.css";
import "./imagetracer_v1.2.6.js";

const DPI = 96; // pixels per inch

// in inches
const WIDTH = 7;
const HEIGHT = 7;

const WIDTH_PIXELS = WIDTH * DPI;
const HEIGHT_PIXELS = HEIGHT * DPI;

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
        computeCtxRef.current.closePath();
        viewCtxRef.current.closePath();
        setIsDrawing(false);

        const options = { strokewidth: 0 }; // Any option can be omitted which will be set to the default
        // Adding custom palette. This will override numberofcolors.
        options.pal = [{ r: 255, g: 0, b: 0, a: 255 }, { r: 255, g: 255, b: 255, a: 255 }];
        const data = window.ImageTracer.getImgdata(computeCanvasRef.current);
        const paths = window.ImageTracer.imagedataToSVG(data, options);
        setDrawingPaths(paths);

        viewCtxRef.current.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    };

    const draw = (e) => {
        e.preventDefault();
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

    const drawingSVG = <div ref={svgRef} id="drawingSvg"><svg
        xmlns="http://www.w3.org/2000/svg"
        width={WIDTH + 'in'}
        height={HEIGHT + 'in'}
        viewBox={"0 0 " + WIDTH + " " + HEIGHT}
    >
        <g transform={"scale(" + 1/DPI +")"}>
        {drawingPaths.map((path, index) => <path key={index} fill="red" stroke="none" d={path} />)}
        </g>
    </svg></div>;

    return (
        <div className="App">
            <h1>Paint App</h1>
            <div className="draw-area">
                
            </div>
            <canvas
                id="computeCanvas"
                ref={computeCanvasRef}
                width={WIDTH_PIXELS + `px`}
                height={HEIGHT_PIXELS + `px`}
            />
            {drawingSVG}
            <canvas
                    id="drawingCanvas"
                    onPointerDown={startDrawing}
                    onPointerUp={endDrawing}
                    onPointerMove={draw}
                    ref={canvasRef}
                    width={WIDTH_PIXELS + `px`}
                    height={HEIGHT_PIXELS + `px`}
                />
                
            <Menu
                setLineWidth={setLineWidth}
                setIsErasing={setIsErasing}
                isErasing={isErasing}
                onExport={onExport}
            />
        </div>
    );
}

const Menu = ({ setLineWidth, setIsErasing, isErasing, onExport}) => {
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
          <input
              type="checkbox"
              checked={isErasing}
              onChange={(e) => {
                  setIsErasing(e.target.checked);
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