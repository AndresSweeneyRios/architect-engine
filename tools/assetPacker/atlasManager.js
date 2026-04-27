import { extractTexturePaths } from './gltfScanner.js'
import { createAtlas, createCombinedMRAOImage } from './atlasGenerator.js'

/**
 * @typedef {Object} AtlasManifestEntry
 * @property {string} atlasFile
 * @property {number} x
 * @property {number} y
 * @property {number} width
 * @property {number} height
 */

/**
 * @typedef {Object} GltfFileEntry
 * @property {string} gltfPath
 * @property {string} fullGltfPath
 */

/**
 * @typedef {Object} CombinedCandidate
 * @property {Record<string, string>} channelPaths
 * @property {Set<string>} originals
 * @property {string=} combinedId
 * @property {string=} combinedRelative
 */

/**
 * @param {string[]} selectedFiles
 * @param {GltfFileEntry[]} allFiles
 * @param {number} atlasSize
 * @param {number} textureResolution
 * @param {number} webpQuality
 * @param {number} webpAlphaQuality
 * @param {number} mraoWebpQuality
 * @param {number} mraoWebpAlphaQuality
 * @returns {Promise<Record<string, AtlasManifestEntry>>}
 */
export async function generateAtlases(selectedFiles, allFiles, atlasSize, textureResolution, webpQuality, webpAlphaQuality, mraoWebpQuality, mraoWebpAlphaQuality) {
  const normalizePath = (filePath) => String(filePath).replace(/\\/g, '/')
  const fileMap = new Map(allFiles.map(f => [normalizePath(f.gltfPath), f]))
  const selected = selectedFiles.map(filePath => fileMap.get(normalizePath(filePath))).filter(Boolean)

  /** @type {Record<string, Set<string | { id: string, buffer: Buffer, width: number, height: number }>>} */
  const texturesByType = {}

  /** @type {Map<string, CombinedCandidate>} */
  const combinedCandidates = new Map()

  selected.forEach(fileEntry => {
    const { materials } = extractTexturePaths(fileEntry.gltfPath, fileEntry.fullGltfPath, '')

    console.log(`Extracting from ${fileEntry.gltfPath}:`)
    console.log(`  Materials with textures:`, Object.keys(materials).length)

    Object.values(materials).forEach(material => {
      Object.entries(material).forEach(([textureType, texturePath]) => {
        if (typeof texturePath === 'string') {
          if (!texturesByType[textureType]) {
            texturesByType[textureType] = new Set()
          }

          texturesByType[textureType].add(texturePath)
        }
      })
    })

    Object.values(materials).forEach(material => {
      const channelNames = ['metallic', 'roughness', 'ao', 'occlusion', 'alpha']

      /** @type {Record<string, string>} */
      const channelPaths = {}

      let hasAny = false

      channelNames.forEach(name => {
        const textureValue = material[`${name}Texture`]
        const triplanarValue = material[`${name}TriplanarTexture`]

        if (typeof material[name] === 'string') {
          channelPaths[name] = material[name]
          hasAny = true
        } else if (typeof textureValue === 'string') {
          channelPaths[name] = textureValue
          hasAny = true
        } else if (typeof triplanarValue === 'string') {
          channelPaths[name] = triplanarValue
          hasAny = true
        }
      })

      if (!hasAny) {
        return
      }

      const key = JSON.stringify(channelPaths)

      if (!combinedCandidates.has(key)) {
        combinedCandidates.set(key, { channelPaths, originals: new Set() })
      }

      const entry = combinedCandidates.get(key)
      Object.values(channelPaths).forEach(texturePath => entry.originals.add(texturePath))
    })
  })

  console.log('\nTextures by type:')
  Object.entries(texturesByType).forEach(([type, set]) => {
    console.log(`  ${type}: ${set.size} unique textures`)
  })

  if (combinedCandidates.size > 0) {
    if (!texturesByType.mrao) {
      texturesByType.mrao = new Set()
    }

    for (const [key, { channelPaths }] of combinedCandidates.entries()) {
      try {
        const combined = await createCombinedMRAOImage(channelPaths, textureResolution, 100, 100)

        if (combined && combined.buffer) {
          const combinedEntry = {
            id: combined.id,
            buffer: combined.buffer,
            width: combined.width,
            height: combined.height
          }

          texturesByType.mrao.add(combinedEntry)
          combinedCandidates.get(key).combinedId = combined.id
        }
      } catch (err) {
        console.error('Failed to create combined MRAO image:', err.message)
      }
    }

    ['metallic', 'roughness', 'ao', 'occlusion', 'alpha'].forEach(key => {
      if (texturesByType[key]) {
        delete texturesByType[key]
      }

      const suffix = `${key}Texture`
      if (texturesByType[suffix]) {
        delete texturesByType[suffix]
      }

      const triplanarSuffix = `${key}TriplanarTexture`
      if (texturesByType[triplanarSuffix]) {
        delete texturesByType[triplanarSuffix]
      }
    })
  }

  /** @type {Record<string, AtlasManifestEntry>} */
  const atlasManifest = {}

  for (const [textureType, textureSet] of Object.entries(texturesByType)) {
    const texturePaths = Array.from(textureSet)
    const quality = textureType === 'mrao' ? mraoWebpQuality : webpQuality
    const alphaQuality = textureType === 'mrao' ? mraoWebpAlphaQuality : webpAlphaQuality

    const atlas = await createAtlas(texturePaths, atlasSize, textureType, textureResolution, quality, alphaQuality)

    if (!atlas) {
      continue
    }

    for (const [texturePath, uvData] of Object.entries(atlas.uvMapping)) {
      if (typeof texturePath === 'string' && texturePath.startsWith('./public/atlases/')) {
        continue
      }

      const atlasEntry = {
        atlasFile: atlas.fileName,
        x: uvData.x,
        y: uvData.y,
        width: uvData.width,
        height: uvData.height
      }

      atlasManifest[texturePath] = atlasEntry
      atlasManifest[`${textureType}:${texturePath}`] = atlasEntry
    }

    if (textureType !== 'mrao') {
      continue
    }

    for (const [, entry] of combinedCandidates.entries()) {
      const combinedId = entry.combinedId || entry.combinedRelative

      if (!combinedId) {
        continue
      }

      const uv = atlas.uvMapping[combinedId]

      if (!uv) {
        continue
      }

      const hasAlphaChannel = typeof entry.channelPaths.alpha === 'string'

      for (const [channelName, channelTexturePath] of Object.entries(entry.channelPaths)) {
        if (hasAlphaChannel && channelName !== 'alpha') {
          continue
        }

        const atlasEntry = {
          atlasFile: atlas.fileName,
          x: uv.x,
          y: uv.y,
          width: uv.width,
          height: uv.height
        }

        atlasManifest[`${channelName}:${channelTexturePath}`] = atlasEntry
        atlasManifest[`${channelName}Texture:${channelTexturePath}`] = atlasEntry
        atlasManifest[`${channelName}TriplanarTexture:${channelTexturePath}`] = atlasEntry
      }

      if (atlasManifest[combinedId]) {
        delete atlasManifest[combinedId]
      }
    }
  }

  return atlasManifest
}
