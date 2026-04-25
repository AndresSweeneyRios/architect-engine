// This G-buffer shader is non-standard and uses extensive triplanar texturing and atlasing
// to achieve a minimal memory footprint while supporting complex PBR materials and decals.

// This helps us build stylized visuals and ship tiny bundle sizes at a mild compute cost.

struct CameraUniforms {
  viewProjectionMatrix : mat4x4<f32>,
  inverseViewMatrix: mat4x4<f32>,
  time: vec4<f32>,
}

// The order of these fields may be somewhat unintuitive, but they are packed as efficiently as possible.
struct MatParams {
  albedoDefault : vec4<f32>,
  emissiveDefault : vec4<f32>,
  metallicRoughnessAOAlphaDefault : vec4<f32>,
  triplanarScale : vec4<f32>,

  albedoTriplanarUV : vec4<f32>,
  normalTriplanarUV : vec4<f32>,
  emissiveTriplanarUV : vec4<f32>,
  metallicRoughnessAOAlphaTriplanarUV : vec4<f32>,

  albedoDecalUV : vec4<f32>,
  normalDecalUV : vec4<f32>,
  emissiveDecalUV : vec4<f32>,
  metallicRoughnessAOAlphaDecalUV : vec4<f32>,
  metallicRoughnessAOAlphaDecalStencilUV : vec4<f32>,

  hasMetallicRoughnessAOAlphaTriplanar : f32,
  normalStrength : f32,

  // Padding to adhere to the buffer structure requirements
  p0: f32,
  p1: f32,
}

struct MeshParams {
  modelMatrix : mat4x4<f32>,
  bindMatrix : mat4x4<f32>,
  bindMatrixInverse : mat4x4<f32>,
  isSkinned : f32,
}

struct GBufferOutput {
  @location(0) position: vec4<f32>,
  @location(1) normal: vec4<f32>,
  @location(2) albedo: vec4<f32>,
  @location(3) emissive: vec4<f32>,
  @location(4) metallicRoughnessAOAlpha: vec4<f32>,
}

struct VertexInput {
  @location(0) position: vec3<f32>,
  @location(1) normal: vec3<f32>,
  @location(2) uv: vec2<f32>,
  @location(3) skinIndices: vec4<f32>,
  @location(4) skinWeights: vec4<f32>,
}

struct VertexOutput {
  @builtin(position) clip_position: vec4<f32>,
  @location(0) world_pos: vec3<f32>,
  @location(1) world_norm: vec3<f32>,
  @location(2) tangent: vec3<f32>,
  @location(3) bitangent: vec3<f32>,
  @location(4) uv: vec2<f32>,
}

struct SkinnedVertex {
  position: vec3<f32>,
  normal: vec3<f32>,
};

@group(0) @binding(0) var albedoTriplanar : texture_2d<f32>;
@group(0) @binding(1) var normalTriplanar : texture_2d<f32>;
@group(0) @binding(2) var emissiveTriplanar : texture_2d<f32>;
@group(0) @binding(3) var metallicRoughnessAOAlphaTriplanar : texture_2d<f32>;

@group(0) @binding(4) var albedoDecal : texture_2d<f32>;
@group(0) @binding(5) var normalDecal : texture_2d<f32>;
@group(0) @binding(6) var emissiveDecal : texture_2d<f32>;
@group(0) @binding(7) var metallicRoughnessAOAlphaDecal : texture_2d<f32>;
@group(0) @binding(8) var metallicRoughnessAOAlphaDecalStencil : texture_2d<f32>;

@group(0) @binding(9) var<uniform> material : MatParams;

@group(1) @binding(0) var<uniform> mesh : MeshParams;

@group(1) @binding(1) var<storage, read> boneMatrices : array<mat4x4<f32>>;

@group(2) @binding(0) var<uniform> camera : CameraUniforms;
@group(2) @binding(1) var samp : sampler;

