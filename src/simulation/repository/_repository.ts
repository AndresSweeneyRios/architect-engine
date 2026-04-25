import { EntId } from "../EntityRegistry"

export class SimulationComponent {
}

export abstract class SimulationRepository<TComponent extends SimulationComponent> {
  private __componentConstructor: (new () => TComponent)

  protected components = new Map<EntId, TComponent>()

  public get Components() {
    return this.components.keys()
  }

  public CreateComponent(entId: EntId) {
    this.components.set(entId, new this.__componentConstructor())
  }

  public RemoveComponent(entId: EntId) {
    this.components.delete(entId)
  }

  public HasComponent(entId: EntId): boolean {
    return this.components.has(entId)
  }

  constructor(component: new () => TComponent) {
    this.__componentConstructor = component
  }
}
