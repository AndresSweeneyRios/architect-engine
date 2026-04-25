import type { EntId } from "../EntityRegistry"
import {
  SimulationRepository,
  SimulationComponent,
} from "./_repository"

class SceneGraphComponent extends SimulationComponent {
  children: EntId[] = []
  parent: EntId | null = null
  name: string = ""
}

export class SceneGraphRepository extends SimulationRepository<SceneGraphComponent> {
  public AddChild(parentEntId: EntId, childEntId: EntId) {
    const child = this.components.get(childEntId)
    const parent = this.components.get(parentEntId)

    if (!child) {
      throw new Error("Child does not exist")
    }

    if (!parent) {
      throw new Error("Parent does not exist")
    }

    if (child.parent === parentEntId) {
      return
    }

    this.RemoveParent(childEntId)

    parent.children.push(childEntId)

    child.parent = parentEntId
  }

  public RemoveChild(parentEntId: EntId, childEntId: EntId) {
    const parent = this.components.get(parentEntId)

    if (!parent) {
      throw new Error("Parent does not exist")
    }

    const index = parent.children.indexOf(childEntId)

    if (index === -1) {
      return
    }

    parent.children.splice(index, 1)

    const child = this.components.get(childEntId)

    if (child) {
      child.parent = null
    }
  }

  public RemoveParent(childEntId: EntId) {
    const child = this.components.get(childEntId)

    if (!child) {
      throw new Error("Child does not exist")
    }

    if (!child.parent) {
      return
    }

    this.RemoveChild(child.parent, childEntId)
  }

  public GetChildren(parentEntId: EntId) {
    const parent = this.components.get(parentEntId)

    if (!parent) {
      throw new Error("Parent does not exist")
    }

    return [...parent.children]
  }

  public GetParent(childEntId: EntId) {
    const child = this.components.get(childEntId)

    if (!child) {
      throw new Error("Child does not exist")
    }

    if (!child.parent) {
      return child.parent
    }

    if (!this.components.has(child.parent)) {
      child.parent = null
    }

    return child.parent
  }

  public RemoveComponent(entId: EntId) {
    this.RemoveParent(entId)

    const children = this.GetChildren(entId)

    for (const child of children) {
      this.RemoveChild(entId, child)

      this.RemoveComponent(child)
    }

    super.RemoveComponent(entId)
  }

  public SetName(entId: EntId, name: string) {
    const entity = this.components.get(entId)

    if (!entity) {
      throw new Error(`SceneGraphRepository: No component found for entity ${String(entId)}`)
    }

    entity.name = name
  }

  public GetName(entId: EntId): string {
    const entity = this.components.get(entId)

    if (!entity) {
      throw new Error(`SceneGraphRepository: No component found for entity ${String(entId)}`)
    }

    return entity.name
  }

  public *GetAncestors(childEntId: EntId): Generator<EntId> {
    let currentEntId: EntId | null = childEntId

    while (currentEntId !== null) {
      const parent = this.GetParent(currentEntId)

      if (!parent) {
        break
      }

      yield parent

      currentEntId = parent
    }
  }

  public *GetDescendants(parentEntId: EntId): Generator<EntId> {
    const parent = this.components.get(parentEntId)

    if (!parent) {
      throw new Error("Parent does not exist")
    }

    yield* parent.children

    for (const child of parent.children) {
      yield* this.GetDescendants(child)
    }
  }

  public FindDescendantByName(parentEntId: EntId, name: string): EntId | null {
    for (const descendant of this.GetDescendants(parentEntId)) {
      if (this.GetName(descendant) === name) {
        return descendant
      }
    }

    return null
  }

  public FindEntityByName(name: string): EntId | null {
    for (const [entId, component] of this.components) {
      if (component.parent !== null) {
        continue
      }

      const foundEntId = this.FindDescendantByName(entId, name)

      if (foundEntId !== null) {
        return foundEntId
      }
    }

    return null
  }

  public static Factory() {
    return new SceneGraphRepository(SceneGraphComponent)
  }
}
