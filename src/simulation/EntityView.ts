import type { EntId } from "./EntityRegistry"
import { View } from "./View"

/**
 * Entity Views are tied to a specific entity in the simulation, receive events from the simulation, and are automatically cleaned up when their associated entity is removed.
 * 
 * @see {@link View}
 */
export abstract class EntityView extends View {
  public EntId: EntId

  constructor(entId: EntId) {
    super()

    this.EntId = entId
  }
}
