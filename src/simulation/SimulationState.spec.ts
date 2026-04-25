import { describe, it, expect, vi } from 'vitest'
import { SimulationState } from './SimulationState'
import { SimulationRepository } from "./repository/_repository"

describe('SimulationState', () => {
  it('cleans up all repository components on Destroy using HasComponent', () => {
    const state = new SimulationState()
    const entId = 'test-entity'

    for (const key of Object.keys(state)) {
      // @ts-ignore
      const repo = (state as object)[key]

      if (repo instanceof SimulationRepository) {
        // @ts-ignore
        repo.CreateComponent(entId)
        // @ts-ignore
        expect(repo.HasComponent(entId)).toBe(true)
      }
    }

    state.Destroy(entId as any)

    for (const key of Object.keys(state)) {
      // @ts-ignore
      const repo = (state as object)[key]
      if (repo instanceof SimulationRepository) {
        // @ts-ignore
        expect(repo.HasComponent(entId)).toBe(false)
      }
    }
  })
})
