import type { vec3 } from "gl-matrix";
import type { Simulation } from ".."
import type { EntId } from "../EntityRegistry";

/**
 * Commands are executed immediately before the next simulation tick once pushed to the simulation state.
 */
export abstract class SimulationCommand {
  public EntId: EntId | null = null
  public Position: vec3 | null = null
  public Rotation: vec3 | null = null

  public abstract Execute(simulation: Simulation): void
}

/**
 * Associates a command with a target entity.
 * 
 * @see {@link SimulationCommand}
 */
export abstract class SimulationCommandWithTarget extends SimulationCommand {
  public TargetEntId: EntId | null = null
}
