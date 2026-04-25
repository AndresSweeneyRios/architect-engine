import { SimulationCommand } from "./commands/_command"
import { EntId } from "./EntityRegistry"
import { SimulationEvent } from "./events/_event"
import { HintRepository } from "./repository/HintRepository"
import { LightRepository } from "./repository/LightRepository"
import { MeshRepository } from "./repository/MeshRepository"
import { MovementRepository } from "./repository/MovementRepository"
import { PhysicsRepository } from "./repository/PhysicsRepository"
import { SceneGraphRepository } from "./repository/SceneGraphRepository"
import { SensorCommandRepository } from "./repository/SensorCommandRepository"
import { SensorTargetRepository } from "./repository/SensorTargetRepository"
import { StatRepository } from "./repository/StatRepository"
import { TransformRepository } from "./repository/TransformRespository"

export class SimulationState {
  /**
   * This is used to ensure that systems operate at a consistent perceived speed
   * such that we can adjust the simulation tick rate without affecting gameplay.
   */
  public SimulationDeltaTime: number = 0

  PhysicsRepository = PhysicsRepository.Factory()
  MovementRepository = MovementRepository.Factory()
  SensorTargetRepository = SensorTargetRepository.Factory()
  SensorCommandRepository = SensorCommandRepository.Factory()
  StatRepository = StatRepository.Factory()
  HintRepository = HintRepository.Factory()
  SceneGraphRepository = SceneGraphRepository.Factory()
  TransformRepository = TransformRepository.Factory()
  MeshRepository = MeshRepository.Factory()
  LightRepository = LightRepository.Factory()

  public Commands: SimulationCommand[] = []
  public Events: SimulationEvent[] = []

  Destroy(entId: EntId): void {
    this.PhysicsRepository.RemoveComponent(entId)
    this.MovementRepository.RemoveComponent(entId)
    this.SensorTargetRepository.RemoveComponent(entId)
    this.SensorCommandRepository.RemoveComponent(entId)
    this.StatRepository.RemoveComponent(entId)
    this.HintRepository.RemoveComponent(entId)
    this.SceneGraphRepository.RemoveComponent(entId)
    this.TransformRepository.RemoveComponent(entId)
    this.MeshRepository.RemoveComponent(entId)
    this.LightRepository.RemoveComponent(entId)
  }
}
