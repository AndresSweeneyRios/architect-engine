import { setTypeVersion } from "../../utils/version"
import { initGBufferShader } from "../shaders/gbuffer"
import { initLightingShader } from "../shaders/lighting"
import { createCameraUniformsBuffer } from "./camera"
import type { EntId } from "../../simulation/EntityRegistry"
import { RESOLUTION_VERSION_TYPE_SYMBOL } from "./version"

export interface MeshSkinData {
  bindMatrix: Float32Array
  bindMatrixInverse: Float32Array
  boneInverses: Float32Array[]
}

/**
 * This initializes the GPU pipelines and builds the entire WebGPU state, 
 * including meshes and materials bound to the GPUs.
 * 
 * It uses a memory-dense configuration using symbols and maps.
 */
export const initWebGPUContext = async (canvas: HTMLCanvasElement) => {
  if (!navigator.gpu) {
    throw new Error("WebGPU not supported on this browser.")
  }

  const adapter = await navigator.gpu.requestAdapter()

  if (!adapter) {
    throw new Error("No GPU adapter found.")
  }

  const device = await adapter.requestDevice({
    requiredLimits: {
      maxColorAttachmentBytesPerSample: 64,
    },
  })
  const context = canvas.getContext('webgpu')

  if (!context) {
    throw new Error("Failed to get WebGPU context from canvas.")
  }

  const presentationFormat = navigator.gpu.getPreferredCanvasFormat()

  const sampler = device.createSampler({
    magFilter: 'nearest',
    minFilter: 'nearest',
    addressModeU: 'repeat',
    addressModeV: 'repeat',
    label: 'Default Sampler',
  })

  context.configure({
    device,
    format: presentationFormat,
    alphaMode: 'opaque',
  })

  const pipelines = new Map<symbol, GPURenderPipeline>()
  const buffers = new Map<symbol, GPUBuffer>()
  const textures = new Map<symbol, GPUTexture>()
  const bindGroups = new Map<symbol, GPUBindGroup>()
  const bindGroupLayouts = new Map<symbol, GPUBindGroupLayout>()
  const views = new Map<symbol, GPUTextureView>()
  const materials = new Map<string, symbol>()
  const meshes = new Map<string, symbol>()
  const meshMaterials = new Map<symbol, symbol>()
  const meshBones = new Map<symbol, EntId[]>()
  const meshBoneBuffers = new Map<symbol, GPUBuffer>()
  const meshSkinData = new Map<symbol, MeshSkinData>()
  const indexBuffers = new Map<symbol, symbol>()
  const indexCounts = new Map<symbol, number>()
  const vertexBuffers = new Map<symbol, symbol>()

  const gpuContext = {
    device,
    adapter,
    canvas,
    context,
    sampler,
    presentationFormat,

    pipelines,
    buffers,
    textures,
    bindGroups,
    bindGroupLayouts,
    views,
    materials,
    meshes,
    meshMaterials,
    meshBones,
    meshBoneBuffers,
    meshSkinData,
    indexBuffers,
    indexCounts,
    vertexBuffers,
  }

  createCameraUniformsBuffer(gpuContext)

  await initGBufferShader(gpuContext)
  await initLightingShader(gpuContext)

  console.log("WebGPU successfully initialized!", gpuContext)

  return gpuContext
}

export type WebGPUContext = Awaited<ReturnType<typeof initWebGPUContext>>

export const destroyWebGPUContext = (gpuContext: WebGPUContext) => {
  gpuContext.buffers.forEach(buffer => buffer.destroy())
  gpuContext.textures.forEach(texture => texture.destroy())

  for (const key in gpuContext) {
    const object = gpuContext[key as keyof WebGPUContext]

    if (object instanceof Map) {
      object.clear()
    }
  }

  gpuContext.device.destroy()

  console.log("WebGPU context destroyed.")
}

export const setCanvasSize = (gpuContext: WebGPUContext, width: number, height: number) => {
  const safeWidth = Math.max(1, Math.floor(width / 2) * 2)
  const safeHeight = Math.max(1, Math.floor(height / 2) * 2)

  const needsResize = gpuContext.canvas.width !== safeWidth || gpuContext.canvas.height !== safeHeight

  if (!needsResize) {
    return
  }

  gpuContext.canvas.width = safeWidth
  gpuContext.canvas.height = safeHeight

  const version = Symbol(`Resolution Version ${safeWidth}x${safeHeight} ${performance.now()}`)

  setTypeVersion(RESOLUTION_VERSION_TYPE_SYMBOL, version)
}
