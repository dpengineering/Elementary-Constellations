import {gridXtoSVGX, gridYtoSVGY, GRID_WIDTH, GRID_HEIGHT} from "./Grid.jsx";
import {DPI} from "./App.jsx";


export function renderWebcamtoViewCanvas(
  webcamRef,
  webcamCtxRef,
  webcamCanvasRef,
  viewCtxRef,
  threshold
) {
  const imageSrc = webcamRef.current.getScreenshot();
  const image = new Image();
  image.onload = function () {
    webcamCtxRef.current.drawImage(image, 0, 0);
    renderThreshold(webcamCtxRef, viewCtxRef, webcamCanvasRef, threshold);
  };
  image.src = imageSrc;
}

export function renderThreshold(webcamCtxRef, viewCtxRef, webcamCanvasRef, threshold) {
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
  viewCtxRef.current.putImageData(
    imgData,
    x,
    y,
    0,
    0,
    gridXtoSVGX(GRID_WIDTH) * DPI - x,
    gridYtoSVGY(-1) * DPI - y
  );
  return imgData;
}
