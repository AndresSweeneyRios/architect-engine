import * as React from "react"

import { RENDERER } from "../../constants"
import { loadSceneFromQuery, Scene, unloadScene } from "../scenes/_index"
import { destroyWebGPUContext, initWebGPUContext, setCanvasSize, type WebGPUContext } from "../graphics/webgpu"

export let canvas: HTMLCanvasElement = null!
export let gpuContext: WebGPUContext = null!

export const Viewport: React.FC<{
  scene?: Scene
}> = (props) => {
  const canvasRef = React.useRef<HTMLCanvasElement>(null)

  const init = React.useCallback(async () => {
    try {
      if (canvas) return
      if (!canvasRef.current) return
  
      canvas = canvasRef.current
  
      gpuContext = await initWebGPUContext(canvas)
  
      const resize = () => {
        if (!RENDERER.limitResolution) {
          setCanvasSize(gpuContext, window.innerWidth, window.innerHeight)
          return
        }

        const ensureEven = (value: number) => value % 2 === 0 ? value : value - 1;

        const windowWidth = ensureEven(window.innerWidth);
        const windowHeight = ensureEven(window.innerHeight);

        canvas.style.position = 'absolute';
        canvas.style.left = '0';
        canvas.style.top = '0';
        canvas.style.right = 'auto';
        canvas.style.bottom = 'auto';
        canvas.style.margin = '0';

        if (!RENDERER.limitResolution) {
          setCanvasSize(gpuContext, windowWidth, windowHeight)
          canvas.style.width = `${windowWidth}px`;
          canvas.style.height = `${windowHeight}px`;
          return
        }

        const targetHeight = RENDERER.height;
        
        // Find the greatest common divisor to determine the nearest ideal scale factor

        const getGreatestCommonDivisor = (a: number, b: number): number => b ? getGreatestCommonDivisor(b, a % b) : a;
        const greatestCommonDivisor = getGreatestCommonDivisor(windowWidth, windowHeight);

        let candidateScaleFactors: number[] = [];

        for (let i = 1; i <= greatestCommonDivisor; i++) {
          if (greatestCommonDivisor % i === 0) {
            candidateScaleFactors.push(i);
          }
        }

        let bestS = candidateScaleFactors[0];
        let bestDiff = Infinity;

        for (const s of candidateScaleFactors) {
          const candidateCanvasHeight = windowHeight / s;
          const diff = Math.abs(candidateCanvasHeight - targetHeight);

          if (diff < bestDiff) {
            bestDiff = diff;
            bestS = s;
          }
        }

        const canvasHeight = windowHeight / bestS;
        const canvasWidth  = windowWidth / bestS;
        const displayWidth = canvasWidth * bestS;
        const displayHeight = canvasHeight * bestS;

        canvas.style.width = `${displayWidth}px`;
        canvas.style.height = `${displayHeight}px`;

        setCanvasSize(gpuContext, canvasWidth, canvasHeight);
      };
  
      window.addEventListener("resize", resize)
      resize()
  
      loadSceneFromQuery(props.scene)
  
      return () => {
        unloadScene()
  
        window.removeEventListener("resize", resize)
      }
    } catch (err) {
      console.error('Error initializing WebGPU:', err);
    }
  }, [])

  React.useEffect(() => {
    init();
    
    return () => {
      unloadScene()

      if (gpuContext) {
        destroyWebGPUContext(gpuContext)
      }
    }
  }, [])

  return (
    <canvas
      id="viewport"
      ref={canvasRef}
    />
  )
}
