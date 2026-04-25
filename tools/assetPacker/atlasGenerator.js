import fs from 'fs'
import path from 'path'
import sharp from 'sharp'
import crypto from 'crypto'
import potpack from 'potpack'
import { PROJECT_ROOT, ATLASES_DIR } from './constants.js'

/**
 * @typedef {Object} InMemoryTextureEntry
 * @property {string} id
 * @property {Buffer} buffer
 * @property {number} width
 * @property {number} height
 */

/**
 * @typedef {string | InMemoryTextureEntry} TextureEntry
 */

/**
 * @typedef {Object} AtlasUv
 * @property {number} x
 * @property {number} y
 * @property {number} width
 * @property {number} height
 */

/**
 * @typedef {Object} AtlasResult
 * @property {string} fileName
 * @property {Record<string, AtlasUv>} uvMapping
 */

/**
 * @typedef {Object} ChannelPaths
 * @property {string=} metallic
 * @property {string=} roughness
 * @property {string=} ao
 * @property {string=} alpha
 */

/**
 * @param {TextureEntry[]} texturePaths
 * @param {number} atlasSize
 * @param {string} textureType
 * @param {number} textureResolution
 * @param {number} webpQuality
 * @param {number} webpAlphaQuality
 * @returns {Promise<AtlasResult | null>}
 */
export async function createAtlas(texturePaths, atlasSize, textureType, textureResolution, webpQuality = 90, webpAlphaQuality = 100) {
  if (texturePaths.length === 0) {
    return null
  }

  console.log(`Creating ${textureType} atlas with ${texturePaths.length} textures at ${atlasSize}x${atlasSize}...`)

  const textureInfos = []

  for (const entry of texturePaths) {
    if (typeof entry === 'string') {
      const absolutePath = path.join(PROJECT_ROOT, entry.replace('./', ''))

      if (!fs.existsSync(absolutePath)) {
        console.warn(`Texture not found: ${absolutePath}`)
        continue
      }

      try {
        const metadata = await sharp(absolutePath).metadata()

        if (!metadata.width || !metadata.height) {
          console.warn(`Invalid texture metadata for ${entry}`)
          continue
        }

        let targetWidth
        let targetHeight

        const maxDim = Math.max(metadata.width, metadata.height)
        const targetDim = Math.min(maxDim, textureResolution)
        const aspectRatio = metadata.width / metadata.height

        if (aspectRatio >= 1) {
          targetWidth = targetDim
          targetHeight = Math.round(targetDim / aspectRatio)
        } else {
          targetHeight = targetDim
          targetWidth = Math.round(targetDim * aspectRatio)
        }

        textureInfos.push({
          id: entry,
          path: entry,
          absolutePath,
          width: metadata.width,
          height: metadata.height,
          targetWidth,
          targetHeight,
          inMemory: false
        })
      } catch (error) {
        console.error(`Error reading texture ${entry}:`, error.message)
      }
    } else if (entry && entry.buffer && entry.id) {
      const metadataWidth = entry.width || textureResolution
      const metadataHeight = entry.height || textureResolution
      const targetWidth = Math.min(Math.max(metadataWidth, metadataHeight), textureResolution)
      const targetHeight = targetWidth

      textureInfos.push({
        id: entry.id,
        path: entry.id,
        buffer: entry.buffer,
        width: metadataWidth,
        height: metadataHeight,
        targetWidth,
        targetHeight,
        inMemory: true
      })
    } else {
      console.warn('Unsupported texture entry for atlas:', entry)
    }
  }

  if (textureInfos.length === 0) {
    console.warn(`No valid textures for ${textureType} atlas`)
    return null
  }

  const boxes = textureInfos.map(info => ({
    w: info.targetWidth,
    h: info.targetHeight,
    x: 0,
    y: 0,
    info
  }))

  const { w: packedWidth, h: packedHeight, fill } = potpack(boxes)

  console.log(`  Packing efficiency: ${(fill * 100).toFixed(1)}% (${packedWidth}x${packedHeight})`)

  const actualAtlasWidth = Math.min(packedWidth, atlasSize)
  const actualAtlasHeight = Math.min(packedHeight, atlasSize)

  console.log(`  Final atlas size: ${actualAtlasWidth}x${actualAtlasHeight}`)

  const compositeOps = []

  /** @type {Record<string, AtlasUv>} */
  const uvMapping = {}

  for (const box of boxes) {
    const packedBox = box

    if (packedBox.x === undefined) {
      console.warn(`Texture ${packedBox.info.path} couldn't be packed, skipping`)
      continue
    }

    try {
      let inputBuffer

      if (packedBox.info.inMemory && packedBox.info.buffer) {
        inputBuffer = await sharp(packedBox.info.buffer)
          .resize(packedBox.info.targetWidth, packedBox.info.targetHeight, { fit: 'inside' })
          .toBuffer()
      } else {
        inputBuffer = await sharp(packedBox.info.absolutePath)
          .resize(packedBox.info.targetWidth, packedBox.info.targetHeight, {
            fit: 'inside',
            withoutEnlargement: true
          })
          .toBuffer()
      }

      compositeOps.push({
        input: inputBuffer,
        top: packedBox.y,
        left: packedBox.x
      })

      uvMapping[packedBox.info.path] = {
        x: packedBox.x / actualAtlasWidth,
        y: packedBox.y / actualAtlasHeight,
        width: packedBox.info.targetWidth / actualAtlasWidth,
        height: packedBox.info.targetHeight / actualAtlasHeight
      }
    } catch (error) {
      console.error(`Error processing texture ${packedBox.info.path}:`, error.message)
    }
  }

  if (compositeOps.length === 0) {
    console.warn(`No valid textures for ${textureType} atlas`)
    return null
  }

  const atlasBuffer = await sharp({
    create: {
      width: actualAtlasWidth,
      height: actualAtlasHeight,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    }
  })
    .composite(compositeOps)
    .webp({ quality: webpQuality, alphaQuality: webpAlphaQuality })
    .toBuffer()

  const hash = crypto
    .createHash('md5')
    .update(texturePaths.sort().join('|'))
    .digest('hex')

  const atlasFileName = `${hash}.webp`
  const atlasPath = path.join(ATLASES_DIR, atlasFileName)

  if (!fs.existsSync(ATLASES_DIR)) {
    fs.mkdirSync(ATLASES_DIR, { recursive: true })
  }

  fs.writeFileSync(atlasPath, atlasBuffer)

  console.log(`  ✓ Atlas saved: ${atlasFileName} (${(atlasBuffer.length / 1024 / 1024).toFixed(2)} MB)`)

  return {
    fileName: atlasFileName,
    uvMapping
  }
}

