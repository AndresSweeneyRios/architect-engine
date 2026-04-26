struct Camera {
  viewProjectionMatrix: mat4x4<f32>,
  inverseViewMatrix: mat4x4<f32>,
  time: vec4<f32>,
};

struct Light {
  position: vec3<f32>,
  intensity: f32,
  color: vec3<f32>,
  range: f32,
};

const MAX_LIGHTS = 256u;

@group(0) @binding(0) var gbuffer_position: texture_2d<f32>;
@group(0) @binding(1) var gbuffer_normal: texture_2d<f32>;
@group(0) @binding(2) var gbuffer_albedo: texture_2d<f32>;
@group(0) @binding(3) var gbuffer_emissive: texture_2d<f32>;
@group(0) @binding(4) var gbuffer_metallicRoughnessAOAlpha: texture_2d<f32>;

@group(1) @binding(0) var gbuffer_sampler: sampler;
@group(1) @binding(1) var<uniform> camera: Camera;

@group(2) @binding(0) var<uniform> lights: array<Light, MAX_LIGHTS>;
@group(2) @binding(1) var<uniform> num_lights: u32;

// A custom color pallete used for stylized color quantization.
const PALETTE_SIZE: u32 = 32u;
const PALETTE: array<vec3<f32>, PALETTE_SIZE> = array<vec3<f32>, PALETTE_SIZE>(
  vec3<f32>(0.000000, 0.000000, 0.000000),
  vec3<f32>(0.85, 0.85, 0.85),
  vec3<f32>(0.768627, 0.780392, 0.933333),
  vec3<f32>(0.603922, 0.560784, 0.878431),
  vec3<f32>(0.388235, 0.364706, 0.588235),
  vec3<f32>(0.160784, 0.184314, 0.396078),
  vec3<f32>(0.105882, 0.113726, 0.203922),
  vec3<f32>(1.000000, 0.890196, 0.682353),
  vec3<f32>(0.803922, 0.733333, 0.670588),
  vec3<f32>(0.650980, 0.521569, 0.560784),
  vec3<f32>(0.811765, 0.364706, 0.545098),
  vec3<f32>(0.588235, 0.286275, 0.407843),
  vec3<f32>(1.000000, 0.705882, 0.509804),
  vec3<f32>(0.866667, 0.525490, 0.490196),
  vec3<f32>(0.698039, 0.411765, 0.435294),
  vec3<f32>(0.964706, 0.776471, 0.368627),
  vec3<f32>(0.894118, 0.564706, 0.341176),
  vec3<f32>(0.768627, 0.407843, 0.200000),
  vec3<f32>(0.690196, 0.815686, 0.494118),
  vec3<f32>(0.400000, 0.666667, 0.364706),
  vec3<f32>(0.321569, 0.709804, 0.670588),
  vec3<f32>(0.164706, 0.513726, 0.474510),
  vec3<f32>(0.109804, 0.337255, 0.349020),
  vec3<f32>(0.482353, 0.882353, 0.964706),
  vec3<f32>(0.345098, 0.623529, 0.988235),
  vec3<f32>(0.313725, 0.411765, 0.894118),
  vec3<f32>(0.180392, 0.266667, 0.682353),
  vec3<f32>(0.501961, 0.337255, 0.831373),
  vec3<f32>(0.352941, 0.231373, 0.588235),
  vec3<f32>(1.000000, 0.729412, 0.882353),
  vec3<f32>(0.901961, 0.529412, 0.772549),
  vec3<f32>(0.654902, 0.349020, 0.725490)
);

// Custom 4x4 Bayer dither matrix for ordered dithering.
const DITHER_MATRIX: array<array<f32, 4>, 4> = array<array<f32,4>,4>(
  array<f32,4>(0.0,  8.0,  2.0, 10.0),
  array<f32,4>(12.0, 4.0, 14.0, 6.0),
  array<f32,4>(3.0, 11.0, 1.0,  9.0),
  array<f32,4>(15.0, 7.0, 13.0, 5.0)
);

fn apply_dither(color: vec3<f32>, frag_coords: vec2<u32>) -> vec3<f32> {
  let x: u32 = frag_coords.x % 4u;
  let y: u32 = frag_coords.y % 4u;
  let threshold: f32 = DITHER_MATRIX[y][x] / 16.0;

  return clamp(color + vec3<f32>(threshold), vec3<f32>(0.0), vec3<f32>(1.0));
}

fn dither_lighting(lighting: vec3<f32>, frag_coords: vec2<u32>, scale: f32) -> vec3<f32> {
  let x: u32 = frag_coords.x % 4u;
  let y: u32 = frag_coords.y % 4u;
  
  let threshold: f32 = (DITHER_MATRIX[y][x] / 16.0) - 0.5;
  
  let offset = threshold * scale * lighting;
  
  return clamp(lighting + vec3<f32>(offset), vec3<f32>(0.0), vec3<f32>(1.0));
}

fn nearest_palette_color(color: vec3<f32>) -> vec3<f32> {
  var best_index: u32 = 0u;
  var best_distance: f32 = distance(color, PALETTE[0]);
  for (var i: u32 = 1u; i < PALETTE_SIZE; i = i + 1u) {
    let d: f32 = distance(color, PALETTE[i]);
    if (d < best_distance) {
      best_distance = d;
      best_index = i;
    }
  }
  return PALETTE[best_index];
}

