import { describe, it, expect } from 'vitest'
import { vec3 } from 'gl-matrix'
import * as THREE from 'three'
import { lerp, lerpVec3, vec3ToThree, getAngleToPlayer, getMeshCenter } from './math'
import { createCamera } from "../graphics/webgpu/camera"

describe('math utilities', () => {
  it('lerp works correctly', () => {
    expect(lerp(0, 10, 0.5)).toBe(5)
  })

  it('lerpVec3 interpolates vectors', () => {
    const a = vec3.fromValues(0, 0, 0)
    const b = vec3.fromValues(2, 2, 2)
    const result = lerpVec3(a, b, 0.5)
    expect(Array.from(result)).toEqual([1, 1, 1])
  })

  it('vec3ToThree converts correctly', () => {
    const v = vec3.fromValues(1, 2, 3)
    const t = vec3ToThree(v)
    expect(t).toBeInstanceOf(THREE.Vector3)
    expect(t.x).toBe(1)
    expect(t.y).toBe(2)
    expect(t.z).toBe(3)
  })

  it('getAngle calculates angle to camera', () => {
    const object = new THREE.Vector3(1, 0, 0)
    const player = new THREE.Vector3(0, 0, 0)
    const camera = createCamera(60, 0.1, 100)
    camera.setPosition([0, 0, 0])
    camera.setRotation(0, 0)
    const angle = getAngleToPlayer(object, player, camera)
    expect(angle).toBeCloseTo(0, 5)
  })

  it('getMeshCenter returns world center', () => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), new THREE.MeshBasicMaterial())
    mesh.position.set(1, 2, 3)
    const center = getMeshCenter(mesh)
    expect(center.x).toBeCloseTo(1)
    expect(center.y).toBeCloseTo(2)
    expect(center.z).toBeCloseTo(3)
  })
})
