import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS, KHRDracoMeshCompression } from '@gltf-transform/extensions'
import draco3d from 'draco3dgltf'
import sharp from 'sharp'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

/**
 * @param {string} inputPath
 * @param {string} outputPath
 * @param {number} quality
 * @returns {Promise<void>}
 */
async function optimizeGLB(inputPath, outputPath, quality = 75) {
  const inputBuffer = fs.readFileSync(inputPath)

  const io = new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({
      'draco3d.decoder': await draco3d.createDecoderModule(),
      'draco3d.encoder': await draco3d.createEncoderModule(),
    })

  const doc = await io.readBinary(new Uint8Array(inputBuffer))

  const materials = doc.getRoot().listMaterials()

  console.log(`Processing ${materials.length} materials to remove metalness and specular properties...`)

  for (const material of materials) {
    const materialName = material.getName() || 'unnamed'

    console.log(`Processing material: ${materialName}`)

    material.setMetallicFactor(0)

    const metallicRoughnessTexture = material.getMetallicRoughnessTexture()

    if (metallicRoughnessTexture) {
      console.log(`- Removing metallic-roughness texture from ${materialName}`)
      material.setMetallicRoughnessTexture(null)
    }

    console.log(`Removed metalness and specular from material: ${materialName}`)
  }

  doc.createExtension(KHRDracoMeshCompression)
    .setRequired(true)
    .setEncoderOptions({
      method: KHRDracoMeshCompression.EncoderMethod.EDGEBREAKER,
      encodeSpeed: 5,
      decodeSpeed: 5,
    })

  const textures = doc.getRoot().listTextures()

  for (const texture of textures) {
    const image = texture.getImage()

    if (!image) {
      continue
    }

    let inputImage

    if (Buffer.isBuffer(image)) {
      inputImage = image
    } else if (image instanceof Uint8Array) {
      inputImage = Buffer.from(image)
    } else {
      console.warn('Texture image not in a convertible format, skipping texture conversion.')
      continue
    }

    try {
      const webpBuffer = await sharp(inputImage)
        .resize({
          width: 4096,
          height: 4096,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .webp({ quality })
        .toBuffer()

      texture.setImage(webpBuffer)
      texture.setMimeType('image/webp')
    } catch (error) {
      console.error('Error converting texture to WebP:', error)
    }
  }

  const outputBuffer = await io.writeBinary(doc)

  fs.writeFileSync(outputPath, Buffer.from(outputBuffer))

  console.log(`Optimized GLB saved to ${outputPath}`)
}

const __dirname = dirname(fileURLToPath(import.meta.url))

const inputArg = process.argv[2]

if (!inputArg) {
  console.error('Usage: node optimizeGlb.js <regex>')
  process.exit(1)
}

/**
 * @param {string} inputFile
 * @returns {Promise<void>}
 */
async function processFile(inputFile) {
  const ext = path.extname(inputFile)
  const baseName = path.basename(inputFile, ext)
  const outputFile = path.join(path.dirname(inputFile), `${baseName}_OPTIMIZED.glb`)

  console.log(`Processing: ${inputFile}`)

  await optimizeGLB(inputFile, outputFile, 90)

  console.log(`Completed: ${outputFile}`)
}

/**
 * @param {string} dir
 * @returns {string[]}
 */
function findGlbFiles(dir) {
  let results = []
  const files = fs.readdirSync(dir)

  for (const file of files) {
    const filePath = path.join(dir, file)
    const stat = fs.statSync(filePath)

    if (stat.isDirectory()) {
      results = results.concat(findGlbFiles(filePath))
    } else if (path.extname(file).toLowerCase() === '.glb') {
      results.push(filePath)
    }
  }

  return results
}

(async () => {
  const assetsDir = path.join(__dirname, '..', 'src', 'assets', '3d')

  console.log(`Searching for GLB files in: ${assetsDir}`)

  if (!fs.existsSync(assetsDir)) {
    console.error(`Directory does not exist: ${assetsDir}`)
    process.exit(1)
  }

  let fileRegex

  try {
    fileRegex = new RegExp(inputArg)
  } catch (err) {
    console.error(`Invalid regex pattern: ${inputArg}`)
    process.exit(1)
  }

  const allGlbFiles = findGlbFiles(assetsDir)
  const glbFiles = allGlbFiles.filter(f => fileRegex.test(path.basename(f)) && !f.includes('_OPTIMIZED'))

  console.log(`Found ${glbFiles.length} matching GLB files`)

  for (const file of glbFiles) {
    try {
      console.log(`Processing: ${file}`)
      await processFile(file)
    } catch (error) {
      console.error(`Error processing ${file}:`, error)
    }
  }

  console.log('All matching optimizations complete.')
})()
