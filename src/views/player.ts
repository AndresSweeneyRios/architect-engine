import { loadAudio } from "../audio/loaders"
import { JustPressedEvent } from "../input/player"
import * as playerInput from "../input/player"
import type { Simulation } from "../simulation"
import type { EntId } from "../simulation/EntityRegistry"
import { EntityView } from "../simulation/EntityView"
import { SensorCommand } from "../simulation/repository/SensorCommandRepository"
import * as math from "../utils/math"
import { vec3 } from "gl-matrix"
import * as THREE from "three"
import { TypedEmitter } from "../utils/emitter"
import footstepsConcreteOgg from '../assets/audio/sfx/footsteps_concrete.ogg'

export let simulationPlayerViews: Record<number, PlayerView> = {}

if (!localStorage.sensitivity) {
  localStorage.sensitivity = "0.5"
}

const footstepAudio = loadAudio(footstepsConcreteOgg, {
  randomPitch: true,
  detune: -4000,
  pitchRange: 800,
})

footstepAudio.then(audio => audio.setVolume(0.25))

let footstepAudioInstance: Awaited<typeof footstepAudio> | null = null

footstepAudio.then(audio => {
  audio.setVolume(0.25)
  footstepAudioInstance = audio
})

export type InteractionsChangedPayload = {
  command: SensorCommand
  entId: EntId
  symbol: symbol
  angle: number
}[]

export class PlayerView extends EntityView {
  public canvas: HTMLCanvasElement
  private controlsEnabled = false
  protected cleanupEvents: () => void = () => { }
  protected runSpeedModifier = 2
  public runEnabled = false
  public debugElement = document.createElement("div")
  protected lastFootstepTime: number | undefined = undefined

  public interactionEmitter = new TypedEmitter<{
    interactionsChanged: (interactions: InteractionsChangedPayload) => void
  }>()

  constructor(entId: EntId, protected simulation: Simulation, initialRotation: vec3 | undefined = undefined) {
    super(entId)
    this.canvas = document.querySelector('canvas#viewport')!

    document.querySelector("#debug")?.appendChild(this.debugElement)

    simulationPlayerViews[simulation.SimulationIndex] = this
  }

  protected getAvailableInteractionsWithinAngle(maxAngle: number): { command: SensorCommand, entId: EntId, symbol: symbol, angle: number }[] {
    const commands = this.simulation.SimulationState.SensorCommandRepository.GetAvailableInteractions(this.EntId)
    const interactions = commands.map(({ command, entId, symbol }) => {
      const position = this.simulation.SimulationState.PhysicsRepository.GetPosition(entId)
      const playerPosition = this.simulation.SimulationState.PhysicsRepository.GetPosition(this.EntId)
      const angle = math.getAngleToPlayer(
        new THREE.Vector3(position[0], 0, position[2]),
        new THREE.Vector3(playerPosition[0], 0, playerPosition[2]),
        this.simulation.Camera,
      )

      return { command, entId, symbol, angle }
    }).filter(interaction => interaction.angle <= maxAngle)

    this.interactionEmitter.emit('interactionsChanged', interactions)
    return interactions
  }

  protected handleJustPressed(payload: JustPressedEvent): void {
    if (!this.controlsEnabled) return
    if (payload.action !== "interact") return

    const availableInteractions = this.getAvailableInteractionsWithinAngle(20)
    if (availableInteractions.length === 0) return

    let closestInteraction = availableInteractions.reduce((closest, interaction) => {
      return interaction.angle < closest.angle ? interaction : closest
    }, { angle: Infinity } as { command: SensorCommand, entId: EntId, symbol: symbol, angle: number })

    if (closestInteraction.angle === Infinity) return

    this.simulation.SimulationState.Commands.push(closestInteraction.command.Command)
    payload.consume()
    if (closestInteraction.command.Once) {
      this.simulation.SimulationState.SensorCommandRepository.DeleteSensorCommand(closestInteraction.entId, closestInteraction.symbol)
    }
  }

  public enableControls(): void {
    if (this.controlsEnabled) return

    this.controlsEnabled = true
    this.cleanupEvents()
    this.cleanupEvents = () => playerInput.emitter.off("justpressed", justPressedHandler)
    const justPressedHandler = this.handleJustPressed.bind(this)
    playerInput.emitter.on("justpressed", justPressedHandler)
  }

  public disableControls(): void {
    if (!this.controlsEnabled) return
    this.cleanupEvents()
    this.cleanupEvents = () => { }
    this.simulation.SimulationState.MovementRepository.SetDirection(this.EntId, [0, 0, 0])
    this.controlsEnabled = false
  }

  public getControlsEnabled(): boolean {
    return this.controlsEnabled
  }

  public Update(simulation: Simulation): void {
    const state = simulation.SimulationState

    if (!this.controlsEnabled) return
    const localDirection = new THREE.Vector3(playerInput.getWalkX(), 0, playerInput.getWalkY())

    const now = Date.now()
    const footstepInterval = 600

    if (localDirection.length() > 0) {
      if (!this.lastFootstepTime || now - this.lastFootstepTime >= footstepInterval) {
        footstepAudioInstance?.play()
        this.lastFootstepTime = now
      }
    } else {
      this.lastFootstepTime = undefined
    }

    state.MovementRepository.SetDirection(this.EntId, [localDirection.x, localDirection.y, localDirection.z])

    const isInteractable = this.getAvailableInteractionsWithinAngle(20).length > 0
    // TODO: Interactable UI system
  }

  public Cleanup(): void {
    this.cleanupEvents()

    this.debugElement.remove()

    this.disableControls()

    delete simulationPlayerViews[this.simulation.SimulationIndex]
  }
}
