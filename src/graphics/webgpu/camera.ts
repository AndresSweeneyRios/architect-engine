import { mat4, vec3, type ReadonlyVec3 } from 'gl-matrix';
import { type WebGPUContext } from "./";
import { getIsValid } from "../../utils/version";
import { RESOLUTION_VERSION_TYPE_SYMBOL } from "./version";

const CAMERA_UNIFORMS_SIZE = 16 + 16 + 4 // viewProjectionMatrix, inverseView, time
const CAMERA_UNIFORM_BUFFER_SYMBOL = Symbol('Camera Uniform Buffer')

const CameraUniformsArray = new Float32Array(CAMERA_UNIFORMS_SIZE)

export const createCameraUniformsBuffer = (gpuContext: WebGPUContext) => {
  const buffer = gpuContext.device.createBuffer({
    label: 'Camera Uniform Buffer',
    size: CAMERA_UNIFORMS_SIZE * 4,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  })

  gpuContext.buffers.set(CAMERA_UNIFORM_BUFFER_SYMBOL, buffer)
}

export const getCameraUniformsBuffer = (gpuContext: WebGPUContext) => {
  const buffer = gpuContext.buffers.get(CAMERA_UNIFORM_BUFFER_SYMBOL)

  if (!buffer) {
    throw new Error('Camera uniform buffer not found')
  }

  return buffer
}

export const writeCameraUniformsBuffer = (
  gpuContext: WebGPUContext,
  camera: Camera
) => {
  camera.updateViewProjectionMatrix();

  const buffer = getCameraUniformsBuffer(gpuContext)

  CameraUniformsArray.set(camera.viewProjectionMatrix, 0)
  CameraUniformsArray.set(camera.inverseViewMatrix, 16)
  CameraUniformsArray[32] = performance.now() / 1000

  gpuContext.device.queue.writeBuffer(buffer, 0, CameraUniformsArray)
}

let cameraIndex = 0;

export const createCamera = (
  fovDegrees: number,
  near: number,
  far: number
) => {
  const symbol = Symbol(`Camera ${cameraIndex++}`);

  let _fovDeg = fovDegrees;
  let _aspect = 0;
  let _near = near;
  let _far = far;

  // Single buffer layout:
  // position: 0-2 (3 floats)
  // target: 3-5 (3 floats)
  // up: 6-8 (3 floats)
  // projectionMatrix: 9-24 (16 floats)
  // viewMatrix: 25-40 (16 floats)
  // viewProjectionMatrix: 41-56 (16 floats)
  // inverseViewMatrix: 57-72 (16 floats)
  // matrixData: 73-88 (16 floats)
  const buffer = new Float32Array(89);

  // Create views into the buffer
  const position = buffer.subarray(0, 3) as vec3;
  const target = buffer.subarray(3, 6) as vec3;
  const up = buffer.subarray(6, 9) as vec3;
  const projectionMatrix = buffer.subarray(9, 25) as mat4;
  const viewMatrix = buffer.subarray(25, 41) as mat4;
  const viewProjectionMatrix = buffer.subarray(41, 57) as mat4;
  const inverseViewMatrix = buffer.subarray(57, 73) as mat4;
  const matrixData = buffer.subarray(73, 89);

  // Initialize default values
  vec3.set(position, -5, 0, 0);
  vec3.set(target, 0, 0, 0);
  vec3.set(up, 0, 1, 0);

  const updateViewProjectionMatrix = () => {
    const fovRadians = (_fovDeg * Math.PI) / 180;
    mat4.perspective(projectionMatrix, fovRadians, _aspect, _near, _far);
    mat4.lookAt(viewMatrix, position, target, up);
    mat4.multiply(viewProjectionMatrix, projectionMatrix, viewMatrix);
    mat4.invert(inverseViewMatrix, viewMatrix);
    matrixData.set(viewProjectionMatrix, 0);
  };

  const setAspect = (nextAspect: number) => {
    _aspect = nextAspect;
    updateViewProjectionMatrix();
  };

  const setClippingPlanes = (nearPlane: number, farPlane: number) => {
    _near = nearPlane;
    _far = farPlane;
    updateViewProjectionMatrix();
  };

  const setFovDegrees = (nextFovDegrees: number) => {
    _fovDeg = nextFovDegrees;
    updateViewProjectionMatrix();
  };

  const lookAt = (newPosition: ReadonlyVec3, newTarget: ReadonlyVec3, newUp: ReadonlyVec3 = up) => {
    vec3.copy(position, newPosition);
    vec3.copy(target, newTarget);
    vec3.copy(up, newUp);
    updateViewProjectionMatrix();
  };

  const setPosition = (newPosition: ReadonlyVec3) => {
    vec3.copy(position, newPosition);
  };

  const setRotation = (yawDegrees: number, pitchDegrees: number) => {
    const yaw = (yawDegrees * Math.PI) / 180;
    const pitch = (pitchDegrees * Math.PI) / 180;

    const x = Math.cos(pitch) * Math.cos(yaw);
    const y = Math.sin(pitch);
    const z = Math.cos(pitch) * Math.sin(yaw);

    vec3.set(target, position[0] + x, position[1] + y, position[2] + z);
  };

  const getDirection = () => {
    const direction = vec3.create();
    vec3.subtract(direction, target, position);
    vec3.normalize(direction, direction);
    return direction;
  }

  updateViewProjectionMatrix();

  return {
    symbol,
    position,
    target,
    up,
    viewMatrix,
    inverseViewMatrix,
    projectionMatrix,
    viewProjectionMatrix,
    updateViewProjectionMatrix,
    setAspect,
    setClippingPlanes,
    setFovDegrees,
    lookAt,
    setPosition,
    setRotation,
    getDirection,
  };
};

export const refreshCamera = (gpuContext: WebGPUContext, camera: Camera) => {
  if (getIsValid(RESOLUTION_VERSION_TYPE_SYMBOL, camera.symbol)) {
    return
  }

  const aspect = gpuContext.canvas.width / gpuContext.canvas.height;
  camera.setAspect(aspect);
}

export type Camera = ReturnType<typeof createCamera>
