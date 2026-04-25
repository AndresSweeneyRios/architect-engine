import type { WebGPUContext } from "."
import { ATLASES_DIR_PATH } from '../../assets/manifest'
import { ATLAS_TEXTURE_FORMAT, ATLAS_TEXTURE_USAGE } from "./constants"
import { DummyTextureType, getDummyTexture } from "./dummyTextures"

// TODO: implement texture cleanup

const textureLoadCache = new Map<string, Promise<symbol>>()
const atlasTextureCache = new Map<string, Promise<symbol>>()

const loadTextureInternal = async (gpuContext: WebGPUContext, path: string): Promise<symbol> => {
  const symbol = Symbol(`Texture: ${path}`)

  const image = new Image()
  image.src = path
  await image.decode()

  const baseWidth = image.width
  const baseHeight = image.height

  const tex = gpuContext.device.createTexture({
    size: {
      width: baseWidth,
      height: baseHeight
    },

    format: ATLAS_TEXTURE_FORMAT,
    usage: ATLAS_TEXTURE_USAGE,
    label: `Texture: ${path}`,
  })

  gpuContext.device.queue.copyExternalImageToTexture(
    { source: image },
    { texture: tex },
    { width: baseWidth, height: baseHeight }
  )

  gpuContext.textures.set(symbol, tex)
  gpuContext.views.set(symbol, tex.createView())

  return symbol
}

const loadTexture = async (gpuContext: WebGPUContext, path: string): Promise<symbol> => {
  if (textureLoadCache.has(path)) {
    return textureLoadCache.get(path)!
  }

  const promise = loadTextureInternal(gpuContext, path)
  textureLoadCache.set(path, promise)

  return promise
}

/**
 * Loads a texture atlas from the asset manifest with automatic caching and binds it to the GPU.
 * 
 * Note that bounding boxes are handled automatically in the material phase.
 * 
 * @returns atlas symbol
 */
export const loadAndBindTextureAtlas = async (
  gpuContext: WebGPUContext,
  type: DummyTextureType,
  atlasFile?: string
): Promise<symbol> => {
  if (!atlasFile) {
    return getDummyTexture(gpuContext, type)
  }

  const atlasPath = `${ATLASES_DIR_PATH}/${atlasFile}`

  if (atlasTextureCache.has(atlasPath)) {
    return atlasTextureCache.get(atlasPath)!
  }

  const promise = loadTexture(gpuContext, atlasPath)
  atlasTextureCache.set(atlasPath, promise)

  return promise
}
