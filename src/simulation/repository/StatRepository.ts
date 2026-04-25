import { EntId } from "../EntityRegistry"
import {
  SimulationRepository,
  SimulationComponent,
} from "./_repository"

export enum StatType {
  SPEED = 0,
}

export enum ModifierType {
  ADD = 0,
  MULTIPLY = 1,
}

export type Modifier = Readonly<{
  type: ModifierType
  stat: StatType
  value: number
}>

class StatComponent extends SimulationComponent {
  public stats: Map<StatType, number> = new Map()
  public statModifiers: Map<symbol, Modifier> = new Map()
  public statusEffects: Map<symbol, symbol[]> = new Map()
}

export class StatRepository extends SimulationRepository<StatComponent> {
  public SetStatBaseValue(entId: EntId, type: StatType, value: number) {
    this.components.get(entId)!.stats.set(type, value)
  }

  public GetStatBaseValue(entId: EntId, type: StatType) {
    return this.components.get(entId)!.stats.get(type) || 0
  }

  public CreateStatusEffect(entId: EntId, modifiers: Modifier) {
    const id = Symbol()
    this.components.get(entId)!.statModifiers.set(id, modifiers)

    return id
  }

  public RemoveStatusEffect(entId: EntId, id: symbol) {
    this.components.get(entId)!.statModifiers.delete(id)
  }

  public GetStatComputedValue(entId: EntId, type: StatType) {
    const component = this.components.get(entId)!

    const baseValue = this.GetStatBaseValue(entId, type)

    const modifiers = component.statModifiers.values()

    let value = baseValue

    for (const modifier of modifiers) {
      if (modifier.stat !== type) {
        continue
      }

      if (modifier.type === ModifierType.ADD) {
        value += modifier.value
      } else if (modifier.type === ModifierType.MULTIPLY) {
        value *= modifier.value
      }
    }

    return value
  }

  public static Factory() {
    return new StatRepository(StatComponent)
  }
}