fn applySkinning(
  positionIn: vec3<f32>,
  normalIn: vec3<f32>,
  skinIndices: vec4<f32>,
  skinWeights: vec4<f32>,
  bindMatrix: mat4x4<f32>,
  bindMatrixInverse: mat4x4<f32>,
  isSkinned: f32,
) -> SkinnedVertex {
  var position = positionIn;
  var normal = normalIn;

  if (isSkinned > 0.5) {
    let bindMatrixInverse3 = mat3x3<f32>(
      bindMatrixInverse[0].xyz,
      bindMatrixInverse[1].xyz,
      bindMatrixInverse[2].xyz
    );
    let bindMat3 = mat3x3<f32>(
      bindMatrix[0].xyz,
      bindMatrix[1].xyz,
      bindMatrix[2].xyz
    );

    let localPosition = bindMatrixInverse * vec4<f32>(position, 1.0);
    let localNormal = bindMatrixInverse3 * normal;

    var skinnedPosition = vec4<f32>(0.0);
    var skinnedNormal = vec3<f32>(0.0);
    var weightSum = 0.0;

    for (var i = 0u; i < 4u; i = i + 1u) {
      let weight = skinWeights[i];
      if (weight <= 0.0) {
        continue;
      }

      let boneIndex = u32(skinIndices[i]);
      if (boneIndex >= arrayLength(&boneMatrices)) {
        continue;
      }

      let boneMatrix = boneMatrices[boneIndex];
      let boneMat3 = mat3x3<f32>(
        boneMatrix[0].xyz,
        boneMatrix[1].xyz,
        boneMatrix[2].xyz
      );

      skinnedPosition += boneMatrix * localPosition * weight;
      skinnedNormal += boneMat3 * localNormal * weight;
      weightSum += weight;
    }

    if (weightSum > 0.0) {
      position = (bindMatrix * skinnedPosition).xyz;
    } else {
      position = (bindMatrix * localPosition).xyz;
    }

    let skinnedNormalLength = length(skinnedNormal);
    if (skinnedNormalLength > 1e-5) {
      normal = normalize(bindMat3 * skinnedNormal);
    } else {
      normal = normalize(bindMat3 * localNormal);
    }
  }

  return SkinnedVertex(position, normal);
}

@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
  var o: VertexOutput;

  var position = input.position;
  var normal = input.normal;

  let skinned = applySkinning(
    position,
    normal,
    input.skinIndices,
    input.skinWeights,
    mesh.bindMatrix,
    mesh.bindMatrixInverse,
    mesh.isSkinned,
  );

  position = skinned.position;
  normal = skinned.normal;

  let wp = vec4<f32>(position, 1.0);
  o.clip_position = camera.viewProjectionMatrix * mesh.modelMatrix * wp;
  o.world_pos = (mesh.modelMatrix * wp).xyz;
  
  let modelMat3 = mat3x3<f32>(
    mesh.modelMatrix[0].xyz,
    mesh.modelMatrix[1].xyz,
    mesh.modelMatrix[2].xyz
  );

  let normalMatrix = transpose(inverseMat3(modelMat3));
  o.world_norm = normalize(normalMatrix * normal);
  
  let up = select(vec3<f32>(0.0, 1.0, 0.0), vec3<f32>(1.0, 0.0, 0.0), abs(o.world_norm.y) > 0.999);
  let localTangent = normalize(cross(up, normal));
  let localBitangent = cross(normal, localTangent);
  
  o.tangent = normalize(normalMatrix * localTangent);
  o.bitangent = normalize(normalMatrix * localBitangent);
  
  o.uv = input.uv;
  
  return o;
}

fn blendWeights(n: vec3<f32>) -> vec3<f32> {
  let time = camera.time.x;
  let a = abs(n); 
  
  return a / (a.x + a.y + a.z + 1e-5); 
}

fn computeTriplanarUV(worldPos: vec3<f32>, uvRect: vec4<f32>, scale: vec3<f32>, axis: u32) -> vec2<f32> {
  var planePos: vec2<f32>;
  var planeScale: vec2<f32>;
  
  switch axis {
    case 0u: {
      planePos = worldPos.zy;
      planeScale = scale.zy;
    }
    case 1u: {
      planePos = worldPos.xz;
      planeScale = scale.xz;
    }
    default: {
      planePos = worldPos.xy;
      planeScale = scale.xy;
    }
  }
  
  return uvRect.xy + fract(planePos * planeScale) * uvRect.zw;
}

fn sampleTriplanar(
  tex: texture_2d<f32>,
  uvRect: vec4<f32>,
  worldPos: vec3<f32>,
  scale: vec3<f32>,
  weights: vec3<f32>,
) -> vec4<f32> {
  var result = vec4<f32>(0.0);
  
  for (var i = 0u; i < 3u; i = i + 1u) {
    let uv = computeTriplanarUV(worldPos, uvRect, scale, i);
    let sample = textureSample(tex, samp, uv);
    let weight = weights[i];
    
    result += vec4<f32>(sample.rgba * weight);
  }
  
  return result;
}

fn sampleDecal(
  tex: texture_2d<f32>,
  uv: vec2<f32>,
  uvRect: vec4<f32>,
) -> vec4<f32> {
  let sample = textureSample(tex, samp, uvRect.xy + uv * uvRect.zw);
  
  return sample;
}

