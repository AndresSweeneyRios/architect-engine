const typeVersion = new Map<symbol, symbol>();
const typeEntityVersion = new Map<symbol, Map<symbol, symbol>>();

/**
 * Utility for versioning arbitrary symbols. Used for cache validation on the graphics layer.
 */
export const setTypeVersion = (type: symbol, version: symbol) => {
  typeVersion.set(type, version);
}

/**
 * Validate a symbol version.
 * 
 * @see {@link setTypeVersion}
 */
export const getIsValid = (type: symbol, entity: symbol) => {
  const oldVersion = typeEntityVersion.get(type)?.get(entity)
  const newVersion = typeVersion.get(type)

  if (!newVersion) {
    throw new Error(`Type version not set for type: ${String(type)}`)
  }

  const isValid = oldVersion === newVersion

  if (!isValid) {
    if (!typeEntityVersion.has(type)) {
      typeEntityVersion.set(type, new Map<symbol, symbol>())
    }

    typeEntityVersion.get(type)!.set(entity, newVersion)
  }

  return isValid
}

// TODO: cleanup unused symbols
