import fs from 'fs'
import { CONFIG_FILE } from './constants.js'

/**
 * @typedef {Object} AssetPackerConfig
 * @property {string[]} selected
 * @property {number} atlasSize
 * @property {number} textureResolution
 * @property {number} webpQuality
 * @property {number} webpAlphaQuality
 * @property {number} mraoWebpQuality
 * @property {number} mraoWebpAlphaQuality
 */

/**
 * @returns {AssetPackerConfig}
 */
export function loadConfig() {
  if (fs.existsSync(CONFIG_FILE)) {
    return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'))
  }

  return {
    selected: [],
    atlasSize: 8192,
    textureResolution: 512,
    webpQuality: 90,
    webpAlphaQuality: 100,
    mraoWebpQuality: 70,
    mraoWebpAlphaQuality: 70
  }
}

/**
 * @param {Partial<AssetPackerConfig>} config
 * @returns {void}
 */
export function saveConfig(config) {
  /** @type {AssetPackerConfig} */
  const fullConfig = {
    selected: config.selected || [],
    atlasSize: config.atlasSize ?? 8192,
    textureResolution: config.textureResolution ?? 512,
    webpQuality: config.webpQuality ?? 90,
    webpAlphaQuality: config.webpAlphaQuality ?? 100,
    mraoWebpQuality: config.mraoWebpQuality ?? 70,
    mraoWebpAlphaQuality: config.mraoWebpAlphaQuality ?? 70
  }

  fs.writeFileSync(CONFIG_FILE, JSON.stringify(fullConfig, null, 2))
}
