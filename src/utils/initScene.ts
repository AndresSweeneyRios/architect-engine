import * as THREE from "three"
import type { Simulation } from "../simulation"
import type { EntId } from "../simulation/EntityRegistry"
import { traverseThreeDFS } from "./traverse"
import { commands } from "../simulation/commands"
import { HintType } from "../simulation/repository/HintRepository"
import { threeToMat4 } from "./math"
import { extractMesh, loadPackedScene } from "../graphics/gltf"
import { ASSET_MANIFEST } from "../assets/manifest"

interface InitSceneOptions {
  scene: keyof typeof ASSET_MANIFEST
  addRigidBody?: boolean
}

/**
 * Loads a GLTF scene from the manifest and initializes the colliders, commands, sensors, and meshes in the simulation state.
 */
export const initScene = async (
  simulation: Simulation,
  options: InitSceneOptions
) => {
  const scene = await loadPackedScene(options.scene);

  scene.updateMatrixWorld(true);

  const state = simulation.SimulationState
  const { gpuContext } = simulation

  const promises: Promise<void>[] = []

  let sceneEntId: EntId | null = null;

  const objectToEntId = new Map<THREE.Object3D, EntId>()

  for (const {
    object: child,
    symbol: childEntId,
    parent: parentEntId,

    skip,
  } of traverseThreeDFS(scene)) {
    objectToEntId.set(child, childEntId)

    if (sceneEntId === null) {
      sceneEntId = childEntId
    }

    state.SceneGraphRepository.CreateComponent(childEntId)
    state.TransformRepository.CreateComponent(childEntId)

    state.SceneGraphRepository.SetName(childEntId, child.name)

    if (parentEntId !== null) {
      state.SceneGraphRepository.AddChild(parentEntId, childEntId)
    }

    const localMatrix = threeToMat4(child.matrix)
    const worldMatrix = threeToMat4(child.matrixWorld)

    state.TransformRepository.SetLocalMatrix(childEntId, localMatrix)
    state.TransformRepository.SetWorldMatrix(childEntId, worldMatrix)


    if (child.name === 'COLLIDERS' || child.name.includes('COLLIDER')) {
      simulation.SimulationState.PhysicsRepository.CreateComponent(sceneEntId)
      simulation.SimulationState.PhysicsRepository.AddCollidersFromObject(sceneEntId, child, options.addRigidBody)

      continue
    } else if (child.name === 'COMMANDS') {
      for (const { object: command } of traverseThreeDFS(child, { yieldFirst: false })) {
        if (HintType[command.name as keyof typeof HintType] !== undefined) {
          const hintEntId = simulation.EntityRegistry.Create()
          const hintType = HintType[command.name as keyof typeof HintType]

          simulation.SimulationState.HintRepository.CreateComponent(hintEntId)
          simulation.SimulationState.HintRepository.SetType(hintEntId, hintType)
          simulation.SimulationState.HintRepository.SetPosition(hintEntId, [
            command.position.x,
            command.position.y,
            command.position.z,
          ])

          command.visible = false

          continue
        }

        for (const commandName in commands) {
          if (command.name.replace(/[0-9]+$/g, '') === commandName) {
            const commandClass = commands[commandName as keyof typeof commands]

            const commandInstance = new commandClass()

            const worldPosition = new THREE.Vector3()
            command.getWorldPosition(worldPosition)
            commandInstance.Position = [
              worldPosition.x,
              worldPosition.y,
              worldPosition.z,
            ]

            commandInstance.Rotation = [
              command.rotation.x,
              command.rotation.y,
              command.rotation.z,
            ]

            commandInstance.EntId = childEntId

            simulation.SimulationState.Commands.push(commandInstance)

            continue
          }
        }
      }

      skip()

      continue
    } else if (child.name === "SENSORS") {
      const isSensor = true

      simulation.SimulationState.PhysicsRepository.AddCollidersFromObject(childEntId, child, options.addRigidBody, isSensor)

      continue
    } else if (child instanceof THREE.Mesh || child instanceof THREE.SkinnedMesh) {
      const promise = extractMesh(gpuContext, child, options.scene).then(symbol => {
        if (!symbol) {
          throw new Error(`Failed to extract mesh for object: ${child.name}`)
        }

        state.MeshRepository.CreateComponent(childEntId)
        state.MeshRepository.SetSymbol(childEntId, symbol)

        if (child instanceof THREE.SkinnedMesh) {
          const bones = child.skeleton.bones.map(bone => objectToEntId.get(bone)).filter(id => id !== undefined) as EntId[]
          gpuContext.meshBones.set(symbol, bones)
        }
      })

      promises.push(promise)
    } else if (child instanceof THREE.PointLight) {
      state.LightRepository.CreateComponent(childEntId)

      state.LightRepository.SetColor(childEntId, [
        child.color.r,
        child.color.g,
        child.color.b,
      ])

      state.LightRepository.SetIntensity(childEntId, child.intensity)
      state.LightRepository.SetRange(childEntId, 4.15)
    }
  }

  await Promise.all(promises)

  if (sceneEntId === null) {
    throw new Error("Failed to initialize scene: No entities were created.")
  }

  return sceneEntId
}