fn dither_palette_color(color: vec3<f32>, frag_coords: vec2<u32>) -> vec3<f32> {
  var best0_idx: u32 = 0u;
  var best1_idx: u32 = 0u;
  var best0_dist: f32 = 1e9;
  var best1_dist: f32 = 1e9;

  for (var i: u32 = 0u; i < PALETTE_SIZE; i = i + 1u) {
    let d: f32 = distance(color, PALETTE[i]);
    if (d < best0_dist) {
      best1_dist = best0_dist;
      best1_idx = best0_idx;
      best0_dist = d;
      best0_idx = i;
    } else if (d < best1_dist) {
      best1_dist = d;
      best1_idx = i;
    }
  }

  let c0 = PALETTE[best0_idx];
  let c1 = PALETTE[best1_idx];
  let axis = c1 - c0;
  let axis_len2 = max(dot(axis, axis), 1e-5);

  let blend = clamp(dot(color - c0, axis) / axis_len2, 0.0, 1.0);

  let x: u32 = frag_coords.x % 4u;
  let y: u32 = frag_coords.y % 4u;
  let threshold: f32 = (DITHER_MATRIX[y][x] + 0.5) / 16.0;
  let pick_second: f32 = select(0.0, 1.0, blend > threshold);

  return mix(c0, c1, pick_second);
}

fn contrast(color: vec3<f32>, contrast: f32) -> vec3<f32> {
  return clamp(((color - vec3<f32>(0.5)) * contrast) + vec3<f32>(0.5), vec3<f32>(0.0), vec3<f32>(1.0));
}

fn saturation(color: vec3<f32>, saturation: f32) -> vec3<f32> {
  let gray: f32 = dot(color, vec3<f32>(0.299, 0.587, 0.114)); // standard luminance
  return clamp(mix(vec3<f32>(gray), color, saturation), vec3<f32>(0.0), vec3<f32>(1.0));
}

fn brightness(color: vec3<f32>, brightness: f32) -> vec3<f32> {
  return clamp(color + vec3<f32>(brightness), vec3<f32>(0.0), vec3<f32>(1.0));
}

@vertex
fn vs_main(@builtin(vertex_index) vid: u32) -> @builtin(position) vec4<f32> {
  var pos = array<vec2<f32>, 3>(vec2<f32>(-1.0, -1.0), vec2<f32>(3.0, -1.0), vec2<f32>(-1.0, 3.0));
  return vec4<f32>(pos[vid], 0.0, 1.0);
}

@fragment
fn fs_main(@builtin(position) frag_coord: vec4<f32>) -> @location(0) vec4<f32> {
  let uv = frag_coord.xy / vec2<f32>(textureDimensions(gbuffer_position));
  let coords: vec2<u32> = vec2<u32>(u32(frag_coord.x), u32(frag_coord.y));

  let position = textureSample(gbuffer_position, gbuffer_sampler, uv).xyz;
  let normal = normalize(textureSample(gbuffer_normal, gbuffer_sampler, uv).xyz);
  let albedo = textureSample(gbuffer_albedo, gbuffer_sampler, uv).xyz;
  let emissive = textureSample(gbuffer_emissive, gbuffer_sampler, uv);
  let metallicRoughnessAOAlpha = textureSample(gbuffer_metallicRoughnessAOAlpha, gbuffer_sampler, uv);
  let metallic = metallicRoughnessAOAlpha.x;
  let roughness = clamp(metallicRoughnessAOAlpha.y, 0.05, 1.0);

  let exposure = 0.005;
  let PI: f32 = 3.14159265;
  var direct_lighting = vec3<f32>(1.0);

  let cameraPosition = camera.inverseViewMatrix[3].xyz;
  let view_dir = normalize(cameraPosition - position);

  for (var i = 0u; i < num_lights; i = i + 1u) {
    let light = lights[i];
    let L = light.position - position;
    let dist = length(L);
    let light_dir = normalize(L);

    let radiant_intensity = light.intensity / (4.0 * PI);
    let attenuation = 1.0 / max(dist * dist, 1e-6);
    let radiance = light.color * radiant_intensity * attenuation;

    let NdotL = max(dot(normal, light_dir), 0.0);
    if (NdotL < 0.001) { continue; }

    let diffuse = (albedo / PI) * NdotL;
    let halfway = normalize(light_dir + view_dir);
    let NdotH = max(dot(normal, halfway), 0.0);
    let NdotV = max(dot(normal, view_dir), 0.0);

    let F0 = mix(vec3<f32>(0.04), albedo, metallic);
    let F = F0 + (1.0 - F0) * pow(1.0 - NdotV, 5.0);

    let r = clamp(roughness, 0.05, 1.0);
    let alpha = r * r;
    let alpha2 = alpha * alpha;

    let denom = (NdotH * NdotH) * (alpha2 - 1.0) + 1.0;
    let D = alpha2 / (PI * denom * denom + 1e-5);

    let k = (r + 1.0) * (r + 1.0) / 8.0;
    let Gv = NdotV / (NdotV * (1.0 - k) + k);
    let Gl = NdotL / (NdotL * (1.0 - k) + k);
    let G = Gv * Gl;

    let specular_brdf = (D * F * G) / (4.0 * NdotV * NdotL + 1e-5);
    let diff_contrib = diffuse * (1.0 - metallic);
    let outgoing = (diff_contrib + specular_brdf * 0.5) * radiance;

    direct_lighting += outgoing;
  }

  var lighting = mix(vec3<f32>(1.0) * exposure, emissive.rgb, emissive.a);

  var lightingWithEmissive = mix(direct_lighting * exposure, emissive.rgb, emissive.a);

  let graded_albedo = saturation(contrast(brightness(albedo, 0.15), 1.5), 1.5);
  let final_color = dither_palette_color(graded_albedo, coords);
  // let final_color = nearest_palette_color(contrast(lightingWithEmissive, 5.0));

  return vec4<f32>(final_color, 1.0);
}