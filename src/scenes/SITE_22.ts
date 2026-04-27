import { gpuContext } from '../components/Viewport';
import { requestFullscreen, requestPointerLock } from "../utils/requestFullscreen";
import { vec3 } from "gl-matrix";
import { Simulation } from "../simulation";
import { PlayerCameraView } from "../views/playerCamera";
import { createRenderLoop } from "../simulation/loop";
import { initScene } from "../utils/initScene";
import { View } from "../simulation/View";

export const init = async (): Promise<() => void> => {
  const simulation = new Simulation(gpuContext);

  await initScene(simulation, {
    scene: "3d_scenes_TOKYO_TOKYO_gltf"
  });

  simulation.Camera.lookAt([-10, 0, 0], [0, 0, 0]);

  const cameraRotationView = new class extends View {
    public Draw(simulation: Simulation, lerpFactor: number, delta: number): void {
      playerCamera.incrementRotation(10 * delta, 0);
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
    movementSpeed: 10,
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
