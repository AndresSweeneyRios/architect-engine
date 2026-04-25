export type EntId = symbol & { __entId: true }

/**
 * Utility to create and track unique entity IDs for the simulation.
 */
export class EntityRegistry {
  id = 0

  Create() {
    return Symbol(this.id++) as EntId
  }
}
