import fs from 'fs'
import path from 'path'
import { ASSETS_DIR, PROJECT_ROOT } from './constants.js'

/**
 * @typedef {Object} GltfFileEntry
 * @property {string} name
 * @property {string} gltfPath
 * @property {string | null} binPath
 * @property {string} fullGltfPath
 * @property {string | null} fullBinPath
 */

/**
 * @typedef {Record<string, Record<string, unknown>>} TextureBucket
 */

/**
 * @typedef {Object} ExtractTexturePathsResult
 * @property {TextureBucket} meshes
 * @property {TextureBucket} materials
 */

/**
 * @returns {GltfFileEntry[]}
 */
export function scanGltfFiles() {
  /** @type {GltfFileEntry[]} */
  const files = []

  /**
   * @param {string} dir
   * @returns {void}
   */
  function scan(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true })

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)

      if (entry.isDirectory()) {
        scan(fullPath)
      } else if (entry.name.endsWith('.gltf')) {
        const relativePath = path.relative(ASSETS_DIR, fullPath)
        const binPath = fullPath.replace('.gltf', '.bin')
        const hasBin = fs.existsSync(binPath)

        files.push({
          name: entry.name,
          gltfPath: relativePath,
          binPath: hasBin ? relativePath.replace('.gltf', '.bin') : null,
          fullGltfPath: fullPath,
          fullBinPath: hasBin ? binPath : null
        })
      }
    }
  }

  scan(ASSETS_DIR)

  return files
}

/**
 * @param {string} gltfPath
 * @param {string} gltfFullPath
 * @param {string} safeName
 * @returns {ExtractTexturePathsResult}
 */
export function extractTexturePaths(gltfPath, gltfFullPath, safeName) {
  void safeName

  /** @type {TextureBucket} */
  const meshes = {}

  /** @type {TextureBucket} */
  const materials = {}

  try {
    const gltfContent = fs.readFileSync(gltfFullPath, 'utf8')
    const gltfJson = JSON.parse(gltfContent)
    const gltfDir = path.dirname(gltfFullPath)

    if (gltfJson.materials) {
      for (const material of gltfJson.materials) {
        if (material.extensions && material.extensions.PROJECT_ARCHITECT) {
          const paExt = material.extensions.PROJECT_ARCHITECT
          const materialName = material.name || 'unknown_material'

          if (!materials[materialName]) {
            materials[materialName] = {}
          }

          for (const [key, value] of Object.entries(paExt)) {
            if (key !== 'textures') {
              materials[materialName][key] = value
            }
          }

          if (paExt.textures) {
            for (const [textureType, textureData] of Object.entries(paExt.textures)) {
              if (typeof textureData === 'object' && textureData && 'uri' in textureData && textureData.uri) {
                let uri = textureData.uri.replace(/^\/\//, '')
                const texturePath = path.resolve(gltfDir, uri)
                const relativePath = './' + path.relative(PROJECT_ROOT, texturePath).replace(/\\/g, '/')

                materials[materialName][textureType] = relativePath
              }
            }
          }
        }
      }
    }
  } catch (error) {
    console.error(`Error extracting textures from ${gltfPath}:`, error.message)
  }

  return { meshes, materials }
}
