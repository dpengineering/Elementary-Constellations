import React, { useEffect, useRef } from "react";
import etro from "etro";
import { GRID_HEIGHT, GRID_WIDTH, gridXtoSVGX, gridYtoSVGY } from "./Grid";
import { DPI } from "./App";

export default function Movie({ threshold, ref }) {
  const movieRef = useRef();
  const effectRef = useRef();

  useEffect(() => {
    // Use the canvas ref to get the canvas element
    const canvas = ref.current;

    // Create a new movie instance
    const movie = new etro.Movie({ canvas });

    // Get the user's webcam stream
    navigator.mediaDevices
      .getUserMedia({
        video: "true",
        facingMode: { ideal: "environment" },
        width: { min: 640, exact: 640, max: 640 },
        height: { exact: 480 },
        aspectRatio: 1.33333333333,
      })

      // Create a video element from the stream
      .then((stream) => {
        const video = document.createElement("video");
        video.srcObject = stream;
        return new Promise((resolve) => {
          video.onloadedmetadata = () => {
            resolve(video);
          };
        });
      })

      // Add a video layer to the movie and play it
      .then((video) => {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const layer = new etro.layer.Video({
          startTime: 0,
          source: video,
        });
        const effect = new ThresholdEffect();
        layer.addEffect(effect);
        movie.addLayer(layer);
        movie.play();
        movieRef.current = movie;
        effectRef.current = effect;
      });
  }, []);

  useEffect(() => {
    if (effectRef.current) {
      effectRef.current.threshold = threshold;
    }
  }, [threshold]);

  const WEBCAM_VIEW_X = gridXtoSVGX(-1) * DPI;
  const WEBCAM_VIEW_Y = gridYtoSVGY(GRID_HEIGHT) * DPI;
  const WEBCAM_WIDTH = gridXtoSVGX(GRID_WIDTH) * DPI - WEBCAM_VIEW_X;
  const WEBCAM_HEIGHT = gridYtoSVGY(-1) * DPI - WEBCAM_VIEW_Y;

  return (
    <canvas
      ref={ref}
      className="drawingCanvas"
      style={{
        top: WEBCAM_VIEW_Y,
        left: WEBCAM_VIEW_X,
        width: WEBCAM_WIDTH,
        height: WEBCAM_HEIGHT,
      }}
    />
  );
}

class ThresholdEffect extends etro.effect.Shader {
  constructor(options = {}) {
    super({
      fragmentSource: `
            precision highp float;
    
            uniform sampler2D u_Source;
            uniform float u_Threshold;
    
            varying vec2 v_TextureCoord;
    
            void main() {
              vec4 color = texture2D(u_Source, v_TextureCoord);
              float luminance = dot(color.rgb, vec3(0.2126, 0.7152, 0.0722));
              if (luminance > u_Threshold) {
               gl_FragColor = vec4(1,1,1,1);
              } else {
               gl_FragColor = vec4(0.5,0.5,0.5,1);
              }
            }
          `,
      uniforms: {
        threshold: "1f",
      },
    });

    this.threshold = options.threshold || 0.5;
  }
}