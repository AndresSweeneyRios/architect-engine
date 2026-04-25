import type { vec3 } from "gl-matrix"
import { type WebGPUContext } from "../webgpu"
import { G_BUFFER } from "../webgpu/constants"
import WGSL from './lighting.wgsl?raw'
import { processShaderCompilationErrors } from "../webgpu/pipeline"
import { getIsValid } from "../../utils/version"
import { getGBufferTextureViews } from "./gbuffer"
import { getCameraUniformsBuffer } from "../webgpu/camera"
import { RESOLUTION_VERSION_TYPE_SYMBOL } from "../webgpu/version"

const MAX_LIGHTS = 256
export const LIGHT_STRUCT_LENGTH = 3 + 1 + 3 + 1

const BIND_GROUP_0_SYMBOL = Symbol('Lighting Bind Group 0')
const BIND_GROUP_1_SYMBOL = Symbol('Lighting Bind Group 1')
const BIND_GROUP_2_SYMBOL = Symbol('Lighting Bind Group 2')

const LIGHTING_PIPELINE_SYMBOL = Symbol('Lighting Pipeline')

const createPipeline = async (gpuContext: WebGPUContext) => {
  const shaderModule = gpuContext.device.createShaderModule({
    label: 'Lighting Shader Module',
    code: WGSL,
  })

  await processShaderCompilationErrors(WGSL, shaderModule)

  const pipeline = gpuContext.device.createRenderPipeline({
    layout: 'auto',
    label: 'Lighting Pipeline',
    vertex: {
      module: shaderModule,
      entryPoint: 'vs_main',
      buffers: [],
    },
    fragment: {
      module: shaderModule,
      entryPoint: 'fs_main',
      targets: [
        {
          format: gpuContext.presentationFormat,
        },
      ],
    },
  })

  const layout0 = pipeline.getBindGroupLayout(0)
  layout0.label = 'Lighting Bind Group Layout 0'
  gpuContext.bindGroupLayouts.set(BIND_GROUP_0_SYMBOL, layout0)

  const layout1 = pipeline.getBindGroupLayout(1)
  layout1.label = 'Lighting Bind Group Layout 1'
  gpuContext.bindGroupLayouts.set(BIND_GROUP_1_SYMBOL, layout1)

  const layout2 = pipeline.getBindGroupLayout(2)
  layout2.label = 'Lighting Bind Group Layout 2'
  gpuContext.bindGroupLayouts.set(BIND_GROUP_2_SYMBOL, layout2)

  gpuContext.pipelines.set(LIGHTING_PIPELINE_SYMBOL, pipeline)
}

const getPipeline = (gpuContext: WebGPUContext) => {
  const pipeline = gpuContext.pipelines.get(LIGHTING_PIPELINE_SYMBOL)

  if (!pipeline) {
    throw new Error('Lighting pipeline not found')
  }

  return pipeline
}

const LIGHTS_BUFFER_SYMBOL = Symbol('Lighting Lights Buffer')
const NUM_LIGHTS_BUFFER_SYMBOL = Symbol('Lighting Num Lights Buffer')

const createLightsBuffers = (gpuContext: WebGPUContext) => {
  gpuContext.buffers.get(LIGHTS_BUFFER_SYMBOL)?.destroy();
  gpuContext.buffers.get(NUM_LIGHTS_BUFFER_SYMBOL)?.destroy();

  const lightsBuffer = gpuContext.device.createBuffer({
    label: 'Lighting Lights Buffer',
    size: LIGHT_STRUCT_LENGTH * 4 * MAX_LIGHTS,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  })

  const numLightsBuffer = gpuContext.device.createBuffer({
    label: 'Lighting Num Lights Buffer',
    size: 4,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  })

  gpuContext.buffers.set(LIGHTS_BUFFER_SYMBOL, lightsBuffer)
  gpuContext.buffers.set(NUM_LIGHTS_BUFFER_SYMBOL, numLightsBuffer)
}

const LightsArray = new Float32Array(LIGHT_STRUCT_LENGTH * MAX_LIGHTS)
const NumLightsArray = new Uint32Array(1)

const LIGHT_BUFFER = new Float32Array(LIGHT_STRUCT_LENGTH);

export interface Light {
  position: vec3;
  intensity: number;
  color: vec3;
  range: number;
}

export const writeLightingLightsBuffers = (
  gpuContext: WebGPUContext,
  lights: Iterable<Light>,
) => {
  const buffer = gpuContext.buffers.get(LIGHTS_BUFFER_SYMBOL)!

  if (!buffer) {
    throw new Error('Lighting lights buffer not found')
  }

  const numLightsBuffer = gpuContext.buffers.get(NUM_LIGHTS_BUFFER_SYMBOL)

  if (!numLightsBuffer) {
    throw new Error('Lighting num lights buffer not found')
  }

  const array = LightsArray

  let i = 0

  for (const light of lights) {
    if (i >= MAX_LIGHTS) {
      throw new Error(`Exceeded maximum number of lights: ${MAX_LIGHTS}`)
    }

    LIGHT_BUFFER[0] = light.position[0];
    LIGHT_BUFFER[1] = light.position[1];
    LIGHT_BUFFER[2] = light.position[2];
    LIGHT_BUFFER[3] = light.intensity;
    LIGHT_BUFFER[4] = light.color[0];
    LIGHT_BUFFER[5] = light.color[1];
    LIGHT_BUFFER[6] = light.color[2];
    LIGHT_BUFFER[7] = light.range;

    array.set(LIGHT_BUFFER, i * LIGHT_STRUCT_LENGTH)

    i++
  }

  NumLightsArray[0] = i

  gpuContext.device.queue.writeBuffer(numLightsBuffer, 0, NumLightsArray)
  gpuContext.device.queue.writeBuffer(buffer, 0, array)
}

