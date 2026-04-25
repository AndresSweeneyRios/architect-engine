import { EntId } from "../EntityRegistry"
import { SimulationCommand } from "../commands/_command"
import {
  SimulationRepository,
  SimulationComponent,
} from "./_repository"
import * as THREE from "three"

export enum ExecutionMode {
  Immediate = 0,
  Interaction = 1,
}

export interface SensorCommand {
  Command: SimulationCommand
  ExecutionMode: ExecutionMode
  Sensors: symbol[] | undefined
  Once: boolean
  Enabled: boolean
  Owner?: THREE.Object3D
}

class SensorCommandComponent extends SimulationComponent {
  public Commands: symbol[] = []
  public AvailableInteractions: symbol[] = []
}

export class SensorCommandRepository extends SimulationRepository<SensorCommandComponent> {
  public SensorCommandMap = new Map<symbol, SensorCommand>()
  public SymbolEntIdMap = new Map<symbol, EntId>()

  public AddSensorCommand({
    entId,
    command,
    executionMode,
    sensors = undefined,
    once = false,
    owner = undefined,
  }: {
    entId: EntId
    command: SimulationCommand
    executionMode: ExecutionMode
    sensors?: symbol[]
    once?: boolean
    owner?: THREE.Object3D
  }) {
    const component = this.components.get(entId)!

    const symbol = Symbol()

    this.SensorCommandMap.set(symbol, {
      Command: command,
      ExecutionMode: executionMode,
      Sensors: sensors,
      Once: once,
      Enabled: true,
      Owner: owner,
    })

    this.SymbolEntIdMap.set(symbol, entId)

    component.Commands.push(symbol)

    return symbol
  }

  public SetCommandEnabled(symbol: symbol, enabled: boolean) {
    const command = this.SensorCommandMap.get(symbol)

    if (command === undefined) {
      return
    }

    command.Enabled = enabled
  }


  public DeleteSensorCommand(entId: EntId, symbol: symbol) {
    const component = this.components.get(entId)!

    this.SensorCommandMap.delete(symbol)

    component.Commands = component.Commands.filter((s) => s !== symbol)
  }

  public GetCommandsForSensor(entId: EntId, sensor: symbol): { symbol: symbol, command: Readonly<SensorCommand> }[] {
    const component = this.components.get(entId)!
    const result: { symbol: symbol, command: Readonly<SensorCommand> }[] = []

    for (const symbol of component.Commands) {
      const command = this.SensorCommandMap.get(symbol)!

      if (command.Sensors === undefined || command.Sensors.includes(sensor)) {
        result.push({
          symbol,
          command,
        })
      }
    }

    return result
  }

  public GetAvailableInteractions(entId: EntId) {
    const component = this.components.get(entId)!

    return component.AvailableInteractions
      .map((symbol) => {
        const command = this.SensorCommandMap.get(symbol)!

        if (!command.Enabled) {
          return undefined
        }

        const entId = this.SymbolEntIdMap.get(symbol)!

        return {
          command,
          entId,
          symbol,
        }
      })
      .filter((item) => item !== undefined)
  }

  public PushAvailableInteractions(entId: EntId, commands: symbol[]) {
    const component = this.components.get(entId)!

    component.AvailableInteractions.push(...commands)
  }

  public ClearAvailableInteractions(entId: EntId) {
    const component = this.components.get(entId)!

    component.AvailableInteractions = []
  }

  public static Factory() {
    return new SensorCommandRepository(SensorCommandComponent)
  }
}
