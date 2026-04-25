import { describe, test, expect, beforeEach } from "vitest";
import { SceneGraphRepository } from "./SceneGraphRepository";
import { EntityRegistry, EntId } from "../EntityRegistry";

describe("SceneGraphRepository", () => {
  let registry: EntityRegistry;
  let repo: SceneGraphRepository;
  let parent: EntId;
  let child: EntId;
  let grandchild: EntId;

  beforeEach(() => {
    registry = new EntityRegistry();
    repo = SceneGraphRepository.Factory();
    parent = registry.Create();
    child = registry.Create();
    grandchild = registry.Create();
    repo.CreateComponent(parent);
    repo.CreateComponent(child);
    repo.CreateComponent(grandchild);
  });

  test("AddChild and GetChildren", () => {
    repo.AddChild(parent, child);
    expect(repo.GetChildren(parent)).toContain(child);
    expect(repo.GetParent(child)).toBe(parent);
  });

  test("RemoveChild", () => {
    repo.AddChild(parent, child);
    repo.RemoveChild(parent, child);
    expect(repo.GetChildren(parent)).not.toContain(child);
    expect(repo.GetParent(child)).toBeNull();
  });

  test("RemoveParent", () => {
    repo.AddChild(parent, child);
    repo.RemoveParent(child);
    expect(repo.GetParent(child)).toBeNull();
    expect(repo.GetChildren(parent)).not.toContain(child);
  });

  test("GetAncestors", () => {
    repo.AddChild(parent, child);
    repo.AddChild(child, grandchild);
    const ancestors = Array.from(repo.GetAncestors(grandchild));
    expect(ancestors).toEqual([child, parent]);
  });

  test("GetDescendants", () => {
    repo.AddChild(parent, child);
    repo.AddChild(child, grandchild);
    const descendants = Array.from(repo.GetDescendants(parent));
    expect(descendants).toContain(child);
    expect(descendants).toContain(grandchild);
  });

  test("RemoveComponent cascades", () => {
    repo.AddChild(parent, child);
    repo.AddChild(child, grandchild);
    repo.RemoveComponent(child);
    expect(repo.HasComponent(child)).toBeFalsy();
    expect(repo.HasComponent(grandchild)).toBeFalsy();
    expect(repo.GetChildren(parent)).not.toContain(child);
  });

  test("AddChild throws if child/parent missing", () => {
    const missing = registry.Create();
    expect(() => repo.AddChild(missing, child)).toThrow();
    expect(() => repo.AddChild(parent, missing)).toThrow();
  });

  test("RemoveChild throws if parent missing", () => {
    const missing = registry.Create();
    expect(() => repo.RemoveChild(missing, child)).toThrow();
  });

  test("RemoveParent throws if child missing", () => {
    const missing = registry.Create();
    expect(() => repo.RemoveParent(missing)).toThrow();
  });

  test("GetChildren throws if parent missing", () => {
    const missing = registry.Create();
    expect(() => repo.GetChildren(missing)).toThrow();
  });

  test("GetParent throws if child missing", () => {
    const missing = registry.Create();
    expect(() => repo.GetParent(missing)).toThrow();
  });
});
