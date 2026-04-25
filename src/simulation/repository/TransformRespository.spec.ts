import { describe, it, expect, beforeEach } from "vitest";
import { vec3, quat, mat4 } from "gl-matrix";
import { TransformRepository } from "./TransformRespository";
import { EntityRegistry } from "../EntityRegistry";

describe("TransformRepository", () => {
  let repository: TransformRepository;
  let entityRegistry: EntityRegistry;
  let entityId: ReturnType<EntityRegistry["Create"]>;

  beforeEach(() => {
    repository = TransformRepository.Factory();
    entityRegistry = new EntityRegistry();
    entityId = entityRegistry.Create();
    repository.CreateComponent(entityId);
  });

  it("sets and gets translation", () => {
    const translation = vec3.fromValues(1, 2, 3);
    repository.SetLocalTranslation(entityId, translation);
    const result = repository.GetLocalTranslation(entityId);
    expect(Array.from(result)).toEqual([1, 2, 3]);
  });

  it("updates translation", () => {
    repository.SetLocalTranslation(entityId, vec3.fromValues(1, 2, 3));
    repository.UpdateLocalTranslation(entityId, vec3.fromValues(1, 1, 1));
    const result = repository.GetLocalTranslation(entityId);
    expect(Array.from(result)).toEqual([2, 3, 4]);
  });

  it("sets and gets rotation", () => {
    const rotation = quat.fromValues(0, 0, 0, 1);
    repository.SetLocalRotation(entityId, rotation);
    const result = repository.GetLocalRotation(entityId);
    expect(Array.from(result)).toEqual(Array.from(rotation));
  });

  it("sets and gets scale", () => {
    const scale = vec3.fromValues(2, 2, 2);
    repository.SetLocalScale(entityId, scale);
    const result = repository.GetLocalScale(entityId);
    expect(Array.from(result)).toEqual([2, 2, 2]);
  });

  it("updates scale", () => {
    repository.SetLocalScale(entityId, vec3.fromValues(1, 1, 1));
    repository.UpdateLocalScale(entityId, vec3.fromValues(1, 2, 3));
    const result = repository.GetLocalScale(entityId);
    expect(Array.from(result)).toEqual([2, 3, 4]);
  });

  it("sets and gets local matrix", () => {
    const matrix = mat4.fromTranslation(mat4.create(), vec3.fromValues(5, 6, 7));
    repository.SetLocalMatrix(entityId, matrix);
    const result = repository.GetLocalMatrix(entityId);
    expect(Array.from(result)).toEqual(Array.from(matrix));
  });

  it("sets and gets world matrix", () => {
    const matrix = mat4.fromTranslation(mat4.create(), vec3.fromValues(8, 9, 10));
    repository.SetWorldMatrix(entityId, matrix);
    const result = repository.GetWorldMatrix(entityId);
    expect(Array.from(result)).toEqual(Array.from(matrix));
  });

  it("sets rotation using euler angles", () => {
    repository.SetLocalRotationEuler(entityId, Math.PI / 2, 0, 0);
    const result = repository.GetLocalRotation(entityId);
    expect(result).toBeInstanceOf(Float32Array);
  });

  it("updates rotation using euler angles", () => {
    repository.SetLocalRotationEuler(entityId, 0, 0, 0);
    repository.UpdateLocalRotationEuler(entityId, Math.PI / 2, 0, 0);
    const result = repository.GetLocalRotation(entityId);
    expect(result).toBeInstanceOf(Float32Array);
  });
});
