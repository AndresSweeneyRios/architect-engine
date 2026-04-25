import {
  SimulationRepository,
  SimulationComponent,
} from "./_repository"

import {
  EntId,
} from "../EntityRegistry"

export enum HintType {
  NONE = "NONE",
  LOOK = "LOOK",
}

class HintComponent extends SimulationComponent {
  public type = HintType.NONE
  public position: [number, number, number] = [0, 0, 0]
}

/**
 * Provides visual cues to the player, such as where to look or interact.
 */
export class HintRepository extends SimulationRepository<HintComponent> {
  SetType(entId: EntId, type: HintType) {
    const component = this.components.get(entId)
    if (component) {
      component.type = type
    } else {
      console.warn(`HintRepository: No component found for entity`, entId)
    }
  }

  SetPosition(entId: EntId, position: [number, number, number]) {
    const component = this.components.get(entId)
    if (component) {
      component.position = position
    } else {
      console.warn(`HintRepository: No component found for entity`, entId)
    }
  }

  GetPosition(entId: EntId): [number, number, number] | undefined {
    const component = this.components.get(entId)
    if (component) {
      return component.position
    } else {
      console.warn(`HintRepository: No component found for entity`, entId)
      return undefined
    }
  }

  GetHintsOfType(type: HintType): EntId[] {
    const hints: EntId[] = []

    for (const [entId, component] of this.components.entries()) {
      if (component.type === type) {
        hints.push(entId)
      }
    }

    return hints
  }

  public static Factory() {
    return new HintRepository(HintComponent)
  }
}
