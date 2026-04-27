
import type { Simulation } from "."
import { Tick } from "./systems"
import { draw } from "../graphics/webgpu/renderer"

/**
 * In the event that the tab is paused for an extended period of time, we skip frames to catch up.
 * 
 * This impacts determinism and should be used thoughtfully.
 */
export const MAX_ALLOWED_PAUSE = 1000

/**
 * Target frame duration in milliseconds.
 */
const FRAME_DURATION_MS = 1000 / 60

/**
 * Normalized frame duration in seconds, used for fixed time step updates and delta time operations.
 */
const FRAME_DURATION_S = FRAME_DURATION_MS / 1000

export function stepLoop(simulation: Simulation, now: number) {
  const viewSync = simulation.ViewSync

  let dtMs = now - simulation.LastFrameTime
  simulation.LastFrameTime = now

  /**
   * @see {@link MAX_ALLOWED_PAUSE}
   */
  if (dtMs > MAX_ALLOWED_PAUSE) {
    simulation.AccumulatedTime = 0
    dtMs = 0
  }

  simulation.AccumulatedTime += dtMs

  while (simulation.AccumulatedTime >= FRAME_DURATION_MS) {
    simulation.AccumulatedTime -= FRAME_DURATION_MS
    tickSimulation(simulation, FRAME_DURATION_S)
  }

  const alpha = simulation.AccumulatedTime / FRAME_DURATION_MS
  const frameDeltaS = dtMs / 1000
  viewSync.Draw(simulation, alpha, frameDeltaS)
}

/**
 * Advances the simulation by a fixed time step.
 * 
 * @param deltaTime Fixed time step in seconds.
 */
export function tickSimulation(simulation: Simulation, deltaTime: number) {
  const state = simulation.SimulationState
  state.SimulationDeltaTime = deltaTime
  const cmds = state.Commands

  for (const cmd of cmds) {
    cmd.Execute(simulation)
  }

  cmds.length = 0

  Tick(state)

  simulation.ViewSync.Update(simulation)
}

/**
 * @returns Cleanup function to stop the render loop.
 */
export const createRenderLoop = (simulation: Simulation): (() => void) => {
  let isRunning = true

  const render = async () => {
    if (!isRunning) {
      return
    }

    try {
      const now = performance.now()

      stepLoop(simulation, now)

      await draw(simulation)

      render()
    } catch (error) {
      console.error('Render loop error:', error)
    }
  }

  render()

  return () => {
    isRunning = false
  }
}
