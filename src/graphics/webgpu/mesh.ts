import type { mat4 } from "gl-matrix";
import type { MeshSkinData, WebGPUContext } from ".";
import { getGBufferLayouts } from "../shaders/gbuffer";

export type { MeshSkinData };

const DEFAULT_WORLD_MATRIX = new Float32Array([
  1, 0, 0, 0,
  0, 1, 0, 0,
  0, 0, 1, 0,
  0, 0, 0, 1,
]);

const IDENTITY_MATRIX = new Float32Array([
  1, 0, 0, 0,
  0, 1, 0, 0,
  0, 0, 1, 0,
  0, 0, 0, 1,
]);

interface MeshOptions {
  sceneName: string;
  meshName: string;
  positions: Float32Array;
  indices: Uint32Array;
  normals?: Float32Array | null;
  uvs?: Float32Array | null;
  skinIndices?: Uint16Array | null;
  skinWeights?: Float32Array | null;
  skinning?: MeshSkinData | null;
};

export const computeSmoothNormals = (positions: Float32Array, indices: Uint32Array) => {
  const normals = new Float32Array(positions.length);

  const accumulate = (vertexIndex: number, nx: number, ny: number, nz: number) => {
    const base = vertexIndex * 3;
    normals[base] += nx;
    normals[base + 1] += ny;
    normals[base + 2] += nz;
  };

  const getPosition = (vertexIndex: number) => {
    const base = vertexIndex * 3;
    return [
      positions[base],
      positions[base + 1],
      positions[base + 2],
    ] as const;
  };

  for (let i = 0; i < indices.length; i += 3) {
    const i0 = indices[i];
    const i1 = indices[i + 1];
    const i2 = indices[i + 2];

    const [ax, ay, az] = getPosition(i0);
    const [bx, by, bz] = getPosition(i1);
    const [cx, cy, cz] = getPosition(i2);

    const abx = bx - ax;
    const aby = by - ay;
    const abz = bz - az;
    const acx = cx - ax;
    const acy = cy - ay;
    const acz = cz - az;

    const nx = aby * acz - abz * acy;
    const ny = abz * acx - abx * acz;
    const nz = abx * acy - aby * acx;

    accumulate(i0, nx, ny, nz);
    accumulate(i1, nx, ny, nz);
    accumulate(i2, nx, ny, nz);
  }

  for (let i = 0; i < normals.length; i += 3) {
    const nx = normals[i];
    const ny = normals[i + 1];
    const nz = normals[i + 2];
    const length = Math.hypot(nx, ny, nz);

    if (length > 1e-5) {
      normals[i] = nx / length;
      normals[i + 1] = ny / length;
      normals[i + 2] = nz / length;
    } else {
      normals[i] = 1;
      normals[i + 1] = 0;
      normals[i + 2] = 0;
    }
  }

  return normals;
};

/**
 * Binds a mesh to the GPU.
 * 
 * @returns Unique mesh symbol to be used when drawing
 */
