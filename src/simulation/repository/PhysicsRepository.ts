import {
  SimulationRepository,
  SimulationComponent,
} from "./_repository"

import {
  EntId,
} from "../EntityRegistry"

import {
  vec3,
} from "gl-matrix"

import * as THREE from "three"
import { traverseThreeDFS } from "../../utils/traverse"
import RAPIER from "@dimforge/rapier3d-compat"
import { getMeshCenter } from "../../utils/math"

export const rapierFinishedLoading = (async () => {
  await RAPIER.init()
})()

const TERMINAL_VELOCITY = 50
let GRAVITY = -1

export const setGravity = (gravity: number) => {
  GRAVITY = gravity
}

class PhysicsComponent extends SimulationComponent {
  public colliders = new Map<symbol, InstanceType<typeof RAPIER.Collider>>()
  public colliderUuidMap = new Map<string, symbol>()
  public characters = new Map<symbol, InstanceType<typeof RAPIER.KinematicCharacterController>>()
  public bodies = new Map<symbol, InstanceType<typeof RAPIER.RigidBody>>()

  public offset: vec3 = [-Infinity, -Infinity, -Infinity]

  public GetFirstCollider(): InstanceType<typeof RAPIER.Collider> | undefined {
    for (const collider of this.colliders.values()) {
      return collider;
    }
    return undefined;
  }

  public GetFirstCharacter(): InstanceType<typeof RAPIER.KinematicCharacterController> | undefined {
    for (const character of this.characters.values()) {
      return character;
    }
    return undefined;
  }

  public GetFirstBody(): InstanceType<typeof RAPIER.RigidBody> | undefined {
    for (const body of this.bodies.values()) {
      return body;
    }
    return undefined;
  }

  public previousPosition: vec3 = vec3.create()
  public verticalVelocity: number = 0
  public affectedByGravity: boolean = false
}

/**
 * Uses the Rapier rust-based physics engine compiled to WebAssembly for physics simulation.
 */
export class PhysicsRepository extends SimulationRepository<PhysicsComponent> {
  world: InstanceType<typeof RAPIER.World> = new RAPIER.World(new RAPIER.Vector3(0, -9.81, 0))

  public GetPosition(entId: EntId): vec3 {
    const component = this.components.get(entId)!

    if (component.offset[0] !== -Infinity) {
      return component.offset
    }

    let position: vec3

    if (component.bodies.size > 0) {
      const bodyPosition = component.GetFirstBody()!.translation()
      position = vec3.fromValues(bodyPosition.x, bodyPosition.y, bodyPosition.z)
    } else if (component.colliders.size > 0) {
      const colliderPosition = component.GetFirstCollider()!.translation()
      position = vec3.fromValues(colliderPosition.x, colliderPosition.y, colliderPosition.z)
    } else {
      position = vec3.create()
    }

    return position
  }

  public SetPosition(entId: EntId, position: vec3) {
    const component = this.components.get(entId)!

    for (const body of component.bodies.values()) {
      body.setTranslation(new RAPIER.Vector3(position[0], position[1], position[2]), true)
    }

    for (const collider of component.colliders.values()) {
      collider.setTranslation(new RAPIER.Vector3(position[0], position[1], position[2]))
    }
  }

  public GetPreviousPosition(entId: EntId): vec3 {
    return vec3.clone(this.components.get(entId)!.previousPosition)
  }

  public SetPreviousPosition(entId: EntId, position: vec3) {
    this.components.get(entId)!.previousPosition = vec3.clone(position)
  }

  public SetAffectedByGravity(entId: EntId, affectedByGravity: boolean) {
    this.components.get(entId)!.affectedByGravity = affectedByGravity
  }

  public TickWorld() {
    this.world.step()
  }

  private CreateCharacter(offset: number) {
    const character = this.world.createCharacterController(offset)
    character.setMaxSlopeClimbAngle(45)
    character.enableAutostep(1, 0.01, true)
    character.disableSnapToGround()

    return character;
  }

  public CreateRigidBody(position: vec3) {
    const rigidBodyDesc = RAPIER.RigidBodyDesc.kinematicPositionBased()
    rigidBodyDesc.setCcdEnabled(true)
    rigidBodyDesc.setTranslation(position[0], position[1], position[2])
    const rigidBody = this.world.createRigidBody(rigidBodyDesc)
    rigidBody.lockRotations(true, true)
    rigidBody.setLinearDamping(0.0)
    rigidBody.setAngularDamping(0.0)

    return {
      rigidBody,
      rigidBodyDesc,
    }
  }

