import type { Simulation } from "."
import type { EntId } from "./EntityRegistry"
import type { EntityView } from "./EntityView"
import { View } from "./View"

/**
 * Responsible for synchronizing the state of the simulation with all view objects.
 * 
 * Views use a pull model, querying the simulation and interpolating between states for 
 * smooth rendering, independent of the simulation's tick frequency.
 */
export class ViewSync {
  private entityViews = new Map<EntId, EntityView>()
  private auxiliaryViews = new Map<symbol, View>()

  private startTime = Date.now()

  public TimeMS = 0
  public DrawDeltaTime = 0

  /**
   * Entity Views can be invoked with events from the simulation, and are automatically cleaned up when their associated entity is removed.
   */
  public AddEntityView(view: EntityView) {
    this.entityViews.set(view.EntId, view)
  }

  /**
   * For effects that aren't tied to a specific entity, Auxiliary Views can be used.
   */
  public AddAuxiliaryView(view: View) {
    this.auxiliaryViews.set(view.Symbol, view)
  }

  public Draw(simulation: Simulation, lerpFactor: number, frameDeltaTime: number) {
    const currentTime = Date.now()
    this.TimeMS = currentTime - this.startTime
    this.DrawDeltaTime = frameDeltaTime

    for (const view of this.entityViews.values()) {
      view.Draw?.(simulation, lerpFactor, this.DrawDeltaTime)
    }

    for (const view of this.auxiliaryViews.values()) {
      view.Draw?.(simulation, lerpFactor, this.DrawDeltaTime)
    }
  }

  public Update(simulation: Simulation) {
    for (const view of this.entityViews.values()) {
      view.Update?.(simulation)
    }

    for (const view of this.auxiliaryViews.values()) {
      view.Update?.(simulation)
    }
  }

  public Cleanup(simulation: Simulation) {
    for (const view of this.entityViews.values()) {
      view.Cleanup?.(simulation)
    }

    for (const view of this.auxiliaryViews.values()) {
      view.Cleanup?.(simulation)
    }

    this.entityViews.clear()
    this.auxiliaryViews.clear()
  }

  /**
   * This is called when the camera parameters may have changed (e.g. on window resize), allowing views to update any cached projection matrices or similar data.
   */
  public CameraUpdate(simulation: Simulation) {
    for (const view of this.entityViews.values()) {
      view.CameraUpdate?.(simulation)
    }

    for (const view of this.auxiliaryViews.values()) {
      view.CameraUpdate?.(simulation)
    }
  }

  public DestroyEntityView(simulation: Simulation, entId: EntId) {
    const view = this.entityViews.get(entId)

    if (view) {
      view.Cleanup?.(simulation)
      this.entityViews.delete(entId)
    }
  }

  public DestroyAuxiliaryView(simulation: Simulation, symbol: symbol) {
    const view = this.auxiliaryViews.get(symbol)

    if (view) {
      view.Cleanup?.(simulation)
      this.auxiliaryViews.delete(symbol)
    }
  }

  public GetAllViews(): View[] {
    return [...this.entityViews.values(), ...this.auxiliaryViews.values()]
  }

  constructor(simulation: Simulation) {
    this.CameraUpdate(simulation)

    window.addEventListener('resize', () => this.CameraUpdate(simulation))
  }
}
