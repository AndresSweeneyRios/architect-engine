import type { vec3 } from "gl-matrix"
import type { EntId } from "../EntityRegistry"
import {
  SimulationRepository,
  SimulationComponent,
} from "./_repository"

class LightComponent extends SimulationComponent {
  color: vec3 = [1, 1, 1]
  range: number = 4.5
  intensity: number = 1.0
}

/**
 * Currently only supports point lights.
 */
export class LightRepository extends SimulationRepository<LightComponent> {
  public GetColor(entId: EntId): vec3 {
    const component = this.components.get(entId)

    if (!component) {
      throw new Error(`Light component not found for entity ${String(entId)}`)
    }

    return component.color
  }

  public SetColor(entId: EntId, color: vec3): void {
    const component = this.components.get(entId)

    if (!component) {
      throw new Error(`Light component not found for entity ${String(entId)}`)
    }

    component.color = color
  }

  public GetRange(entId: EntId): number {
    const component = this.components.get(entId)

    if (!component) {
      throw new Error(`Light component not found for entity ${String(entId)}`)
    }

    return component.range
  }

  public SetRange(entId: EntId, range: number): void {
    const component = this.components.get(entId)

    if (!component) {
      throw new Error(`Light component not found for entity ${String(entId)}`)
    }

    component.range = range
  }

  public GetIntensity(entId: EntId): number {
    const component = this.components.get(entId)

    if (!component) {
      throw new Error(`Light component not found for entity ${String(entId)}`)
    }

    return component.intensity
  }

  public SetIntensity(entId: EntId, intensity: number): void {
    const component = this.components.get(entId)

    if (!component) {
      throw new Error(`Light component not found for entity ${String(entId)}`)
    }

    component.intensity = intensity
  }

  public static Factory() {
    return new LightRepository(LightComponent)
  }
}
