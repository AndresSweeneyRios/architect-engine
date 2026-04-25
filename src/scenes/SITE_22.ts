import { gpuContext } from '../components/Viewport';
import { requestFullscreen, requestPointerLock } from "../utils/requestFullscreen";
import { vec3 } from "gl-matrix";
import { Simulation } from "../simulation";
import { PlayerCameraView } from "../views/playerCamera";
import { createRenderLoop } from "../simulation/loop";
import { initScene } from "../utils/initScene";

export const init = async (): Promise<() => void> => {
  const simulation = new Simulation(gpuContext);

  await initScene(simulation, {
    scene: "3d_scenes_SITE_22_SITE_22_gltf"
  });

  simulation.Camera.lookAt([-10, 0, 0], [0, 0, 0]);

  const clickHandler = () => {
    requestPointerLock(gpuContext.canvas);
    requestFullscreen();
  }

  window.addEventListener('click', clickHandler);

  const playerCamera = new PlayerCameraView(simulation.Camera, {
    initialPosition: vec3.fromValues(-10, 1, 0),
    initialYaw: 0,
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
