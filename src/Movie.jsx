import React, { useEffect, useRef } from "react";
import etro from "etro";
import { CANVAS_OFFSET_X, CANVAS_OFFSET_Y, CANVAS_WIDTH, CANVAS_HEIGHT } from "./App";

export function Movie({ threshold, ref }) {
  const movieRef = useRef();
  const effectRef = useRef();
  const streamRef = useRef();

  useEffect(() => {
    // Use the canvas ref to get the canvas element
    const canvas = ref.current;

    // Create a new movie instance
    const movie = new etro.Movie({ canvas });
    movie.width = CANVAS_WIDTH;
    movie.height = CANVAS_HEIGHT;

    let hasUnmounted = false;

    // Get the user's webcam stream
    navigator.mediaDevices
      .getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
        },
      })

      // Create a video element from the stream
      .then((stream) => {
        streamRef.current = stream;
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
        const layer = new etro.layer.Video({
          startTime: 0,
          source: video,
          destWidth: 640,
          destHeight: 480,
        });
        const effect = new ThresholdEffect();
        layer.addEffect(effect);
        movie.addLayer(layer);
        movie.play();
        movieRef.current = movie;
        effectRef.current = effect;
        if (hasUnmounted) {
          streamRef.current.getTracks().forEach(function(track) {
            track.stop();
          });
        } 
      });
      return () => {
        hasUnmounted = true;
        streamRef.current && streamRef.current.getTracks().forEach(function(track) {
            track.stop();
          });
      }
  }, []);

  useEffect(() => {
    if (effectRef.current) {
      effectRef.current.threshold = threshold;
    }
  }, [threshold]);

  return (
    <canvas
      ref={ref}
      className="drawingCanvas"
      width={CANVAS_WIDTH}
      height={CANVAS_HEIGHT}
      style={{
        top: CANVAS_OFFSET_X,
        left: CANVAS_OFFSET_Y,
        width: CANVAS_WIDTH,
        height: CANVAS_HEIGHT,
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