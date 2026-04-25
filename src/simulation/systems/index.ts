import type { SimulationState } from "../SimulationState"
import { movementSystem } from "./movementSystem"
import { physicsSystem } from "./physicsSystem"
import { sensorSystem } from "./sensorSystem"

export const Tick = (state: SimulationState) => {
  physicsSystem(state)
  movementSystem(state)
  sensorSystem(state)
}