  public CreateCharacterControllerWithSphere(entId: EntId, position: vec3, size: number, offset: number) {
    const character = this.CreateCharacter(offset)
    const { rigidBody } = this.CreateRigidBody(position)
    const colliderDesc = RAPIER.ColliderDesc.ball(size)
    const collider = this.world.createCollider(colliderDesc, rigidBody)
    collider.setFriction(0.0)

    this.components.get(entId)!.colliders.set(Symbol(), collider)
    this.components.get(entId)!.characters.set(Symbol(), character)
    this.components.get(entId)!.bodies.set(Symbol(), rigidBody)
  }

  public ApplyGravity(entId: EntId, deltaTime: number) {
    if (!this.components.get(entId)!.affectedByGravity) {
      return
    }

    const component = this.components.get(entId)!
    const collider = component.GetFirstCollider()!
    const character = component.GetFirstCharacter()!
    const body = component.GetFirstBody()!
    component.verticalVelocity += GRAVITY * deltaTime

    if (component.verticalVelocity < -TERMINAL_VELOCITY) {
      component.verticalVelocity = -TERMINAL_VELOCITY
    } else if (component.verticalVelocity > TERMINAL_VELOCITY) {
      component.verticalVelocity = TERMINAL_VELOCITY
    }

    character.computeColliderMovement(collider, new RAPIER.Vector3(0, component.verticalVelocity, 0), RAPIER.QueryFilterFlags.EXCLUDE_SENSORS)

    const computedMovement = character.computedMovement()

    const currentTranslation = body.translation()

    const nextTranslation = new RAPIER.Vector3(
      currentTranslation.x,
      currentTranslation.y + computedMovement.y,
      currentTranslation.z
    )

    body.setNextKinematicTranslation(nextTranslation)

    component.verticalVelocity = computedMovement.y
  }

  public ApplyAllGravity(deltaTime: number) {
    for (const [entId] of this.components) {
      this.ApplyGravity(entId, deltaTime)
    }
  }

  public TryMoveCharacterController(entId: EntId, direction: vec3) {
    const desiredMovement = new RAPIER.Vector3(direction[0], direction[1], direction[2])

    const component = this.components.get(entId)!

    const character = component.GetFirstCharacter()!
    const collider = component.GetFirstCollider()!
    const body = component.GetFirstBody()!

    character.computeColliderMovement(collider, desiredMovement, RAPIER.QueryFilterFlags.EXCLUDE_SENSORS)

    const computedMovement = character.computedMovement()

    const currentTranslation = body.translation()

    const nextTranslation = new RAPIER.Vector3(
      currentTranslation.x + computedMovement.x,
      currentTranslation.y + computedMovement.y,
      currentTranslation.z + computedMovement.z
    )

    body.setNextKinematicTranslation(nextTranslation)
  }

  public RemoveComponent(entId: EntId): void {
    const component = this.components.get(entId)

    if (!component) {
      return
    }

    super.RemoveComponent(entId)

    for (const collider of component.colliders.values()) {
      this.world.removeCollider(collider, false)
    }

    for (const character of component.characters.values()) {
      this.world.removeCharacterController(character)
    }

    for (const body of component.bodies.values()) {
      this.world.removeRigidBody(body)
    }
  }

  public AddMeshCollider(entId: EntId, vertices: Float32Array, indices: Uint32Array, rigidBody?: InstanceType<typeof RAPIER.RigidBody>) {
    let colliderDesc = RAPIER.ColliderDesc.trimesh(vertices, indices)

    const collider = this.world.createCollider(colliderDesc, rigidBody)

    const component = this.components.get(entId)!
    component.colliders.set(Symbol(), collider)

    return collider
  }

  public AddBoxCollider(entId: EntId, halfExtents: vec3, position: vec3, rigidBody?: InstanceType<typeof RAPIER.RigidBody>, sensor = false) {
    let colliderDesc = RAPIER.ColliderDesc.cuboid(halfExtents[0], halfExtents[1], halfExtents[2])
    colliderDesc.setTranslation(position[0], position[1], position[2])

    const collider = this.world.createCollider(colliderDesc, rigidBody)

    collider.setSensor(sensor)

    const component = this.components.get(entId)!
    component.colliders.set(Symbol(), collider)

    return collider
  }

