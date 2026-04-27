export const MAX_FRAMES_IN_FLIGHT = 0;
export const INDEX_FORMAT = 'uint32' satisfies GPUIndexFormat;

const TEXTURE_FORMATS = {
  RGBA_R0: 'rgba8unorm-srgb' as GPUTextureFormat,
  RGBA_R1: 'rgba16float' as GPUTextureFormat,

  RGBA_W0: 'rgba8unorm' as GPUTextureFormat,
  RGBA_W1: 'rgba16float' as GPUTextureFormat,
}

export const G_BUFFER_TEXTURE_USAGE: GPUTextureUsageFlags = GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING;

export const ATLAS_TEXTURE_FORMAT = TEXTURE_FORMATS.RGBA_R1;
export const ATLAS_TEXTURE_USAGE: GPUTextureUsageFlags = GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT;

export const DEPTH_TEXTURE_USAGE: GPUTextureUsageFlags = GPUTextureUsage.RENDER_ATTACHMENT;

type GBufferConfig<T extends string = string> = {
  binding: number;
  format: GPUTextureFormat;
  clearValue: GPUColor;
  type: T;
};

const createGBufferTextureConfig = <
  const T extends string
>(
  binding: number,
  format: GPUTextureFormat,
  clearValue: [number, number, number, number],
  type: T,
): GBufferConfig<T> => ({
  binding,
  format,
  clearValue,
  type,
});

export const G_BUFFER = Object.freeze([
  createGBufferTextureConfig(0, TEXTURE_FORMATS.RGBA_W1, [0, 0, 0, 0], 'position'),
  createGBufferTextureConfig(1, TEXTURE_FORMATS.RGBA_W1, [0, 0, 1, 0], 'normal'),
  createGBufferTextureConfig(2, TEXTURE_FORMATS.RGBA_W0, [0.02, 0.02, 0.04, 1], 'albedo'),
  createGBufferTextureConfig(3, TEXTURE_FORMATS.RGBA_W0, [0, 0, 0, 1], 'emissive'),
  createGBufferTextureConfig(4, TEXTURE_FORMATS.RGBA_W0, [0, 1, 1, 1], 'metallicRoughnessAOAlpha'),
] as const);

export const G_BUFFER_TARGETS = Object.freeze(
  G_BUFFER.map(({ format }) => ({ format } as GPUColorTargetState))
);
