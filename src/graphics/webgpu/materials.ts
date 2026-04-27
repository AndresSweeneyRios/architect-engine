import type { WebGPUContext } from './';
import type * as THREE from 'three';
import type { vec4 } from "gl-matrix";
import { ASSET_MANIFEST } from '../../assets/manifest';
import { DUMMY_TEXTURE_BYTES } from './dummyTextures';
import { getGBufferLayouts } from "../shaders/gbuffer";
import { loadAndBindTextureAtlas } from "./textures";

interface Atlas {
  atlasFile: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface MaterialConfig {
  // BUFFER
  albedoDefault?: vec4;
  emissiveDefault?: vec4;
  metallicRoughnessAOAlphaDefault?: vec4;
  triplanarScale?: vec4;

  albedoTriplanarUV?: vec4;
  normalTriplanarUV?: vec4;
  emissiveTriplanarUV?: vec4;
  metallicRoughnessAOAlphaTriplanarUV?: vec4;

  albedoDecalUV?: vec4;
  normalDecalUV?: vec4;
  emissiveDecalUV?: vec4;
  metallicRoughnessAOAlphaDecalUV?: vec4;
  metallicRoughnessAOAlphaDecalStencilUV?: vec4;

  normalStrength?: number;

  // TEXTURES
  albedoTriplanar?: string;
  normalTriplanar?: string;
  emissiveTriplanar?: string;
  metallicRoughnessAOAlphaTriplanar?: string;

  albedoDecal?: string;
  normalDecal?: string;
  emissiveDecal?: string;
  metallicRoughnessAOAlphaDecal?: string;
  metallicRoughnessAOAlphaDecalStencil?: string;
}

const BUFFER_LENGTH = 4 * 14;

const DUMMY_UV: vec4 = new Float32Array([0, 0, 1, 1]);

const getUVFromAtlas = (atlas?: Atlas): vec4 => {
  if (!atlas) {
    return DUMMY_UV;
  }

  return new Float32Array([
    atlas.x,
    atlas.y,
    atlas.width,
    atlas.height
  ]);
}

/**
 * Linear to sRGB color conversion.
 */
const LtoS = (x: number) => {
  return x <= 0.0031308 ? x * 12.92 : Math.pow(x, 1.0 / 2.4);
}

const DEFAULT_TRIPLANAR_SCALE: vec4 = new Float32Array([2, 2, 2, 0]);

const bindGroupBuffer = new Float32Array(BUFFER_LENGTH);

const bindMaterialConfig = async (gpuContext: WebGPUContext, config: MaterialConfig, symbol: symbol) => {
  if (gpuContext.bindGroups.has(symbol)) {
    return;
  }

  const buffer = bindGroupBuffer;

  const hasMetallicRoughnessAOAlphaTriplanar = config.metallicRoughnessAOAlphaTriplanar ? 1 : 0;
  const hasMetallicRoughnessAOAlphaDecal = config.metallicRoughnessAOAlphaDecal ? 1 : 0;

  buffer.set(config.albedoDefault ?? DUMMY_TEXTURE_BYTES.albedo, 0);
  buffer.set(config.emissiveDefault ?? DUMMY_TEXTURE_BYTES.emissive, 4);

  buffer.set(config.metallicRoughnessAOAlphaDefault ?? DUMMY_TEXTURE_BYTES.metallicRoughnessAOAlpha, 8);
  buffer.set(config.triplanarScale ?? DEFAULT_TRIPLANAR_SCALE, 12);

  buffer.set(config.albedoTriplanarUV ?? DUMMY_UV, 16);
  buffer.set(config.normalTriplanarUV ?? DUMMY_UV, 20);
  buffer.set(config.emissiveTriplanarUV ?? DUMMY_UV, 24);
  buffer.set(config.metallicRoughnessAOAlphaTriplanarUV ?? DUMMY_UV, 28);

  buffer.set(config.albedoDecalUV ?? DUMMY_UV, 32);
  buffer.set(config.normalDecalUV ?? DUMMY_UV, 36);
  buffer.set(config.emissiveDecalUV ?? DUMMY_UV, 40);
  buffer.set(config.metallicRoughnessAOAlphaDecalUV ?? DUMMY_UV, 44);
  buffer.set(config.metallicRoughnessAOAlphaDecalStencilUV ?? DUMMY_UV, 48);

  buffer[52] = hasMetallicRoughnessAOAlphaTriplanar;
  buffer[53] = hasMetallicRoughnessAOAlphaDecal;
  buffer[54] = config.normalStrength ?? 1;

  const gpuBuffer = gpuContext.device.createBuffer({
    label: `${String(symbol)} Material Buffer`,
    size: buffer.byteLength,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  gpuContext.device.queue.writeBuffer(gpuBuffer, 0, buffer.buffer, buffer.byteOffset, BUFFER_LENGTH * 4);
  gpuContext.buffers.set(symbol, gpuBuffer);

  const layout = getGBufferLayouts(gpuContext)[0]!;

  const textureSymbols = await Promise.all([
    loadAndBindTextureAtlas(gpuContext, 'albedo', config.albedoTriplanar),
    loadAndBindTextureAtlas(gpuContext, 'normal', config.normalTriplanar),
    loadAndBindTextureAtlas(gpuContext, 'emissive', config.emissiveTriplanar),
    loadAndBindTextureAtlas(gpuContext, 'metallicRoughnessAOAlpha', config.metallicRoughnessAOAlphaTriplanar),

    loadAndBindTextureAtlas(gpuContext, 'albedo', config.albedoDecal),
    loadAndBindTextureAtlas(gpuContext, 'normal', config.normalDecal),
    loadAndBindTextureAtlas(gpuContext, 'emissive', config.emissiveDecal),
    loadAndBindTextureAtlas(gpuContext, 'metallicRoughnessAOAlpha', config.metallicRoughnessAOAlphaDecal),
    loadAndBindTextureAtlas(gpuContext, 'metallicRoughnessAOAlphaStencil', config.metallicRoughnessAOAlphaDecalStencil),
  ])

  const [
    albedoTriplanar,
    normalTriplanar,
    emissiveTriplanar,
    metallicRoughnessAOAlphaTriplanar,

    albedoDecal,
    normalDecal,
    emissiveDecal,
    metallicRoughnessAOAlphaDecal,
    metallicRoughnessAOAlphaDecalStencil,
  ] = textureSymbols.map(symbol => {
    const view = gpuContext.views.get(symbol);

    if (!view) {
      throw new Error(`Texture view not found for material: ${String(symbol)}`);
    }

    return view;
  });

  const bindGroup = gpuContext.device.createBindGroup({
    label: `${String(symbol)} Bind Group`,
    layout,
    entries: [
      { binding: 0, resource: albedoTriplanar },
      { binding: 1, resource: normalTriplanar },
      { binding: 2, resource: emissiveTriplanar },
      { binding: 3, resource: metallicRoughnessAOAlphaTriplanar },

      { binding: 4, resource: albedoDecal },
      { binding: 5, resource: normalDecal },
      { binding: 6, resource: emissiveDecal },
      { binding: 7, resource: metallicRoughnessAOAlphaDecal },
      { binding: 8, resource: metallicRoughnessAOAlphaDecalStencil },

      { binding: 9, resource: { buffer: gpuBuffer } }
    ]
  });

  gpuContext.bindGroups.set(symbol, bindGroup);
}

const materialBuffer = new Float32Array(4 * 4);

/**
 * Parses a custom {@link THREE.Material} parsed from GLTF into a standardized material 
 * configuration and binds it to the GPU.
 * 
 * This includes references to MRAO textures, their triplanar equivalents, and their 
 * UVs, as well as default values for albedo, emissive, MRAO, and triplanar scale.
 */
export async function extractMaterial(
  gpuContext: WebGPUContext,
  sceneName: string,
  threeMaterial: THREE.Material,
): Promise<symbol> {
  const scene = ASSET_MANIFEST[sceneName as keyof typeof ASSET_MANIFEST];
  const mats = scene.materials;

  const entry = mats[threeMaterial.name as keyof typeof mats] as undefined | {
    triplanar_scale?: { x: number; y: number; z: number };
    normal_strength?: number;
    emissive?: { r: number; g: number; b: number; a: number };

    albedoTexture?: Atlas;
    normalTexture?: Atlas;
    emissiveTexture?: Atlas;
    metallicRoughnessAOAlphaTexture?: Atlas;
    metallicRoughnessAOAlphaStencilTexture?: Atlas;

    albedoTriplanarTexture?: Atlas;
    normalTriplanarTexture?: Atlas;
    emissiveTriplanarTexture?: Atlas;
    metallicRoughnessAOAlphaTriplanarTexture?: Atlas;
  }

  const uniqueId = `${sceneName}:${threeMaterial.name}`;

  if (gpuContext.materials.has(uniqueId)) {
    const symbol = gpuContext.materials.get(uniqueId)!;
    return symbol;
  }

  const symbol = Symbol(`Material: ${threeMaterial.name}`);
  gpuContext.materials.set(uniqueId, symbol);

  const threeMeshStandardMaterial = threeMaterial as Partial<THREE.MeshStandardMaterial>;

  materialBuffer[0] = threeMeshStandardMaterial.color?.r ? LtoS(threeMeshStandardMaterial.color?.r) : DUMMY_TEXTURE_BYTES.albedo[0];
  materialBuffer[1] = threeMeshStandardMaterial.color?.g ? LtoS(threeMeshStandardMaterial.color?.g) : DUMMY_TEXTURE_BYTES.albedo[1];
  materialBuffer[2] = threeMeshStandardMaterial.color?.b ? LtoS(threeMeshStandardMaterial.color?.b) : DUMMY_TEXTURE_BYTES.albedo[2];
  materialBuffer[3] = 1;

  materialBuffer[4] = entry?.emissive?.r ?? DUMMY_TEXTURE_BYTES.emissive[0];
  materialBuffer[5] = entry?.emissive?.g ?? DUMMY_TEXTURE_BYTES.emissive[1];
  materialBuffer[6] = entry?.emissive?.b ?? DUMMY_TEXTURE_BYTES.emissive[2];
  materialBuffer[7] = entry?.emissive?.a ?? 0;

  materialBuffer[8] = threeMeshStandardMaterial.metalness ?? 0;
  materialBuffer[9] = threeMeshStandardMaterial.roughness ?? 1;
  materialBuffer[10] = 1;
  materialBuffer[11] = threeMeshStandardMaterial.opacity ?? 1;

  materialBuffer[12] = entry?.triplanar_scale?.x ? (entry.triplanar_scale.x) : DEFAULT_TRIPLANAR_SCALE[0];
  materialBuffer[13] = entry?.triplanar_scale?.y ? (entry.triplanar_scale.y) : DEFAULT_TRIPLANAR_SCALE[1];
  materialBuffer[14] = entry?.triplanar_scale?.z ? (entry.triplanar_scale.z) : DEFAULT_TRIPLANAR_SCALE[2];
  materialBuffer[15] = 0;

  const albedo = materialBuffer.subarray(0, 4);
  const emissive = materialBuffer.subarray(4, 8);
  const metallicRoughnessAOAlpha = materialBuffer.subarray(8, 12);
  const triplanarScale = materialBuffer.subarray(12, 16);

  await bindMaterialConfig(gpuContext, {
    albedoDefault: albedo,
    emissiveDefault: emissive,
    metallicRoughnessAOAlphaDefault: metallicRoughnessAOAlpha,
    triplanarScale: triplanarScale,

    albedoTriplanarUV: getUVFromAtlas(entry?.albedoTriplanarTexture),
    normalTriplanarUV: getUVFromAtlas(entry?.normalTriplanarTexture),
    emissiveTriplanarUV: getUVFromAtlas(entry?.emissiveTriplanarTexture),
    metallicRoughnessAOAlphaTriplanarUV: getUVFromAtlas(entry?.metallicRoughnessAOAlphaTriplanarTexture),

    albedoDecalUV: getUVFromAtlas(entry?.albedoTexture),
    normalDecalUV: getUVFromAtlas(entry?.normalTexture),
    emissiveDecalUV: getUVFromAtlas(entry?.emissiveTexture),
    metallicRoughnessAOAlphaDecalUV: getUVFromAtlas(entry?.metallicRoughnessAOAlphaTexture),
    metallicRoughnessAOAlphaDecalStencilUV: getUVFromAtlas(entry?.metallicRoughnessAOAlphaStencilTexture),

    normalStrength: entry?.normal_strength ?? 1,

    albedoTriplanar: entry?.albedoTriplanarTexture?.atlasFile,
    normalTriplanar: entry?.normalTriplanarTexture?.atlasFile,
    emissiveTriplanar: entry?.emissiveTriplanarTexture?.atlasFile,
    metallicRoughnessAOAlphaTriplanar: entry?.metallicRoughnessAOAlphaTriplanarTexture?.atlasFile,

    albedoDecal: entry?.albedoTexture?.atlasFile,
    normalDecal: entry?.normalTexture?.atlasFile,
    emissiveDecal: entry?.emissiveTexture?.atlasFile,
    metallicRoughnessAOAlphaDecal: entry?.metallicRoughnessAOAlphaTexture?.atlasFile,
    metallicRoughnessAOAlphaDecalStencil: entry?.metallicRoughnessAOAlphaStencilTexture?.atlasFile,
  }, symbol);

  return symbol;
}
