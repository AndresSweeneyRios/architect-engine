import { mat4, vec3 } from "gl-matrix"
import * as THREE from "three"
import { Camera } from "../graphics/webgpu/camera"

export const lerp = (a: number, b: number, t: number) => {
  return a + (b - a) * t
}

export const lerpVec3 = (a: vec3, b: vec3, t: number) => {
  return vec3.fromValues(
    lerp(a[0], b[0], t),
    lerp(a[1], b[1], t),
    lerp(a[2], b[2], t),
  )
}

export const vec3ToThree = (v: vec3) => {
  return new THREE.Vector3(v[0], v[1], v[2])
}

export const threeToMat4 = (m: THREE.Matrix4) => {
  return m.elements.slice() as mat4
}

export function getAngleToPlayer(
  object: THREE.Vector3,
  player: THREE.Vector3,
  camera: Camera
): number {
  const playerToObj = new THREE.Vector3().subVectors(object, player).normalize()

  const camDir = new THREE.Vector3()
  const direction = camera.getDirection()

  camDir.set(direction[0], direction[1], direction[2])

  playerToObj.y = 0
  camDir.y = 0
  playerToObj.normalize()
  camDir.normalize()

  const angleRad = playerToObj.angleTo(camDir)
  const angleDeg = THREE.MathUtils.radToDeg(angleRad)

  return angleDeg
}

export function getMeshCenter(mesh: THREE.Mesh): THREE.Vector3 {
  mesh.geometry.computeBoundingBox()

  const boundingBox = mesh.geometry.boundingBox

  if (!boundingBox) {
    return new THREE.Vector3()
  }

  const center = new THREE.Vector3()

  boundingBox.getCenter(center)

  mesh.localToWorld(center)

  return center
}
