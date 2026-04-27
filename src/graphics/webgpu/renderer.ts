import type { Simulation } from "../../simulation";
import { mat4 } from "gl-matrix";
import { refreshCamera, writeCameraUniformsBuffer, type Camera } from './camera';
import { refreshDepthTexture } from "../shaders/depth";
import { drawGBufferShader, refreshGBufferShader } from "../shaders/gbuffer";
import { drawLightingShader, Light, refreshLightingShader, writeLightingLightsBuffers } from "../shaders/lighting";
import { MAX_FRAMES_IN_FLIGHT } from "./constants";
import { writeWorldMatrix } from "./mesh";
import type { WebGPUContext } from ".";

let framesInFlight = 0;

/**
 * Draw the current simulation state using WebGPU.
 * 
 * @see {@link WebGPUContext} for details about the GPU state.
 */
export const draw = (simulation: Simulation) => {
  if (framesInFlight > MAX_FRAMES_IN_FLIGHT) {
    return;
  }

  const { gpuContext } = simulation;
  const { device, canvas } = gpuContext;
  const camera = simulation.Camera;

  const state = simulation.SimulationState;

  if (canvas.width === 0 || canvas.height === 0) {
    console.warn('Skipped draw call because the canvas has zero size.');
    return;
  }

  refreshCamera(gpuContext, camera);
  refreshDepthTexture(gpuContext);
  refreshGBufferShader(gpuContext);
  refreshLightingShader(gpuContext);

  const commandEncoder = device.createCommandEncoder({
    label: 'Default Command Encoder',
  });

  const lights: Light[] = [];

  for (const entId of state.LightRepository.Components) {
    const position = state.TransformRepository.GetWorldTranslation(entId);
    const intensity = state.LightRepository.GetIntensity(entId);
    const color = state.LightRepository.GetColor(entId);
    const range = state.LightRepository.GetRange(entId);

    lights.push({
      position,
      intensity,
      color,
      range,
    });
  }

  writeCameraUniformsBuffer(gpuContext, camera);

  // TODO: detect invalidations for lights
  writeLightingLightsBuffers(gpuContext, lights);

  const meshComponents = state.MeshRepository.Components;

  const meshes: symbol[] = [];

  for (const entId of meshComponents) {
    const meshSymbol = state.MeshRepository.GetSymbol(entId);
    meshes.push(meshSymbol);

    const worldMatrix = state.TransformRepository.GetWorldMatrix(entId);

    // TODO: detect invalidations for world matrices
    writeWorldMatrix(gpuContext, meshSymbol, worldMatrix);

    const bones = gpuContext.meshBones.get(meshSymbol);
    const boneBuffer = gpuContext.meshBoneBuffers.get(meshSymbol);
    const skinData = gpuContext.meshSkinData.get(meshSymbol);

    if (bones && boneBuffer && skinData) {
      const boneCount = Math.min(bones.length, skinData.boneInverses.length, 64);
      const finalMatrix = mat4.create();
      const finalMatrixArray = finalMatrix as Float32Array;

      for (let i = 0; i < boneCount; i++) {
        const boneEntId = bones[i];
        if (!boneEntId) {
          continue;
        }

        const boneInverse = skinData.boneInverses[i];
        if (!boneInverse) {
          continue;
        }

        const boneWorldMatrix = state.TransformRepository.GetWorldMatrix(boneEntId);

        mat4.multiply(finalMatrix, boneWorldMatrix, boneInverse);

        gpuContext.device.queue.writeBuffer(
          boneBuffer,
          i * 64,
          finalMatrixArray.buffer as ArrayBuffer,
          finalMatrixArray.byteOffset,
          finalMatrixArray.byteLength
        );
      }
    }
  }

  drawGBufferShader(gpuContext, commandEncoder, meshes);
  drawLightingShader(gpuContext, commandEncoder);

  framesInFlight++

  const submittedWorkDone = device.queue.onSubmittedWorkDone().then(() => {
    framesInFlight--;
  });

  device.queue.submit([commandEncoder.finish()]);

  return submittedWorkDone;
};
