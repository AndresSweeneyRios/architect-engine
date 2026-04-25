import {
  SimulationRepository,
  SimulationComponent,
} from "./_repository"

import {
  EntId,
} from "../EntityRegistry"

import {
  vec3,
} from "gl-matrix"

class MovementComponent extends SimulationComponent {
  public direction: vec3 = vec3.create()
  public previousDirection: vec3 = vec3.create()
  public lockVerticalMovement = false
}

export class MovementRepository extends SimulationRepository<MovementComponent> {
  public SetDirection(entId: EntId, direction: vec3) {
    this.components.get(entId)!.direction = direction
  }

  public SetPreviousDirection(entId: EntId, direction: vec3) {
    this.components.get(entId)!.previousDirection = direction
  }

  public GetDirection(entId: EntId) {
    const direction = this.components.get(entId)!.direction

    return vec3.clone(direction)
  }

  public GetPreviousDirection(entId: EntId) {
    const direction = this.components.get(entId)!.previousDirection

    return vec3.clone(direction)
  }

  public SetLockVerticalMovement(entId: EntId, lockVerticalMovement: boolean) {
    this.components.get(entId)!.lockVerticalMovement = lockVerticalMovement
  }

  public GetLockVerticalMovement(entId: EntId) {
    return this.components.get(entId)!.lockVerticalMovement
  }

  public static Factory() {
    return new MovementRepository(MovementComponent)
  }
}
