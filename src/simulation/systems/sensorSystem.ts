import { EntId } from "../EntityRegistry"
import { SimulationState } from "../SimulationState"
import { SimulationCommandWithTarget } from "../commands/_command"
import { ExecutionMode, SensorCommand } from "../repository/SensorCommandRepository"

/**
 * Invokes commands based on interactions between entities.
 * 
 * @see {@link SensorCommand} for more details on how commands are defined and executed.
 * @see {@link ExecutionMode} for understanding the different execution modes of sensor commands.
 */
export const sensorSystem = (state: SimulationState) => {
  for (const entId of state.SensorCommandRepository.Components) {
    state.SensorCommandRepository.ClearAvailableInteractions(entId)
  }

  for (const entId of state.SensorCommandRepository.Components) {
    const sensors = state.PhysicsRepository.GetSensors(entId)

    const immediateCommandMap = new Map<symbol, Readonly<[symbol, SensorCommand]>[]>()
    const interactionCommandMap = new Map<symbol, Readonly<[symbol, SensorCommand]>[]>()

    for (const sensor of sensors) {
      for (const { symbol, command } of state.SensorCommandRepository.GetCommandsForSensor(entId, sensor)) {
        if (command.ExecutionMode === ExecutionMode.Immediate) {
          if (!immediateCommandMap.has(sensor)) {
            immediateCommandMap.set(sensor, [])
          }

          immediateCommandMap.get(sensor)!.push([symbol, command])
        } else if (command.ExecutionMode === ExecutionMode.Interaction) {
          if (!interactionCommandMap.has(sensor)) {
            interactionCommandMap.set(sensor, [])
          }

          interactionCommandMap.get(sensor)!.push([symbol, command])
        }
      }
    }

    for (const sensor of sensors) {
      if (!immediateCommandMap.has(sensor) && !interactionCommandMap.has(sensor)) {
        continue
      }

      let touchingTarget = false
      let targetEntId: EntId | null = null

      for (const target of state.SensorTargetRepository.Components) {
        if (state.PhysicsRepository.GetIsSensorCollidingWithTarget(entId, sensor, target)) {
          touchingTarget = true
          targetEntId = target
        }
      }

      if (!touchingTarget || !targetEntId) {
        continue
      }

      if (immediateCommandMap.has(sensor)) {
        for (const [commandSymbol, { Command, Once }] of immediateCommandMap.get(sensor)!) {
          if (Command instanceof SimulationCommandWithTarget) {
            Command.TargetEntId = targetEntId
          }

          state.Commands.push(Command)

          if (Once) {
            state.SensorCommandRepository.DeleteSensorCommand(entId, commandSymbol)
          }
        }
      }

      if (interactionCommandMap.has(sensor)) {
        for (const [commandSymbol, { Command, Once }] of interactionCommandMap.get(sensor)!) {
          if (Command instanceof SimulationCommandWithTarget) {
            Command.TargetEntId = targetEntId
          }

          state.SensorCommandRepository.PushAvailableInteractions(targetEntId, [commandSymbol])
        }
      }
    }
  }
}
