import path from 'path'
import { fileURLToPath } from 'url'
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
export const ASSETS_DIR = path.join(__dirname, '..', '..', 'src', 'assets')
export const PROJECT_ROOT = path.join(__dirname, '..', '..')
export const CONFIG_FILE = path.join(__dirname, 'assetPacker.config.json')
export const MANIFEST_FILE = path.join(__dirname, '..', '..', 'src', 'assets', 'manifest.ts')
export const PACKED_GLB_NAME = 'packed.glb'
export const ATLASES_DIR_NAME = 'atlases'
export const OUTPUT_GLB = path.join(__dirname, '..', '..', 'public', PACKED_GLB_NAME)
export const ATLASES_DIR = path.join(__dirname, '..', '..', 'public', ATLASES_DIR_NAME)
