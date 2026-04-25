import type { WebGPUContext } from "../graphics/webgpu"
import { EntityRegistry } from "./EntityRegistry"
import { ViewSync } from "./ViewSync"
import { SimulationState } from "./SimulationState"
import { createCamera } from "../graphics/webgpu/camera"

let simulationIndex = 0

/**
 * Contains all state and view data for a scene.
 */
export class Simulation {
  /**
   * Useful for identifying lingering simulations.
   */
  public readonly SimulationIndex = simulationIndex++

  public EntityRegistry = new EntityRegistry()
  public SimulationState = new SimulationState()

  public ViewSync: ViewSync
  public LastFrameTime = 0
  public AccumulatedTime = 0

  public Camera = createCamera(60, 0.1, 1000)

  constructor(
    public gpuContext: WebGPUContext
  ) {
    this.ViewSync = new ViewSync(this)
  }
}
