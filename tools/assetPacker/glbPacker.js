import fs from 'fs'
import path from 'path'
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { draco } from '@gltf-transform/functions'
import draco3d from 'draco3dgltf'
import { OUTPUT_GLB } from './constants.js'

/**
 * @typedef {Object} GltfFileEntry
 * @property {string} name
 * @property {string} gltfPath
 * @property {string} fullGltfPath
 * @property {string | null} fullBinPath
 */

/**
 * @typedef {Object} PackGlbResult
 * @property {boolean} success
 * @property {string} outputPath
 * @property {number} fileSize
 */

/**
 * @param {string[]} selectedFiles
 * @param {GltfFileEntry[]} allFiles
 * @returns {Promise<PackGlbResult>}
 */
export async function packGlb(selectedFiles, allFiles) {
  console.log('Starting GLB packing...')

  const fileMap = new Map(allFiles.map(f => [f.gltfPath, f]))
  const selected = selectedFiles.map(path => fileMap.get(path)).filter(Boolean)

  if (selected.length === 0) {
    throw new Error('No files selected for packing')
  }

  const io = new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({
      'draco3d.decoder': await draco3d.createDecoderModule(),
      'draco3d.encoder': await draco3d.createEncoderModule(),
    })

  let mergedDoc = null

  for (const file of selected) {
    console.log(`Processing: ${file.name}`)

    const safeName = file.gltfPath.replace(/\\/g, '_').replace(/\//g, '_').replace(/\./g, '_')
    const gltfContent = fs.readFileSync(file.fullGltfPath, 'utf8')
    const gltfJson = JSON.parse(gltfContent)

    let doc

    if (file.fullBinPath && fs.existsSync(file.fullBinPath)) {
      const binBuffer = fs.readFileSync(file.fullBinPath)

      doc = await io.readJSON({
        json: gltfJson,
        resources: {
          [path.basename(file.fullBinPath)]: binBuffer
        }
      })
    } else {
      doc = await io.readJSON({
        json: gltfJson,
        resources: {}
      })
    }

    if (!mergedDoc) {
      mergedDoc = doc

      const root = mergedDoc.getRoot()

      root.listScenes().forEach((scene, idx) => {
        scene.setName(`${safeName}`)
      })
    } else {
      const root = doc.getRoot()
      const mergedRoot = mergedDoc.getRoot()

      root.listScenes().forEach((scene, idx) => {
        const clonedScene = scene.clone()
        clonedScene.setName(`${safeName}`)
        mergedRoot.listScenes().push(clonedScene)
      })

      root.listNodes().forEach((node, idx) => {
        const clonedNode = node.clone()
        mergedRoot.listNodes().push(clonedNode)
      })

      root.listMeshes().forEach((mesh, idx) => {
        const clonedMesh = mesh.clone()
        mergedRoot.listMeshes().push(clonedMesh)
      })

      root.listMaterials().forEach(material => {
        mergedRoot.listMaterials().push(material.clone())
      })

      root.listTextures().forEach(texture => {
        mergedRoot.listTextures().push(texture.clone())
      })

      root.listAccessors().forEach(accessor => {
        mergedRoot.listAccessors().push(accessor.clone())
      })

      root.listBuffers().forEach(buffer => {
        mergedRoot.listBuffers().push(buffer.clone())
      })
    }
  }

  if (!mergedDoc) {
    throw new Error('Failed to create merged document')
  }

  console.log('Applying Draco compression...')

  await mergedDoc.transform(draco())

  const glbBuffer = await io.writeBinary(mergedDoc)

  fs.writeFileSync(OUTPUT_GLB, Buffer.from(glbBuffer))

  console.log(`Packed GLB saved to: ${OUTPUT_GLB}`)
  console.log(`File size: ${(glbBuffer.byteLength / 1024 / 1024).toFixed(2)} MB`)

  return {
    success: true,
    outputPath: path.relative(path.join(import.meta.dirname, '..'), OUTPUT_GLB),
    fileSize: glbBuffer.byteLength
  }
}
