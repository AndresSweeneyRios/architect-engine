import { vec3 } from 'gl-matrix';
import * as playerInput from '../input/player';
import type { Simulation } from '../simulation';
import { View } from '../simulation/View';
import type { Camera } from '../graphics/webgpu/camera';

export interface PlayerCameraConfig {
  initialPosition?: vec3;
  initialYaw?: number;
  initialPitch?: number;
  movementSpeed?: number;
  lookSensitivity?: number;
  maxPitch?: number;
  minPitch?: number;
}

export class PlayerCameraView extends View {
  private cameraPosition: vec3;
  private pitch: number;
  private yaw: number;
  private movementSpeed: number;
  private lookSensitivity: number;
  private maxPitch: number;
  private minPitch: number;

  private readonly transformedMovement = new Float32Array(3) as vec3;
  private readonly forward = new Float32Array(3) as vec3;
  private readonly right = new Float32Array(3) as vec3;

  constructor(
    private camera: Camera,
    config: PlayerCameraConfig = {}
  ) {
    super();

    this.cameraPosition = config.initialPosition
      ? vec3.clone(config.initialPosition)
      : vec3.fromValues(-10, 1, 0);

    this.yaw = config.initialYaw ?? 0;
    this.pitch = config.initialPitch ?? 0;
    this.movementSpeed = config.movementSpeed ?? 10;
    this.lookSensitivity = config.lookSensitivity ?? 0.12;
    this.maxPitch = config.maxPitch ?? 89;
    this.minPitch = config.minPitch ?? -89;

    this.camera.lookAt(this.cameraPosition, [0, 0, 0]);
  }

  public Draw(simulation: Simulation, lerpFactor: number, delta: number): void {
    playerInput.update();

    this.yaw += playerInput.getLookX() * this.lookSensitivity;
    this.pitch -= playerInput.getLookY() * this.lookSensitivity;

    this.pitch = Math.min(Math.max(this.pitch, this.minPitch), this.maxPitch);

    const yawRadians = (this.yaw * Math.PI) / 180;

    this.forward[0] = Math.cos(yawRadians);
    this.forward[1] = 0;
    this.forward[2] = Math.sin(yawRadians);

    this.right[0] = -this.forward[2];
    this.right[1] = 0;
    this.right[2] = this.forward[0];

    vec3.set(this.transformedMovement, 0, 0, 0);

    if (playerInput.getWalkY() !== 0) {
      vec3.scaleAndAdd(
        this.transformedMovement,
        this.transformedMovement,
        this.forward,
        -playerInput.getWalkY()
      );
    }

    if (playerInput.getWalkX() !== 0) {
      vec3.scaleAndAdd(
        this.transformedMovement,
        this.transformedMovement,
        this.right,
        playerInput.getWalkX()
      );
    }

    const len = vec3.length(this.transformedMovement);

    if (len > 0) {
      vec3.scale(this.transformedMovement, this.transformedMovement, (this.movementSpeed * delta) / len);
      vec3.add(this.cameraPosition, this.cameraPosition, this.transformedMovement);
    }

    this.camera.setPosition(this.cameraPosition);
    this.camera.setRotation(this.yaw, this.pitch);
  }

  public getPosition(): Readonly<vec3> {
    return this.cameraPosition;
  }

  public setPosition(position: vec3): void {
    vec3.copy(this.cameraPosition, position);
  }

  public getYaw(): number {
    return this.yaw;
  }

  public getPitch(): number {
    return this.pitch;
  }

  public setRotation(yaw: number, pitch: number): void {
    this.yaw = yaw;
    this.pitch = Math.min(Math.max(pitch, this.minPitch), this.maxPitch);
  }

  public setMovementSpeed(speed: number): void {
    this.movementSpeed = speed;
  }

  public setLookSensitivity(sensitivity: number): void {
    this.lookSensitivity = sensitivity;
  }
}
