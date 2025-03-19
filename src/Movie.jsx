import React, { useEffect, useRef } from "react";
import etro from "etro";
import { CANVAS_OFFSET_X, CANVAS_OFFSET_Y, CANVAS_WIDTH, CANVAS_HEIGHT } from "./App";

export default function Movie({ threshold, ref }) {
  const movieRef = useRef();
  const effectRef = useRef();
  const streamRef = useRef();
  const videoRef = useRef();

  useEffect(() => {
    // Use the canvas ref to get the canvas element
    const canvas = ref.current;

    // Create a new movie instance
    const movie = new etro.Movie({ canvas });

    console.log('mounting');

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
        streamRef.current = stream;
        const video = document.createElement("video");
        videoRef.current = video;
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
        console.log('test!');
      });
      return unMount;
  }, []);

  function unMount() {
    if (!videoRef.current)
      return;
    console.log('unmounting', streamRef.current);
    movieRef.current.pause();
    /*
    streamRef.current && streamRef.current.getTracks().forEach(function(track) {
      console.log('stopping track', track);
      track.stop();
    });
    movieRef.current && movieRef.current.pause();
    videoRef.current && (videoRef.current.src = null);

    const video = container.querySelector('.video-streamer');
    */

    for (const track of videoRef.current.srcObject.getTracks()) {
      track.stop();
    }
    videoRef.current.srcObject = null;

    videoRef.current = null;
    effectRef.current = null;
    streamRef.current = null;
    movieRef.current = null;
  }

  useEffect(() => {
    if (effectRef.current) {
      effectRef.current.threshold = threshold;
    }
  }, [threshold]);

  return (
    <canvas
      ref={ref}
      className="drawingCanvas"
      width={640}
      height={480}
      style={{
        top: CANVAS_OFFSET_X,
        left: CANVAS_OFFSET_Y,
        width: 640,
        height: 480,
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