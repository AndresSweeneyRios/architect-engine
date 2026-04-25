import type { EntId } from "../EntityRegistry"
import {
  SimulationRepository,
  SimulationComponent,
} from "./_repository"

class MeshComponent extends SimulationComponent {
  symbol: symbol | null = null
}

/**
 * Used to keep track of meshes associated with entities.
 */
export class MeshRepository extends SimulationRepository<MeshComponent> {
  public SetSymbol(entId: EntId, symbol: symbol) {
    const entity = this.components.get(entId)

    if (!entity) {
      throw new Error(`MeshRepository: No component found for entity ${String(entId)}`)
    }

    entity.symbol = symbol
  }

  public GetSymbol(entId: EntId): symbol {
    const entity = this.components.get(entId)

    if (!entity) {
      throw new Error(`MeshRepository: No component found for entity ${String(entId)}`)
    }

    if (!entity.symbol) {
      throw new Error(`MeshRepository: No symbol set for entity ${String(entId)}`)
    }

    return entity.symbol
  }

  public *GetAllSymbols(): Generator<symbol> {
    for (const component of this.components.values()) {
      if (component.symbol) {
        yield component.symbol
      }
    }
  }

  public static Factory() {
    return new MeshRepository(MeshComponent)
  }
}
