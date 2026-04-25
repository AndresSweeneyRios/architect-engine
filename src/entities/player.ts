import type { Simulation } from "../simulation";
import type { vec3 } from "gl-matrix";

export const createPlayer = (simulation: Simulation, position: vec3): symbol => {
  const entId = simulation.EntityRegistry.Create();

  return entId;
};
