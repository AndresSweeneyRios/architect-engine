import { WebGPUContext } from "../webgpu"
import { getIsValid } from "../../utils/version"
import { RESOLUTION_VERSION_TYPE_SYMBOL } from "../webgpu/version"

export const DEPTH_TEXTURE_REFRESH_SYMBOL = Symbol('Depth Texture Refresh Version')

export const refreshDepthTexture = (gpuContext: WebGPUContext) => {
  if (getIsValid(RESOLUTION_VERSION_TYPE_SYMBOL, DEPTH_TEXTURE_REFRESH_SYMBOL)) {
    return
  }

  gpuContext.textures.get(DEPTH_TEXTURE_REFRESH_SYMBOL)?.destroy()

  const depthTexture = gpuContext.device.createTexture({
    size: {
      width: gpuContext.canvas.width,
      height: gpuContext.canvas.height,
      depthOrArrayLayers: 1,
    },
    format: 'depth24plus',
    usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
    label: 'Depth Texture',
  })

  const depthTextureView = depthTexture.createView()

  gpuContext.textures.set(DEPTH_TEXTURE_REFRESH_SYMBOL, depthTexture)
  gpuContext.views.set(DEPTH_TEXTURE_REFRESH_SYMBOL, depthTextureView)
}

export const getDepthTextureView = (gpuContext: WebGPUContext) => {
  const view = gpuContext.views.get(DEPTH_TEXTURE_REFRESH_SYMBOL)

  if (!view) {
    throw new Error('Depth texture view not found')
  }

  return view
}