const gBufferEntries = new Array<GPUBindGroupEntry>(G_BUFFER.length)

const createBindGroup0 = (gpuContext: WebGPUContext) => {
  const layout0 = gpuContext.bindGroupLayouts.get(BIND_GROUP_0_SYMBOL)

  if (!layout0) {
    throw new Error('Lighting layout 0 not found')
  }

  const gBufferViews = getGBufferTextureViews(gpuContext)

  for (let i = 0; i < G_BUFFER.length; i++) {
    const binding = G_BUFFER[i].binding
    const resource = gBufferViews[i]!

    gBufferEntries[i] = {
      binding,
      resource,
    }
  }

  const group0 = gpuContext.device.createBindGroup({
    label: String(BIND_GROUP_0_SYMBOL),
    layout: layout0,
    entries: gBufferEntries,
  })

  gpuContext.bindGroups.set(BIND_GROUP_0_SYMBOL, group0)
}

const createBindGroup1 = (gpuContext: WebGPUContext) => {
  const layout1 = gpuContext.bindGroupLayouts.get(BIND_GROUP_1_SYMBOL)

  if (!layout1) {
    throw new Error('Lighting layout 1 not found')
  }

  const cameraUniformsBuffer = getCameraUniformsBuffer(gpuContext)

  const group1 = gpuContext.device.createBindGroup({
    label: String(BIND_GROUP_1_SYMBOL),
    layout: layout1,
    entries: [
      {
        binding: 0,
        resource: gpuContext.sampler,
      },
      {
        binding: 1,
        resource: {
          buffer: cameraUniformsBuffer,
        },
      },
    ],
  })

  gpuContext.bindGroups.set(BIND_GROUP_1_SYMBOL, group1)
}

const createBindGroup2 = (gpuContext: WebGPUContext) => {
  const layout2 = gpuContext.bindGroupLayouts.get(BIND_GROUP_2_SYMBOL)

  if (!layout2) {
    throw new Error('Lighting layout 2 not found')
  }

  const lightsBuffer = gpuContext.buffers.get(LIGHTS_BUFFER_SYMBOL)
  const numLightsBuffer = gpuContext.buffers.get(NUM_LIGHTS_BUFFER_SYMBOL)

  if (!lightsBuffer) {
    throw new Error('Lighting lights buffer not found')
  }

  if (!numLightsBuffer) {
    throw new Error('Lighting num lights buffer not found')
  }

  const group2 = gpuContext.device.createBindGroup({
    label: String(BIND_GROUP_2_SYMBOL),
    layout: layout2,
    entries: [
      {
        binding: 0,
        resource: {
          buffer: lightsBuffer,
        },
      },
      {
        binding: 1,
        resource: {
          buffer: numLightsBuffer,
        },
      },
    ],
  })

  gpuContext.bindGroups.set(BIND_GROUP_2_SYMBOL, group2)
}

const getBindGroup = (gpuContext: WebGPUContext, symbol: symbol) => {
  const group = gpuContext.bindGroups.get(symbol)

  if (!group) {
    throw new Error(`Lighting group ${String(symbol)} not found`)
  }

  return group
}

export const initLightingShader = async (gpuContext: WebGPUContext) => {
  await createPipeline(gpuContext)

  createLightsBuffers(gpuContext)

  createBindGroup0(gpuContext)
  createBindGroup1(gpuContext)
  createBindGroup2(gpuContext)
}

const LIGHTING_SHADER_VERSION_TYPE_SYMBOL = Symbol('Lighting Shader Version')

export const refreshLightingShader = async (gpuContext: WebGPUContext) => {
  if (getIsValid(RESOLUTION_VERSION_TYPE_SYMBOL, LIGHTING_SHADER_VERSION_TYPE_SYMBOL)) {
    return;
  }

  createBindGroup0(gpuContext)
}

export const drawLightingShader = (
  gpuContext: WebGPUContext,
  commandEncoder: GPUCommandEncoder,
) => {
  const pipeline = getPipeline(gpuContext)

  const currentTextureView = gpuContext.context.getCurrentTexture().createView()

  const lightingPass = commandEncoder.beginRenderPass({
    colorAttachments: [
      {
        view: currentTextureView,
        loadOp: 'clear',
        storeOp: 'store',
        clearValue: { r: 1, g: 0, b: 0, a: 1 },
      }
    ],
    label: 'Lighting Pass',
  });

  lightingPass.setPipeline(pipeline);

  lightingPass.setBindGroup(0, getBindGroup(gpuContext, BIND_GROUP_0_SYMBOL));
  lightingPass.setBindGroup(1, getBindGroup(gpuContext, BIND_GROUP_1_SYMBOL));
  lightingPass.setBindGroup(2, getBindGroup(gpuContext, BIND_GROUP_2_SYMBOL));

  lightingPass.draw(3);

  lightingPass.end();
}
