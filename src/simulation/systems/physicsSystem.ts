import { mat4 } from "gl-matrix"
import { SimulationState } from "../SimulationState"
import type { EntId } from "../EntityRegistry"

const computeWorldMatrix = (state: SimulationState, entId: EntId) => {
  const parentEntId = state.SceneGraphRepository.GetParent(entId)

  if (parentEntId === null) {
    // For root objects, world matrix = local matrix
    const localMatrix = state.TransformRepository.GetLocalMatrix(entId)
    state.TransformRepository.SetWorldMatrix(entId, mat4.clone(localMatrix))

    return
  }

  const parentWorldMatrix = state.TransformRepository.GetWorldMatrix(parentEntId)
  const childLocalMatrix = state.TransformRepository.GetLocalMatrix(entId)

  const worldMatrix = mat4.create()
  mat4.multiply(worldMatrix, parentWorldMatrix, childLocalMatrix)
  state.TransformRepository.SetWorldMatrix(entId, worldMatrix)
}

// TODO: ignore duplicate calculations for descendants
const computeWorldMatrices = (state: SimulationState) => {
  const needsUpdate = state.TransformRepository.GetNeedsUpdate()

  for (const entId of needsUpdate) {
    computeWorldMatrix(state, entId)

    for (const descendentEntId of state.SceneGraphRepository.GetDescendants(entId)) {
      computeWorldMatrix(state, descendentEntId)
    }
  }

  state.TransformRepository.ClearNeedsUpdate()
}

/**
 * Applies gravity and resolves collisions.
 * 
 * NOTE: currently disabled for graphics debugging.
 */
export const physicsSystem = (state: SimulationState) => {
  computeWorldMatrices(state)

  // for (const entId of state.PhysicsRepository.Components) {
  //   const position = state.PhysicsRepository.GetPosition(entId)
  //   state.PhysicsRepository.SetPreviousPosition(entId, position)
  // }

  // state.PhysicsRepository.TickWorld()

  // state.PhysicsRepository.ApplyAllGravity(state.DeltaTime)

  // state.PhysicsRepository.TickWorld()

  computeWorldMatrices(state)
}
