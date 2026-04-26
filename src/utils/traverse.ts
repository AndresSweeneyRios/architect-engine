import type * as THREE from "three"
import type { EntId } from "../simulation/EntityRegistry"

interface TraverseOptions {
  yieldFirst: boolean
  parent: EntId | null
}

const DEFAULT_OPTIONS: TraverseOptions = {
  yieldFirst: true,
  parent: null
}

/**
 * Depth-first search generator for THREE.Object3D hierarchies.
 * 
 * Yields each object along with a unique symbol and its parent's symbol (if any).
 */
export function* traverseThreeDFS(
  object: THREE.Object3D,
  options?: Partial<TraverseOptions>,
): Generator<{
  object: THREE.Object3D
  symbol: EntId
  parent: EntId | null
  skip: () => void
}> {
  let skipped = false

  const skip = () => {
    skipped = true
  }

  const {
    yieldFirst,
    parent,
  } = { ...DEFAULT_OPTIONS, ...options }

  const symbol = Symbol(object.name) as EntId

  if (yieldFirst) {
    yield {
      object,
      symbol,
      parent: parent,
      skip,
    }
  }

  if (skipped) return

  for (const child of object.children) {
    yield* traverseThreeDFS(child, { yieldFirst: true, parent: symbol })
  }
}