/**
 * @param {ChannelPaths} channelPaths
 * @param {number} textureResolution
 * @param {number} webpQuality
 * @param {number} webpAlphaQuality
 * @returns {Promise<InMemoryTextureEntry>}
 */
export async function createCombinedMRAOImage(channelPaths, textureResolution, webpQuality = 90, webpAlphaQuality = 100) {
  const defaults = { metallic: 0, roughness: 255, ao: 255, alpha: 255 }
  const width = textureResolution
  const height = textureResolution
  const pixelCount = width * height

  /**
   * @param {string | undefined} pathOrUndefined
   * @param {number} defaultVal
   * @returns {Promise<Buffer>}
   */
  async function loadChannel(pathOrUndefined, defaultVal) {
    if (!pathOrUndefined) {
      return Buffer.alloc(pixelCount, defaultVal)
    }

    const abs = path.join(PROJECT_ROOT, pathOrUndefined.replace(/^\.\//, ''))

    if (!fs.existsSync(abs)) {
      console.warn(`Channel texture not found, using default: ${abs}`)
      return Buffer.alloc(pixelCount, defaultVal)
    }

    try {
      const { data, info } = await sharp(abs)
        .resize(width, height, { fit: 'fill' })
        .greyscale()
        .raw()
        .toBuffer({ resolveWithObject: true })

      if (info.channels === 1) {
        return data
      }

      const out = Buffer.alloc(pixelCount)

      for (let i = 0, j = 0; i < data.length && j < pixelCount; i += info.channels, ++j) {
        out[j] = data[i]
      }

      return out
    } catch (err) {
      console.warn(`Failed to load channel ${abs}, using default. (${err.message})`)
      return Buffer.alloc(pixelCount, defaultVal)
    }
  }

  const [metallicBuf, roughnessBuf, aoBuf, alphaBuf] = await Promise.all([
    loadChannel(channelPaths.metallic, defaults.metallic),
    loadChannel(channelPaths.roughness, defaults.roughness),
    loadChannel(channelPaths.ao, defaults.ao),
    loadChannel(channelPaths.alpha, defaults.alpha)
  ])

  const out = Buffer.alloc(pixelCount * 4)

  for (let i = 0; i < pixelCount; ++i) {
    out[i * 4 + 0] = metallicBuf[i]
    out[i * 4 + 1] = roughnessBuf[i]
    out[i * 4 + 2] = aoBuf[i]
    out[i * 4 + 3] = alphaBuf[i]
  }

  const imageBuf = await sharp(out, { raw: { width, height, channels: 4 } })
    .webp({ quality: webpQuality, alphaQuality: webpAlphaQuality })
    .toBuffer()

  const hash = crypto.createHash('md5')
    .update([channelPaths.metallic || '', channelPaths.roughness || '', channelPaths.ao || '', channelPaths.alpha || '', textureResolution].join('|'))
    .digest('hex')

  const id = `${hash}_mrao`

  return { id, buffer: imageBuf, width, height }
}
