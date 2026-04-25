import * as THREE from 'three';
import type { WebGPUContext } from './webgpu';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { ASSET_MANIFEST, PACKED_GLB_PATH } from '../assets/manifest';
import { bindMesh, type MeshSkinData } from './webgpu/mesh';
import { extractMaterial } from './webgpu/materials';

const dracoLoader = new DRACOLoader();
const gltfLoader = new GLTFLoader();
gltfLoader.setDRACOLoader(dracoLoader);
dracoLoader.setDecoderPath('https://threejs.org/examples/jsm/libs/draco/');

export const loadGltf = async (path: string) => {
  return await new Promise<THREE.Group>((resolve) => {
    gltfLoader.load(path, (gltf) => {
      resolve(gltf.scene);
    });
  });
};

let packedGltfCache: THREE.Group | null = null;

/**
 * Loads a scene from the packed GLB using the asset manifest.
 */
export const loadPackedScene = async (sceneKey: keyof typeof ASSET_MANIFEST) => {
  if (!packedGltfCache) {
    const gltf = await loadGltf(PACKED_GLB_PATH);
    packedGltfCache = gltf;
  }

  const sceneObject = packedGltfCache.getObjectByName(sceneKey);

  if (!sceneObject) {
    throw new Error(`Scene "${sceneKey}" not found in packed GLB`);
  }

  const clonedScene = SkeletonUtils.clone(sceneObject);

  return clonedScene;
};

/**
 * Extracts mesh data from a THREE.Mesh or THREE.SkinnedMesh and binds it to the WebGPU context.
 * 
 * @returns Unique mesh symbol
 */
export const extractMesh = async (
  gpuContext: WebGPUContext,
  threeMesh: THREE.Mesh | THREE.SkinnedMesh,
  sceneName: keyof typeof ASSET_MANIFEST
) => {
  const { geometry } = threeMesh;

  const positionAttribute = geometry.getAttribute('position');
  const normalAttribute = geometry.getAttribute('normal');
  const uvAttribute = geometry.getAttribute('uv');
  const skinIndexAttribute = geometry.getAttribute('skinIndex');
  const skinWeightAttribute = geometry.getAttribute('skinWeight');
  const indexAttribute = geometry.index;

  if (!positionAttribute || !indexAttribute) {
    return null;
  }

  const positions = positionAttribute.array instanceof Float32Array
    ? positionAttribute.array
    : new Float32Array(positionAttribute.array as ArrayLike<number>);

  const normals = normalAttribute
    ? (normalAttribute.array instanceof Float32Array
      ? normalAttribute.array
      : new Float32Array(normalAttribute.array as ArrayLike<number>))
    : undefined;

  const uvs = uvAttribute
    ? (uvAttribute.array instanceof Float32Array
      ? uvAttribute.array
      : new Float32Array(uvAttribute.array as ArrayLike<number>))
    : undefined;

  const skinIndices = skinIndexAttribute
    ? (skinIndexAttribute.array instanceof Uint16Array
      ? skinIndexAttribute.array
      : new Uint16Array(skinIndexAttribute.array as ArrayLike<number>))
    : undefined;

  const skinWeights = skinWeightAttribute
    ? (skinWeightAttribute.array instanceof Float32Array
      ? skinWeightAttribute.array
      : new Float32Array(skinWeightAttribute.array as ArrayLike<number>))
    : undefined;

  let skinning: MeshSkinData | null = null;

  if (threeMesh instanceof THREE.SkinnedMesh) {
    const bindMatrix = new Float32Array(threeMesh.bindMatrix.elements);
    const bindMatrixInverse = new Float32Array(threeMesh.bindMatrixInverse.elements);
    const boneInverses = threeMesh.skeleton.boneInverses.map(inverse => new Float32Array(inverse.elements));

    if (boneInverses.length > 64) {
      console.warn(`Skinned mesh "${threeMesh.name}" has ${boneInverses.length} bones; only the first 64 are currently supported.`);
    }

    skinning = {
      bindMatrix,
      bindMatrixInverse,
      boneInverses,
    };
  }

  let indices = indexAttribute.array instanceof Uint32Array
    ? indexAttribute.array
    : new Uint32Array(indexAttribute.array as ArrayLike<number>);

  const threeMaterial = Array.isArray(threeMesh.material)
    ? threeMesh.material[0]
    : threeMesh.material;

  const material = await extractMaterial(gpuContext, sceneName, threeMaterial);

  const meshSymbol = bindMesh(gpuContext, {
    sceneName,
    meshName: threeMesh.name || 'unknown',
    positions,
    indices,
    normals,
    uvs,
    skinIndices,
    skinWeights,
    skinning,
  })

  gpuContext.meshMaterials.set(meshSymbol, material);

  return meshSymbol;
};
