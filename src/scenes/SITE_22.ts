import { gpuContext } from '../components/Viewport';
import { requestFullscreen, requestPointerLock } from "../utils/requestFullscreen";
import { vec3 } from "gl-matrix";
import { Simulation } from "../simulation";
import { PlayerCameraView } from "../views/playerCamera";
import { createRenderLoop } from "../simulation/loop";
import { initScene } from "../utils/initScene";
import { View } from "../simulation/View";

const PIVOT_DISTANCE = 60;
const PIVOT_HEIGHT = 40;
const PIVOT_SPEED = -20;
const PIVOT_ORIGIN = vec3.fromValues(-4, -5, 2);

export const init = async (): Promise<() => void> => {
  const simulation = new Simulation(gpuContext);

  await initScene(simulation, {
    scene: "3d_scenes_TOKYO_TOKYO_gltf"
  });

  simulation.Camera.lookAt([-10, 0, 0], [0, 0, 0]);


  let pivotYaw = 0;

  const cameraRotationView = new class extends View {
    public Draw(simulation: Simulation, lerpFactor: number, delta: number): void {
      const radians = (pivotYaw * Math.PI) / 180;
      const x = Math.cos(radians) * PIVOT_DISTANCE;
      const z = Math.sin(radians) * PIVOT_DISTANCE;
      const y = PIVOT_HEIGHT;

      playerCamera.setPosition(vec3.fromValues(x, y, z));
      playerCamera.lookAt(PIVOT_ORIGIN);

      pivotYaw += PIVOT_SPEED * delta;
    }
  }

  simulation.ViewSync.AddAuxiliaryView(cameraRotationView);

  const clickHandler = () => {
    requestPointerLock(gpuContext.canvas);
    requestFullscreen();

    simulation.ViewSync.DestroyAuxiliaryView(simulation, cameraRotationView.Symbol);
  }

  window.addEventListener('click', clickHandler);

  const playerCamera = new PlayerCameraView(simulation.Camera, {
    initialPosition: vec3.fromValues(0, 2, 0),
    initialYaw: 90,
    initialPitch: 0,
    movementSpeed: 30,
    lookSensitivity: 0.12,
    maxPitch: 89,
    minPitch: -89,
  });

  simulation.ViewSync.AddAuxiliaryView(playerCamera);

  const stopRenderLoop = createRenderLoop(simulation);

  return () => {
    stopRenderLoop();
    window.removeEventListener('click', clickHandler);
  };
};
