import type { Simulation } from "."
import type { EntityView } from "./EntityView"

/**
 * Auxiliary View that is not tied to a specific entity. This will not receive events and will not be cleaned up automatically until Cleanup is called on the ViewSync.
 * 
 * @see {@link EntityView}
 */
export abstract class View {
  constructor(
    /**
     * Unique ID.
     */
    public Symbol: symbol = window.Symbol()
  ) {
  }

  /**
   * Synced to the monitor's refresh rate provided by the browser.
   */
  public Draw?(simulation: Simulation, lerpFactor: number, delta: number): void

  /**
   * Called every simulation tick, less frequently than Draw.
   */
  public Update?(simulation: Simulation): void

  /**
   * Before the view is destroyed, this is called to allow it to clean up any resources or references it may have.
   */
  public Cleanup?(simulation: Simulation): void

  /**
   * This is called when the camera parameters may have changed (e.g. on window resize), allowing views to update any cached projection matrices or similar data.
   */
  public CameraUpdate?(simulation: Simulation): void
}
