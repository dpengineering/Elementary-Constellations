import {gridXtoSVGX, gridYtoSVGY, GRID_WIDTH, GRID_HEIGHT} from "./Grid.jsx";
import {DPI} from "./App.jsx";


export function renderWebcamtoViewCanvas(
  webcamRef,
  webcamCtxRef,
  viewCtxRef,
  threshold,
) {
  renderThreshold(webcamCtxRef, viewCtxRef, webcamRef, threshold);
}

export function filterImageData(imgData) {
  let d = imgData.data,
    i = 0,
    l = d.length;
  const light = [0, 0, 0, 0],
    dark = [0, 0, 0, 255];

  while ((l -= 4 > 0)) {
    [d[i], d[i + 1], d[i + 2], d[i + 3]] = d[i] === 255 ? light : dark;
    i += 4;
  }
  return imgData;
}
