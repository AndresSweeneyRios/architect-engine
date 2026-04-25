#!/usr/bin/env node
import { scanGltfFiles, loadConfig, generateAtlases, generateManifest, packGlb } from './assetPackerCore.js'

/**
 * @returns {Promise<void>}
 */
async function buildAssets() {
  try {
    console.log('🎨 Asset Packer - CLI Mode\n')

    const config = loadConfig()

    console.log('Configuration loaded:')
    console.log(`  Selected files: ${config.selected.length}`)
    console.log(`  Atlas size: ${config.atlasSize}x${config.atlasSize}`)
    console.log(`  PBR texture resolution: ${config.textureResolution}x${config.textureResolution}`)
    console.log(`  WebP quality: ${config.webpQuality}`)
    console.log(`  WebP alpha quality: ${config.webpAlphaQuality}`)
    console.log(`  MRAO WebP quality: ${config.mraoWebpQuality}`)
    console.log(`  MRAO WebP alpha quality: ${config.mraoWebpAlphaQuality}\n`)

    const files = scanGltfFiles()

    console.log(`Found ${files.length} GLTF files\n`)

    if (config.selected.length === 0) {
      console.warn('⚠️  No files selected in config. Please use the web UI to select files.')
      process.exit(1)
    }

    console.log('📦 Generating texture atlases...')

    const atlasManifest = await generateAtlases(config.selected, files, config.atlasSize, config.textureResolution, config.webpQuality, config.webpAlphaQuality, config.mraoWebpQuality, config.mraoWebpAlphaQuality)

    console.log('\n📝 Generating manifest...')

    await generateManifest(config.selected, files, atlasManifest)

    console.log('  ✓ Manifest generated')
    console.log('\n📦 Packing GLB...')

    const result = await packGlb(config.selected, files)

    console.log('\n✅ Asset packing complete!')
    console.log(`   Output: ${result.outputPath}`)
    console.log(`   Size: ${(result.fileSize / 1024 / 1024).toFixed(2)} MB`)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const stack = error instanceof Error ? error.stack : ''

    console.error('\n❌ Error:', message)

    if (stack) {
      console.error(stack)
    }

    process.exit(1)
  }
}

void buildAssets()
