import { useEffect, useRef, useState } from "react";
import "./App.css";
import "./imagetracer_v1.2.6.js";

function App() {
    const canvasRef = useRef(null);
    const ctxRef = useRef(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [lineWidth, setLineWidth] = useState(5);
    const [isErasing, setIsErasing] = useState(false);
    const lineColor = "black";
    const [svgSrc, setSvgSrc] = useState(null);
    const [svgSrc2, setSvgSrc2] = useState(null);
    const [currentPath, setCurrentPath] = useState(null);

    // Initialization when the component
    // mounts for the first time
    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.strokeStyle = lineColor;
        ctx.lineWidth = lineWidth;
        ctxRef.current = ctx;
    }, [lineColor, lineWidth]);

    // Function for starting the drawing
    const startDrawing = (e) => {
        if (isErasing) {
          ctxRef.current.globalCompositeOperation="destination-out";
        } else {
          ctxRef.current.globalCompositeOperation="source-over";
        }
        
        ctxRef.current.beginPath();
        ctxRef.current.moveTo(
            e.nativeEvent.offsetX,
            e.nativeEvent.offsetY
        );
        setCurrentPath(`M${e.nativeEvent.offsetX} ${e.nativeEvent.offsetY}`);
        setIsDrawing(true);
    };

    // Function for ending the drawing
    const endDrawing = () => {
        ctxRef.current.closePath();
        setIsDrawing(false);


        setSvgSrc2((prevSvgSrc2) => prevSvgSrc2 + `<path d="${currentPath}" fill="none" stroke="${lineColor}" stroke-width="${lineWidth}"/>`);
        setCurrentPath(null);
        // ctxRef.current.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    };

    const draw = (e) => {
        if (!isDrawing) {
            return;
        }
        ctxRef.current.lineTo(
            e.nativeEvent.offsetX,
            e.nativeEvent.offsetY
        );


        setCurrentPath((prevPath) => 
            ( prevPath + ` L${e.nativeEvent.offsetX} ${e.nativeEvent.offsetY}`)
        );

        ctxRef.current.stroke();
    };
    //onExport={() => downloadSVG(svgSrc, Date.now())}

    const svg2 = `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" version="1.1" desc="Created with imagetracer.js version 1.2.6">` + svgSrc2 + `</svg>`

    return (
        <div className="App">
            <h1>Paint App</h1>
            <div className="draw-area">
                <Menu
                    setLineWidth={setLineWidth}
                    setIsErasing={setIsErasing}
                    isErasing={isErasing}
                    onExport={() => {
                        const options = {strokewidth: 0, viewbox: false, blurradius: 1, colorsampling: 0}; // Any option can be omitted which will be set to the default
                        // Adding custom palette. This will override numberofcolors.
                        options.pal = [{r:255,g:0,b:0,a:255}, {r:255,g:255,b:255,a:255}];
                        console.log(options);
                        const data = window.ImageTracer.getImgdata(canvasRef.current);
                        const svg = window.ImageTracer.imagedataToSVG(data, options);
                        console.log(svg);
                        setSvgSrc(svg);
                    }}
                />
                <canvas
                    onMouseDown={startDrawing}
                    onMouseUp={endDrawing}
                    onMouseMove={draw}
                    ref={canvasRef}
                    width={`500px`}
                    height={`500px`}
                />
            </div>
            <img
            draggable="false"
            src={"data:image/svg+xml ;charset=utf-8," + encodeURIComponent(svgSrc)} alt="SVG Preview"
            />
            <img
            draggable="false"
            src={"data:image/svg+xml ;charset=utf-8," + encodeURIComponent(svg2)} alt="SVG Preview"
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