import fs from 'fs'
import path from 'path'
import { MANIFEST_FILE, PACKED_GLB_NAME, ATLASES_DIR_NAME } from './constants.js'
import { extractTexturePaths } from './gltfScanner.js'

/**
 * @typedef {Object} GltfFileEntry
 * @property {string} gltfPath
 * @property {string} fullGltfPath
 */

/**
 * @typedef {Object} AtlasManifestEntry
 * @property {string} atlasFile
 * @property {number} x
 * @property {number} y
 * @property {number} width
 * @property {number} height
 */

/**
 * @param {string[]} selectedFiles
 * @param {GltfFileEntry[]} allFiles
 * @param {Record<string, AtlasManifestEntry>} [atlasManifest={}]
 * @returns {Promise<void>}
 */
export async function generateManifest(selectedFiles, allFiles, atlasManifest = {}) {
  const normalizePath = (filePath) => String(filePath).replace(/\\/g, '/')
  const fileMap = new Map(allFiles.map(f => [normalizePath(f.gltfPath), f]))
  const selected = selectedFiles.map(filePath => fileMap.get(normalizePath(filePath))).filter(Boolean)
  const manifestObj = {}

  selected.forEach(f => {
    const safeName = f.gltfPath.replace(/\\/g, '_').replace(/\//g, '_').replace(/\./g, '_')
    const { meshes, materials } = extractTexturePaths(f.gltfPath, f.fullGltfPath, safeName)

    manifestObj[safeName] = {
      meshes,
      materials
    }
  })

  Object.values(manifestObj).forEach(scene => {
    Object.values(scene.meshes).forEach(mesh => {
      if (mesh && mesh.lightmap) {
        delete mesh.lightmap
      }
    })

    Object.values(scene.materials).forEach(material => {
      Object.keys(material).forEach(key => {
        if (typeof material[key] === 'string') {
          const texturePath = material[key]
          const channelKey = `${key}:${texturePath}`
          const atlasEntry = atlasManifest[channelKey] || atlasManifest[texturePath]

          if (atlasEntry) {
            material[key] = atlasEntry
          }
        }
      })

      const mraoChannels = ['metallic', 'roughness', 'ao', 'occlusion', 'alpha']
      const nonTriplanarMraoKeys = []
      const triplanarMraoKeys = []

      mraoChannels.forEach(channel => {
        const nonTriplanarVariants = [channel, `${channel}Texture`]
        const triplanarVariant = `${channel}TriplanarTexture`

        nonTriplanarVariants.forEach(variant => {
          if (typeof material[variant] === 'object' && material[variant].atlasFile) {
            nonTriplanarMraoKeys.push(variant)
          }
        })

        if (typeof material[triplanarVariant] === 'object' && material[triplanarVariant].atlasFile) {
          triplanarMraoKeys.push(triplanarVariant)
        }
      })

      if (nonTriplanarMraoKeys.length > 0) {
        const preferredNonTriplanarMraoKey = nonTriplanarMraoKeys.find(
          key => key === 'alphaTexture' || key === 'alpha'
        ) ?? nonTriplanarMraoKeys[0]

        material.metallicRoughnessAOAlphaTexture = material[preferredNonTriplanarMraoKey]
      }

      if (triplanarMraoKeys.length > 0) {
        const preferredTriplanarMraoKey = triplanarMraoKeys.find(
          key => key === 'alphaTriplanarTexture'
        ) ?? triplanarMraoKeys[0]

        material.metallicRoughnessAOAlphaTriplanarTexture = material[preferredTriplanarMraoKey]
      }

      ;[...nonTriplanarMraoKeys, ...triplanarMraoKeys].forEach(key => delete material[key])
    })
  })

  const packedGlbRelative = '/' + PACKED_GLB_NAME
  const atlasesDirRelative = '/' + ATLASES_DIR_NAME

  const manifestContent = `export const ASSET_MANIFEST = ${JSON.stringify(manifestObj, null, 2)} as const

export const PACKED_GLB_PATH = '${packedGlbRelative}' as const
export const ATLASES_DIR_PATH = '${atlasesDirRelative}' as const

export type AssetManifestEntry = typeof ASSET_MANIFEST[keyof typeof ASSET_MANIFEST]
`

  fs.writeFileSync(MANIFEST_FILE, manifestContent)
}