  public AddCollidersFromObject(entId: EntId, object: Readonly<THREE.Object3D>, addCharacter: boolean = false, sensor: boolean = false) {
    const component = this.components.get(entId)!

    const worldPosition = object.getWorldPosition(new THREE.Vector3())

    if (addCharacter && !component.GetFirstCharacter()) {
      const rigidBody = this.CreateRigidBody(vec3.fromValues(
        worldPosition.x,
        worldPosition.y,
        worldPosition.z
      )).rigidBody

      rigidBody.setRotation(new RAPIER.Quaternion(
        object.quaternion.x,
        object.quaternion.y,
        object.quaternion.z,
        object.quaternion.w
      ), true)

      const character = this.CreateCharacter(0)

      component.bodies.set(Symbol(), rigidBody)
      component.characters.set(Symbol(), character)
    }

    const offsets: THREE.Vector3[] = []

    for (const { object: child } of traverseThreeDFS(object)) {
      if (child.type !== "Mesh") {
        continue
      }

      const geometry = (child as THREE.Mesh).geometry as THREE.BufferGeometry
      const vertices = new Float32Array(geometry.getAttribute("position").array)

      const indices = geometry.getIndex()
        ? geometry.getIndex()!.array as Uint32Array
        : new Uint32Array(Array.from({ length: vertices.length / 3 }, (_, i) => i)); // Generate sequential indices for non-indexed geometry

      const worldPosition = child.getWorldPosition(new THREE.Vector3())
      const center = getMeshCenter(child as THREE.Mesh)

      const offset = new THREE.Vector3()
      offset.subVectors(center, worldPosition)
      offsets.push(offset)

      const translation = new RAPIER.Vector3(worldPosition.x, worldPosition.y, worldPosition.z)
      const rotation = new RAPIER.Quaternion(child.quaternion.x, child.quaternion.y, child.quaternion.z, child.quaternion.w)
      const scaledScale = new RAPIER.Vector3(child.scale.x, child.scale.y, child.scale.z)

      // for (const parent of traverseParents(child)) {
      //   if (addCharacter && parent.uuid === object.uuid) {
      //     continue
      //   }

      //   scaledScale.x *= parent.scale.x
      //   scaledScale.y *= parent.scale.y
      //   scaledScale.z *= parent.scale.z
      // }

      for (let i = 0; i < vertices.length; i += 3) {
        vertices[i] *= scaledScale.x
        vertices[i + 1] *= scaledScale.y
        vertices[i + 2] *= scaledScale.z

        const vertex = [vertices[i], vertices[i + 1], vertices[i + 2]] as vec3
        const rotatedVertex = vec3.create()
        vec3.transformQuat(rotatedVertex, vertex, [rotation.x, rotation.y, rotation.z, rotation.w])
        vertices[i] = rotatedVertex[0]
        vertices[i + 1] = rotatedVertex[1]
        vertices[i + 2] = rotatedVertex[2]

        vertices[i] += translation.x
        vertices[i + 1] += translation.y
        vertices[i + 2] += translation.z
      }

      const collider = this.AddMeshCollider(entId, vertices, indices, addCharacter ? component.GetFirstBody() : undefined)

      collider.setSensor(sensor)

      const symbol = Symbol()

      component.colliderUuidMap.set(child.uuid, symbol)
    }

    const computedOffset = offsets.reduce((acc, offset) => {
      acc.add(offset)
      return acc
    }, new THREE.Vector3())

    component.offset = [computedOffset.x, computedOffset.y, computedOffset.z]
  }

  public GetAllColliders() {
    const colliders: {
      symbol: symbol,
      collider: InstanceType<typeof RAPIER.Collider>,
      entId: EntId,
    }[] = []

    for (const [entId, component] of this.components) {
      for (const [symbol, collider] of component.colliders) {
        colliders.push({
          symbol,
          collider,
          entId,
        })
      }
    }

    return colliders
  }

  public GetColliderByUuid(uuid: string, entId?: EntId) {
    if (entId) {
      const component = this.components.get(entId)!

      const symbol = component.colliderUuidMap.get(uuid)

      if (symbol) {
        return {
          symbol,
          entId,
        }
      }
    } else {
      for (const [entId, component] of this.components) {
        const symbol = component.colliderUuidMap.get(uuid)

        if (symbol) {
          return {
            symbol,
            entId,
          }
        }
      }
    }

    return undefined
  }

  public GetSensors(entId: EntId) {
    const component = this.components.get(entId)!

    const sensors: symbol[] = []

    for (const [symbol, collider] of component.colliders) {
      if (collider.isSensor()) {
        sensors.push(symbol)
      }
    }

    return sensors
  }

  public GetIsSensorCollidingWithTarget(entId: EntId, symbol: symbol, target: EntId): boolean {
    const component = this.components.get(entId)!
    const targetComponent = this.components.get(target)!

    const collider = component.colliders.get(symbol)!

    if (!collider.isSensor()) {
      return false
    }

    const targetCharacter = targetComponent.GetFirstCharacter()!
    const targetCollider = targetComponent.GetFirstCollider()!

    let touching = false

    targetCharacter.computeColliderMovement(
      targetCollider,
      new RAPIER.Vector3(0, 0, 0),
      RAPIER.QueryFilterFlags.EXCLUDE_SOLIDS,
      undefined,
      (otherCollider) => {
        if (otherCollider.handle === collider.handle) {
          touching = true;
          return false;
        }
        return true;
      }
    );

    return touching
  }

  public GetFirstBody(entId: EntId) {
    return this.components.get(entId)!.GetFirstBody()
  }

  public static Factory() {
    return new PhysicsRepository(PhysicsComponent)
  }
}