export const bindMesh = (gpuContext: WebGPUContext, options: MeshOptions) => {
  const { device } = gpuContext;
  const { sceneName, meshName, positions, indices, normals, uvs, skinIndices, skinWeights, skinning } = options;

  const uniqueId = `${sceneName}:${meshName}`;

  if (gpuContext.meshes.has(uniqueId)) {
    const symbol = gpuContext.meshes.get(uniqueId)!;
    return symbol;
  }

  const symbol = Symbol(uniqueId);

  gpuContext.meshes.set(uniqueId, symbol);

  if (positions.length % 3 !== 0) {
    throw new Error(`Positions array length must be a multiple of 3. Received ${positions.length}.`);
  }

  const vertexCount = positions.length / 3;
  const hasSkinAttributes = Boolean(skinIndices && skinWeights && skinIndices.length === vertexCount * 4 && skinWeights.length === vertexCount * 4);
  const hasSkinningData = Boolean(skinning && skinning.boneInverses.length > 0);
  const isSkinned = hasSkinAttributes && hasSkinningData;

  if (hasSkinAttributes && !hasSkinningData) {
    console.warn(`[bindMesh] Skin attributes found for ${uniqueId} but no skinning data provided. Falling back to static mesh.`);
  }

  let workingNormals: Float32Array;

  if (normals && normals.length === positions.length) {
    workingNormals = normals;
  } else {
    if (normals && normals.length !== positions.length) {
      console.warn(
        `Provided normals length (${normals.length}) does not match positions length (${positions.length}). Recomputing normals.`
      );
    }

    workingNormals = computeSmoothNormals(positions, indices);
  }

  let workingUVs: Float32Array;

  const expectedUVLength = vertexCount * 2;

  if (uvs && uvs.length === expectedUVLength) {
    workingUVs = uvs;
  } else {
    if (uvs && uvs.length !== expectedUVLength) {
      console.warn(
        `Provided UVs length (${uvs.length}) does not match expected length (${expectedUVLength}). Using default UVs.`
      );
    }

    workingUVs = new Float32Array(expectedUVLength);
  }

  const interleavedVertices = new Float32Array(vertexCount * 16);

  for (let i = 0; i < vertexCount; i++) {
    const positionOffset = i * 3;
    const uvOffset = i * 2;
    const interleavedOffset = i * 16;

    // Position
    interleavedVertices[interleavedOffset] = positions[positionOffset];
    interleavedVertices[interleavedOffset + 1] = positions[positionOffset + 1];
    interleavedVertices[interleavedOffset + 2] = positions[positionOffset + 2];

    // Normal
    interleavedVertices[interleavedOffset + 3] = workingNormals[positionOffset];
    interleavedVertices[interleavedOffset + 4] = workingNormals[positionOffset + 1];
    interleavedVertices[interleavedOffset + 5] = workingNormals[positionOffset + 2];

    // UV
    interleavedVertices[interleavedOffset + 6] = workingUVs[uvOffset];
    interleavedVertices[interleavedOffset + 7] = workingUVs[uvOffset + 1];

    if (isSkinned) {
      const skinOffset = i * 4;
      // Skin indices
      interleavedVertices[interleavedOffset + 8] = skinIndices![skinOffset];
      interleavedVertices[interleavedOffset + 9] = skinIndices![skinOffset + 1];
      interleavedVertices[interleavedOffset + 10] = skinIndices![skinOffset + 2];
      interleavedVertices[interleavedOffset + 11] = skinIndices![skinOffset + 3];

      // Skin weights
      interleavedVertices[interleavedOffset + 12] = skinWeights![skinOffset];
      interleavedVertices[interleavedOffset + 13] = skinWeights![skinOffset + 1];
      interleavedVertices[interleavedOffset + 14] = skinWeights![skinOffset + 2];
      interleavedVertices[interleavedOffset + 15] = skinWeights![skinOffset + 3];
    } else {
      interleavedVertices[interleavedOffset + 8] = 0;
      interleavedVertices[interleavedOffset + 9] = 0;
      interleavedVertices[interleavedOffset + 10] = 0;
      interleavedVertices[interleavedOffset + 11] = 0;

      interleavedVertices[interleavedOffset + 12] = 1;
      interleavedVertices[interleavedOffset + 13] = 0;
      interleavedVertices[interleavedOffset + 14] = 0;
      interleavedVertices[interleavedOffset + 15] = 0;
    }
  }

  const vertexBuffer = device.createBuffer({
    size: interleavedVertices.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    mappedAtCreation: true,
    label: 'Mesh vertex buffer',
  });

  const indexBuffer = device.createBuffer({
    size: indices.byteLength,
    usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
    mappedAtCreation: true,
    label: 'Mesh index buffer',
  });

  new Float32Array(vertexBuffer.getMappedRange()).set(interleavedVertices);
  vertexBuffer.unmap();

  new Uint32Array(indexBuffer.getMappedRange()).set(indices);

  indexBuffer.unmap();

  const vertexBufferSymbol = Symbol(`${uniqueId}:vertexBuffer`);
  const indexBufferSymbol = Symbol(`${uniqueId}:indexBuffer`);

  gpuContext.buffers.set(vertexBufferSymbol, vertexBuffer);
  gpuContext.buffers.set(indexBufferSymbol, indexBuffer);
  gpuContext.vertexBuffers.set(symbol, vertexBufferSymbol);
  gpuContext.indexBuffers.set(symbol, indexBufferSymbol);
  gpuContext.indexCounts.set(symbol, indices.length);

  const meshUniformData = new Float32Array(52);
  meshUniformData.set(DEFAULT_WORLD_MATRIX, 0);
  meshUniformData.set(isSkinned && skinning ? skinning.bindMatrix : IDENTITY_MATRIX, 16);
  meshUniformData.set(isSkinned && skinning ? skinning.bindMatrixInverse : IDENTITY_MATRIX, 32);
  meshUniformData[48] = isSkinned ? 1 : 0;

  const buffer = device.createBuffer({
    size: meshUniformData.byteLength,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    label: `Mesh uniform buffer: ${uniqueId}`,
  });

  device.queue.writeBuffer(buffer, 0, meshUniformData.buffer, meshUniformData.byteOffset, meshUniformData.byteLength);

  gpuContext.buffers.set(symbol, buffer);

  const layout = getGBufferLayouts(gpuContext)[1]!;

  const entries: GPUBindGroupEntry[] = [
    { binding: 0, resource: { buffer } }
  ];

  if (isSkinned) {
    const boneBuffer = device.createBuffer({
      size: 64 * 16 * 4,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      label: `Mesh bone buffer: ${uniqueId}`,
    });

    const identity = new Float32Array(16);

    identity[0] = 1; identity[5] = 1; identity[10] = 1; identity[15] = 1;

    for (let i = 0; i < 64; i++) {
      device.queue.writeBuffer(boneBuffer, i * 64, identity, 0, 16);
    }

    gpuContext.meshBoneBuffers.set(symbol, boneBuffer);

    if (skinning) {
      gpuContext.meshSkinData.set(symbol, skinning);
    }

    entries.push({ binding: 1, resource: { buffer: boneBuffer } });
  } else {
    const dummyBoneBuffer = device.createBuffer({
      size: 16 * 4,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      label: `Mesh dummy bone buffer: ${uniqueId}`,
    });

    const identity = new Float32Array(16);

    identity[0] = 1; identity[5] = 1; identity[10] = 1; identity[15] = 1;
    device.queue.writeBuffer(dummyBoneBuffer, 0, identity, 0, 16);
    entries.push({ binding: 1, resource: { buffer: dummyBoneBuffer } });
  }

  const bindGroup = device.createBindGroup({
    layout,
    entries
  });

  gpuContext.bindGroups.set(symbol, bindGroup);

  return symbol
};

export const writeWorldMatrix = (gpuContext: WebGPUContext, meshSymbol: symbol, worldMatrix: mat4) => {
  const buffer = gpuContext.buffers.get(meshSymbol);

  if (!buffer) {
    throw new Error(`Mesh buffer not found for symbol: ${String(meshSymbol)}`);
  }

  if (!(worldMatrix instanceof Float32Array)) {
    throw new Error('worldMatrix must be a Float32Array');
  }

  gpuContext.device.queue.writeBuffer(
    buffer,
    0,
    worldMatrix.buffer,
    worldMatrix.byteOffset,
    worldMatrix.byteLength
  );
}
