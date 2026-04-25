import type { WebGPUContext } from ".";
import { ATLAS_TEXTURE_FORMAT, ATLAS_TEXTURE_USAGE } from "./constants";

export type DummyTextureType = 'albedo' | 'normal' | 'emissive' | 'metallicRoughnessAOAlpha' | 'metallicRoughnessAOAlphaStencil';

export const DUMMY_TEXTURE_BYTES: Record<DummyTextureType, Float16Array> = Object.freeze({
  albedo: new Float16Array([1, 1, 1, 0]),
  normal: new Float16Array([0.5, 0.5, 1, 0]),
  emissive: new Float16Array([0, 0, 0, 0]),
  metallicRoughnessAOAlpha: new Float16Array([0, 1, 1, 1]),
  metallicRoughnessAOAlphaStencil: new Float16Array([0, 0, 0, 0]),
});

const dummyTextures = new Map<DummyTextureType, symbol>();

export const getDummyTexture = (
  gpuContext: WebGPUContext,
  type: DummyTextureType
): symbol => {
  if (dummyTextures.has(type)) {
    return dummyTextures.get(type)!;
  }

  const symbol = Symbol(`DUMMY:${type}`);

  const bytes = DUMMY_TEXTURE_BYTES[type];

  const tex = gpuContext.device.createTexture({
    size: { width: 1, height: 1, depthOrArrayLayers: 1 },
    format: ATLAS_TEXTURE_FORMAT,
    usage: ATLAS_TEXTURE_USAGE,
    label: `${String(symbol)}:Texture`,
  });

  gpuContext.device.queue.writeTexture(
    { texture: tex },
    bytes as GPUAllowSharedBufferSource,
    { bytesPerRow: 8, rowsPerImage: 1 },
    { width: 1, height: 1, depthOrArrayLayers: 1 },
  );

  const view = tex.createView();

  gpuContext.textures.set(symbol, tex);
  gpuContext.views.set(symbol, view);

  return symbol;
}
