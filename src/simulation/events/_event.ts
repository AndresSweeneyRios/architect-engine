import type { Simulation } from ".."

/**
 * Represents a change in the simulation that should be pushed up to the view layer.
 * 
 * Currently unused, pull-model view sync has been much more effective.
 */
export abstract class SimulationEvent {
  public abstract Execute(simulation: Simulation): void

  public abstract Undo(simulation: Simulation): void
}
