import { Simulation } from "..";
import { SimulationCommand } from "./_command";

/**
 * Debug command.
 */
export class LogCommand extends SimulationCommand {
  constructor(public log: string) {
    super()
  }

  public Execute(simulation: Simulation): void {
    console.log(this.log)
  }
}
