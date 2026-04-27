import WGSL from './gbuffer.wgsl?raw';
import { processShaderCompilationErrors } from "../webgpu/pipeline"
import { getIsValid } from "../../utils/version"
import { type WebGPUContext } from "../webgpu/index"
import { G_BUFFER, G_BUFFER_TARGETS, G_BUFFER_TEXTURE_USAGE, INDEX_FORMAT as VERTEX_INDEX_FORMAT } from "../webgpu/constants";
import { getCameraUniformsBuffer } from "../webgpu/camera";
import { getDepthTextureView } from "./depth";
import { RESOLUTION_VERSION_TYPE_SYMBOL } from "../webgpu/version";

export const BIND_GROUP_0_SYMBOL = Symbol('G-Buffer Bind Group 0')
export const BIND_GROUP_1_SYMBOL = Symbol('G-Buffer Bind Group 1')
export const BIND_GROUP_2_SYMBOL = Symbol('G-Buffer Bind Group 2')

const BIND_GROUPS_COUNT = 3

const G_BUFFER_PIPELINE_SYMBOL = Symbol('G-Buffer Pipeline')

const createPipeline = async (gpuContext: WebGPUContext) => {
  const shaderModule = gpuContext.device.createShaderModule({
    label: 'G-Buffer Shader Module',
    code: WGSL,
  })

  await processShaderCompilationErrors(WGSL, shaderModule)

  const bindGroupLayout0 = gpuContext.device.createBindGroupLayout({
    label: 'G-Buffer Bind Group Layout 0',
    entries: [
      { binding: 0, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' } },
      { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' } },
      { binding: 2, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' } },
      { binding: 3, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' } },
      { binding: 4, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' } },
      { binding: 5, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' } },
      { binding: 6, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' } },
      { binding: 7, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' } },
      { binding: 8, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' } },
      { binding: 9, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
    ]
  });

  const bindGroupLayout1 = gpuContext.device.createBindGroupLayout({
    label: 'G-Buffer Bind Group Layout 1',
    entries: [
      { binding: 0, visibility: GPUShaderStage.VERTEX, buffer: { type: 'uniform' } },
      { binding: 1, visibility: GPUShaderStage.VERTEX, buffer: { type: 'read-only-storage' } },
    ]
  });

  const bindGroupLayout2 = gpuContext.device.createBindGroupLayout({
    label: 'G-Buffer Bind Group Layout 2',
    entries: [
      { binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
      { binding: 1, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'filtering' } },
    ]
  });

  const pipeline = await gpuContext.device.createRenderPipelineAsync({
    label: 'G-Buffer Pipeline',
    layout: gpuContext.device.createPipelineLayout({
      bindGroupLayouts: [bindGroupLayout0, bindGroupLayout1, bindGroupLayout2]
    }),

    vertex: {
      module: shaderModule,
      entryPoint: 'vs_main',
      buffers: [
        {
          arrayStride: 16 * 4,
          attributes: [
            {
              shaderLocation: 0,
              offset: 0,
              format: 'float32x3',
            },
            {
              shaderLocation: 1,
              offset: 3 * 4,
              format: 'float32x3',
            },
            {
              shaderLocation: 2,
              offset: 6 * 4,
              format: 'float32x2',
            },
            {
              shaderLocation: 3,
              offset: 8 * 4,
              format: 'float32x4',
            },
            {
              shaderLocation: 4,
              offset: 12 * 4,
              format: 'float32x4',
            }
          ]
        }
      ],
    },

    fragment: {
      module: shaderModule,
      entryPoint: 'fs_main',
      targets: G_BUFFER_TARGETS as GPUColorTargetState[],
    },

    primitive: {
      topology: 'triangle-list',
      cullMode: 'back',
    },

    depthStencil: {
      format: 'depth24plus',
      depthWriteEnabled: true,
      depthCompare: 'less',
    },
  });

  gpuContext.bindGroupLayouts.set(BIND_GROUP_0_SYMBOL, bindGroupLayout0);
  gpuContext.bindGroupLayouts.set(BIND_GROUP_1_SYMBOL, bindGroupLayout1);
  gpuContext.bindGroupLayouts.set(BIND_GROUP_2_SYMBOL, bindGroupLayout2);

  gpuContext.pipelines.set(G_BUFFER_PIPELINE_SYMBOL, pipeline)
}

const getPipeline = (gpuContext: WebGPUContext) => {
  const pipeline = gpuContext.pipelines.get(G_BUFFER_PIPELINE_SYMBOL)

  if (!pipeline) {
    throw new Error('G-buffer pipeline not found')
  }

  return pipeline
}

const layouts: GPUBindGroupLayout[] = new Array<GPUBindGroupLayout>(BIND_GROUPS_COUNT);

export const getGBufferLayouts = (gpuContext: WebGPUContext) => {
  const layout0 = gpuContext.bindGroupLayouts.get(BIND_GROUP_0_SYMBOL);
  const layout1 = gpuContext.bindGroupLayouts.get(BIND_GROUP_1_SYMBOL);
  const layout2 = gpuContext.bindGroupLayouts.get(BIND_GROUP_2_SYMBOL);

  if (!layout0) {
    throw new Error('G-buffer layout 0 not found')
  }

  if (!layout1) {
    throw new Error('G-buffer layout 1 not found')
  }

  if (!layout2) {
    throw new Error('G-buffer layout 2 not found')
  }

  layouts[0] = layout0;
  layouts[1] = layout1;
  layouts[2] = layout2;

  return layouts
}

const G_BUFFER_TEXTURE_SYMBOLS = G_BUFFER.map(b => Symbol(`G-buffer Texture: ${b.type}`))
Object.freeze(G_BUFFER_TEXTURE_SYMBOLS)

const G_BUFFER_VIEW_SYMBOLS_RW = G_BUFFER.map(b => Symbol(`G-buffer Texture RW View: ${b.type}`))
Object.freeze(G_BUFFER_VIEW_SYMBOLS_RW)

const createGBufferTextures = (gpuContext: WebGPUContext) => {
  for (let i = 0; i < G_BUFFER.length; i++) {
    const format = G_BUFFER[i].format;
    const textureSymbol = G_BUFFER_TEXTURE_SYMBOLS[i];
    const viewSymbol = G_BUFFER_VIEW_SYMBOLS_RW[i];

    gpuContext.textures.get(textureSymbol)?.destroy();

    const texture = gpuContext.device.createTexture({
      size: {
        width: gpuContext.canvas.width,
        height: gpuContext.canvas.height,
        depthOrArrayLayers: 1
      },

      format,
      usage: G_BUFFER_TEXTURE_USAGE,
      label: `G-buffer ${G_BUFFER[i].type}`,
    });

    const view = texture.createView();

    gpuContext.textures.set(textureSymbol, texture)
    gpuContext.views.set(viewSymbol, view)
  }
}

export const getGBufferTextureViews = (gpuContext: WebGPUContext) => {
  const views = G_BUFFER_VIEW_SYMBOLS_RW.map(symbol => {
    const view = gpuContext.views.get(symbol)
    if (!view) {
      throw new Error(`G-buffer texture view not found: ${String(symbol)}`)
    }
    return view
  })

  return views
}

const createBindGroup2 = (gpuContext: WebGPUContext) => {
  const layout2 = gpuContext.bindGroupLayouts.get(BIND_GROUP_2_SYMBOL)

  if (!layout2) {
    throw new Error('G-buffer layout 2 not found')
  }

  const cameraUniformsBuffer = getCameraUniformsBuffer(gpuContext)

  const group2 = gpuContext.device.createBindGroup({
    label: String(BIND_GROUP_2_SYMBOL),
    layout: layout2,
    entries: [
      { binding: 0, resource: { buffer: cameraUniformsBuffer } },
      { binding: 1, resource: gpuContext.sampler },
    ],
  })

  gpuContext.bindGroups.set(BIND_GROUP_2_SYMBOL, group2)
}

const getBindGroup2 = (gpuContext: WebGPUContext) => {
  const group = gpuContext.bindGroups.get(BIND_GROUP_2_SYMBOL)

  if (!group) {
    throw new Error('G-buffer group 2 not found')
  }

  return group
}

export const initGBufferShader = async (gpuContext: WebGPUContext) => {
  createGBufferTextures(gpuContext)
  await createPipeline(gpuContext)
  createBindGroup2(gpuContext)
}

const G_BUFFER_SHADER_VERSION_TYPE_SYMBOL = Symbol('G-Buffer Shader Version')

export const refreshGBufferShader = async (gpuContext: WebGPUContext) => {
  if (getIsValid(RESOLUTION_VERSION_TYPE_SYMBOL, G_BUFFER_SHADER_VERSION_TYPE_SYMBOL)) {
    return;
  }

  createGBufferTextures(gpuContext)
}

export const drawGBufferShader = (
  gpuContext: WebGPUContext,
  commandEncoder: GPUCommandEncoder,
  meshes: Iterable<symbol>,
) => {
  const gBufferColorAttachments = new Array<GPURenderPassColorAttachment>(G_BUFFER.length);

  const gBufferViews = getGBufferTextureViews(gpuContext);

  for (let i = 0; i < G_BUFFER.length; i++) {
    gBufferColorAttachments[i] = {
      view: gBufferViews[i]!,
      loadOp: 'clear',
      storeOp: 'store',
      clearValue: G_BUFFER[i].clearValue,
    };
  }

  const gbufferPass = commandEncoder.beginRenderPass({
    colorAttachments: gBufferColorAttachments,
    depthStencilAttachment: {
      view: getDepthTextureView(gpuContext),
      depthLoadOp: 'clear',
      depthStoreOp: 'store',
      depthClearValue: 1.0,
    },
    label: 'G-Buffer Pass',
  });

  const pipeline = getPipeline(gpuContext)
  gbufferPass.setPipeline(pipeline);

  for (const meshSymbol of meshes) {
    const vertexBufferSymbol = gpuContext.vertexBuffers.get(meshSymbol);
    const indexBufferSymbol = gpuContext.indexBuffers.get(meshSymbol);

    if (!vertexBufferSymbol) {
      console.warn(`Skipping draw for mesh ${String(meshSymbol)}: vertex buffer symbol not found.`);
      continue;
    }

    if (!indexBufferSymbol) {
      console.warn(`Skipping draw for mesh ${String(meshSymbol)}: index buffer symbol not found.`);
      continue;
    }

    const vertexBuffer = gpuContext.buffers.get(vertexBufferSymbol);
    const indexBuffer = gpuContext.buffers.get(indexBufferSymbol);
    const indexBufferCount = gpuContext.indexCounts.get(meshSymbol);

    if (!vertexBuffer) {
      console.warn(`Skipping draw for mesh ${String(meshSymbol)}: vertex buffer not found.`);
      continue;
    }

    if (!indexBuffer) {
      console.warn(`Skipping draw for mesh ${String(meshSymbol)}: index buffer not found.`);
      continue;
    }

    if (indexBufferCount === undefined) {
      console.warn(`Skipping draw for mesh ${String(meshSymbol)}: index count not found.`);
      continue;
    }

    gbufferPass.setVertexBuffer(0, vertexBuffer);
    gbufferPass.setIndexBuffer(indexBuffer, VERTEX_INDEX_FORMAT);

    const materialSymbol = gpuContext.meshMaterials.get(meshSymbol);

    if (!materialSymbol) {
      console.warn(`Skipping mesh ${String(meshSymbol)}: material not found`);
      continue;
    }

    const group0 = gpuContext.bindGroups.get(materialSymbol);
    const group1 = gpuContext.bindGroups.get(meshSymbol);
    const group2 = getBindGroup2(gpuContext)

    if (!group0) {
      console.warn(`Skipping mesh ${String(meshSymbol)}: material bind group not found`);
      continue;
    }

    if (!group1) {
      console.warn(`Skipping mesh ${String(meshSymbol)}: mesh bind group not found`);
      continue;
    }

    if (!group2) {
      console.warn(`Skipping mesh ${String(meshSymbol)}: global bind group not found`);
      continue;
    }

    gbufferPass.setBindGroup(0, group0);
    gbufferPass.setBindGroup(1, group1);
    gbufferPass.setBindGroup(2, group2);

    gbufferPass.drawIndexed(indexBufferCount, 1, 0, 0, 0);
  }

  gbufferPass.end();
}