fn mixTextures(
  defaultValue: vec4<f32>,
  triplanar: vec4<f32>,
  decal: vec4<f32>,
) -> vec4<f32> {
  return mix(mix(defaultValue, triplanar, triplanar.a), decal, decal.a);
}

fn mixChannelStencil(
  defaultValue: f32,
  triplanar: f32,
  hasTriplanar: f32,
  decal: f32,
  decalStencil: f32,
) -> f32 {
  return mix(mix(defaultValue, triplanar, step(0.5, hasTriplanar)), decal, step(0.5, decalStencil));
}

fn mixChannelsStencil(
  defaultValue: vec4<f32>,
  triplanar: vec4<f32>,
  hasTriplanar: f32,
  decal: vec4<f32>,
  decalStencil: vec4<f32>,
) -> vec4<f32> {
  return vec4<f32>(
    mixChannelStencil(defaultValue.x, triplanar.x, hasTriplanar, decal.x, decalStencil.x),
    mixChannelStencil(defaultValue.y, triplanar.y, hasTriplanar, decal.y, decalStencil.y),
    mixChannelStencil(defaultValue.z, triplanar.z, hasTriplanar, decal.z, decalStencil.z),
    mixChannelStencil(defaultValue.w, triplanar.w, hasTriplanar, decal.w, decalStencil.w),
  );
}

fn inverseMat3(m: mat3x3<f32>) -> mat3x3<f32> {
  let a = m[0][0]; let b = m[0][1]; let c = m[0][2];
  let d = m[1][0]; let e = m[1][1]; let f = m[1][2];
  let g = m[2][0]; let h = m[2][1]; let i = m[2][2];
  let det = a*(e*i - f*h) - b*(d*i - f*g) + c*(d*h - e*g);
  let invDet = 1.0 / det;
  return mat3x3<f32>(
    (e*i - f*h)*invDet, (c*h - b*i)*invDet, (b*f - c*e)*invDet,
    (f*g - d*i)*invDet, (a*i - c*g)*invDet, (c*d - a*f)*invDet,
    (d*h - e*g)*invDet, (b*g - a*h)*invDet, (a*e - b*d)*invDet
  );
}

@fragment
fn fs_main(input: VertexOutput) -> GBufferOutput {
  let w = blendWeights(input.world_norm);
  let scale = material.triplanarScale.xyz;
  var pos = input.world_pos;
  
  let albedo = mixTextures(
    material.albedoDefault, 
    sampleTriplanar(albedoTriplanar, material.albedoTriplanarUV, pos, scale, w), 
    sampleDecal(albedoDecal, input.uv, material.albedoDecalUV), 
  );
  
  let emissive = mixTextures(
    material.emissiveDefault, 
    sampleTriplanar(emissiveTriplanar, material.emissiveTriplanarUV, pos, scale, w), 
    sampleDecal(emissiveDecal, input.uv, material.emissiveDecalUV), 
  );

  let normalMap = mixTextures(
    vec4<f32>(0.5, 0.5, 1.0, 1.0), 
    sampleTriplanar(normalTriplanar, material.normalTriplanarUV, pos, scale, w), 
    sampleDecal(normalDecal, input.uv, material.normalDecalUV), 
  ).xyz * 2.0 - 1.0;

  let T = normalize(input.tangent);
  let B = normalize(input.bitangent);
  let N = normalize(input.world_norm);

  let TBN = mat3x3<f32>(T, B, N);
  let normal = normalize(TBN * (normalMap * material.normalStrength));

  let metallicRoughnessAOAlphaTriplanar = sampleTriplanar(metallicRoughnessAOAlphaTriplanar, material.metallicRoughnessAOAlphaTriplanarUV, pos, scale, w);
  let metallicRoughnessAOAlphaDecal = sampleDecal(metallicRoughnessAOAlphaDecal, input.uv, material.metallicRoughnessAOAlphaDecalUV);
  let metallicRoughnessAOAlphaDecalStencil = sampleDecal(metallicRoughnessAOAlphaDecalStencil, input.uv, material.metallicRoughnessAOAlphaDecalStencilUV);

  let metallicRoughnessAOAlpha = mixChannelsStencil(
    material.metallicRoughnessAOAlphaDefault, 
    metallicRoughnessAOAlphaTriplanar, 
    material.hasMetallicRoughnessAOAlphaTriplanar, 
    metallicRoughnessAOAlphaDecal, 
    metallicRoughnessAOAlphaDecalStencil,
  );

  return GBufferOutput(
    vec4<f32>(input.world_pos, 1.0),
    vec4<f32>(normal, 1.0),
    albedo,
    emissive,
    metallicRoughnessAOAlpha,
  );
}
