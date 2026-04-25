import { vec3, quat, mat4 } from "gl-matrix";
import { EntId } from "../EntityRegistry";
import { SimulationComponent, SimulationRepository } from "./_repository";

export class TransformComponent extends SimulationComponent {
  public localMatrix: mat4 = mat4.create();
  public worldMatrix: mat4 = mat4.create();
}

export class TransformRepository extends SimulationRepository<TransformComponent> {
  private needsUpdate: Set<EntId> = new Set();

  public GetNeedsUpdate(): EntId[] {
    return Array.from(this.needsUpdate);
  }

  public ClearNeedsUpdate() {
    this.needsUpdate.clear();
  }

  public SetLocalTranslation(entId: EntId, t: vec3) {
    const component = this.components.get(entId)!;
    mat4.copy(component.localMatrix, component.localMatrix);
    component.localMatrix[12] = t[0];
    component.localMatrix[13] = t[1];
    component.localMatrix[14] = t[2];

    this.needsUpdate.add(entId);
  }

  public UpdateLocalTranslation(entId: EntId, delta: vec3) {
    const component = this.components.get(entId)!;
    component.localMatrix[12] += delta[0];
    component.localMatrix[13] += delta[1];
    component.localMatrix[14] += delta[2];

    this.needsUpdate.add(entId);
  }

  public GetLocalTranslation(entId: EntId): vec3 {
    const translation = vec3.create();
    mat4.getTranslation(translation, this.components.get(entId)!.localMatrix);
    return translation;
  }

  public SetLocalRotation(entId: EntId, q: quat) {
    const component = this.components.get(entId)!;
    const scale = vec3.create();
    mat4.getScaling(scale, component.localMatrix);

    const translation = vec3.create();
    mat4.getTranslation(translation, component.localMatrix);

    mat4.fromRotationTranslationScale(component.localMatrix, q, translation, scale);

    this.needsUpdate.add(entId);
  }

  public SetLocalRotationEuler(entId: EntId, x: number, y: number, z: number) {
    const quaternion = quat.create();
    quat.fromEuler(quaternion, (x * 180) / Math.PI, (y * 180) / Math.PI, (z * 180) / Math.PI);
    this.SetLocalRotation(entId, quaternion);

    this.needsUpdate.add(entId);
  }

  public UpdateLocalRotationEuler(entId: EntId, x: number, y: number, z: number) {
    const component = this.components.get(entId)!;
    const quaternion = quat.create();
    mat4.getRotation(quaternion, component.localMatrix);
    const deltaQuaternion = quat.create();
    quat.fromEuler(deltaQuaternion, (x * 180) / Math.PI, (y * 180) / Math.PI, (z * 180) / Math.PI);
    quat.multiply(quaternion, quaternion, deltaQuaternion);
    this.SetLocalRotation(entId, quaternion);

    this.needsUpdate.add(entId);
  }

  public GetLocalRotation(entId: EntId): quat {
    const quaternion = quat.create();
    mat4.getRotation(quaternion, this.components.get(entId)!.localMatrix);
    return quaternion;
  }

  public SetLocalScale(entId: EntId, scale: vec3) {
    const component = this.components.get(entId)!;
    const quaternion = quat.create();
    const translation = vec3.create();
    mat4.getRotation(quaternion, component.localMatrix);
    mat4.getTranslation(translation, component.localMatrix);
    mat4.fromRotationTranslationScale(component.localMatrix, quaternion, translation, scale);

    this.needsUpdate.add(entId);
  }

  public GetLocalScale(entId: EntId): vec3 {
    const scale = vec3.create();
    mat4.getScaling(scale, this.components.get(entId)!.localMatrix);
    return scale;
  }

  public UpdateLocalScale(entId: EntId, delta: vec3) {
    const scale = this.GetLocalScale(entId);
    vec3.add(scale, scale, delta);
    this.SetLocalScale(entId, scale);

    this.needsUpdate.add(entId);
  }

  public GetWorldTranslation(entId: EntId): vec3 {
    const translation = vec3.create();
    mat4.getTranslation(translation, this.components.get(entId)!.worldMatrix);
    return translation;
  }

  public GetLocalMatrix(entId: EntId): mat4 {
    return mat4.clone(this.components.get(entId)!.localMatrix);
  }

  public SetLocalMatrix(entId: EntId, m: mat4) {
    mat4.copy(this.components.get(entId)!.localMatrix, m);

    this.needsUpdate.add(entId);
  }

  public GetWorldMatrix(entId: EntId): mat4 {
    return mat4.clone(this.components.get(entId)!.worldMatrix);
  }

  public SetWorldMatrix(entId: EntId, m: mat4) {
    mat4.copy(this.components.get(entId)!.worldMatrix, m);
  }

  public static Factory() {
    return new TransformRepository(TransformComponent);
  }
}
