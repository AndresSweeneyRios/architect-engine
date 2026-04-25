import http from 'http'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { WebSocketServer } from 'ws'
import { exec } from 'child_process'
import { scanGltfFiles, loadConfig, saveConfig, generateAtlases, generateManifest, packGlb } from './assetPackerCore.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const PORT = 3456
const CLIENT_DIR = path.join(__dirname, 'public')

const mimeTypes = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json'
}
const server = http.createServer((req, res) => {
  let filePath = req.url === '/' ? '/index.html' : (req.url || '/index.html')
  const fullPath = path.join(CLIENT_DIR, filePath)
  const ext = path.extname(fullPath)
  const contentType = mimeTypes[ext] || 'text/plain'
  fs.readFile(fullPath, (err, content) => {
    if (err) {
      res.writeHead(404)
      res.end('Not found')
    } else {
      res.writeHead(200, { 'Content-Type': contentType })
      res.end(content)
    }
  })
})

const wss = new WebSocketServer({ server })

const clients = new Set()
let missedHeartbeats = new Map()

const WS_OPEN = 1

const sendMessage = (socket, payload) => {
  socket.send(JSON.stringify(payload))
}

const broadcast = (payload) => {
  clients.forEach((client) => {
    if (client.readyState === WS_OPEN) {
      sendMessage(client, payload)
    }
  })
}
const updateConfigField = (field, value) => {
  const config = loadConfig()
  config[field] = value
  saveConfig(config)
}

const toInitPayload = (files, config) => ({
  type: 'init',
  files,
  selected: config.selected,
  atlasSize: config.atlasSize ?? 8192,
  textureResolution: config.textureResolution ?? 512,
  webpQuality: config.webpQuality ?? 90,
  webpAlphaQuality: config.webpAlphaQuality ?? 100,
  mraoWebpQuality: config.mraoWebpQuality ?? 70,
  mraoWebpAlphaQuality: config.mraoWebpAlphaQuality ?? 70
})

wss.on('connection', (ws) => {
  console.log('Client connected')

  clients.add(ws)
  missedHeartbeats.set(ws, 0)

  const files = scanGltfFiles()
  const config = loadConfig()

  sendMessage(ws, toInitPayload(files, config))

  generateManifest(config.selected, files)

  ws.on('message', async (message) => {
    const data = JSON.parse(message.toString())

    switch (data.type) {
      case 'heartbeat': {
        missedHeartbeats.set(ws, 0)
        break
      }
      case 'update-selection': {
        const nextFiles = scanGltfFiles()

        const nextConfig = {
          ...loadConfig(),
          selected: data.selected
        }

        saveConfig(nextConfig)

        generateManifest(data.selected, nextFiles)

        broadcast({
          type: 'config-updated',
          selected: data.selected
        })
        break
      }
      case 'update-atlas-size': {
        updateConfigField('atlasSize', data.atlasSize)
        broadcast({
          type: 'atlas-size-updated',
          atlasSize: data.atlasSize
        })
        break
      }
      case 'update-texture-resolution': {
        updateConfigField('textureResolution', data.textureResolution)
        broadcast({
          type: 'texture-resolution-updated',
          textureResolution: data.textureResolution
        })
        break
      }
      case 'update-webp-quality': {
        updateConfigField('webpQuality', data.webpQuality)
        broadcast({
          type: 'webp-quality-updated',
          webpQuality: data.webpQuality
        })
        break
      }
      case 'update-webp-alpha-quality': {
        updateConfigField('webpAlphaQuality', data.webpAlphaQuality)
        broadcast({
          type: 'webp-alpha-quality-updated',
          webpAlphaQuality: data.webpAlphaQuality
        })
        break
      }
      case 'update-mrao-webp-quality': {
        updateConfigField('mraoWebpQuality', data.mraoWebpQuality)
        broadcast({
          type: 'mrao-webp-quality-updated',
          mraoWebpQuality: data.mraoWebpQuality
        })
        break
      }
      case 'update-mrao-webp-alpha-quality': {
        updateConfigField('mraoWebpAlphaQuality', data.mraoWebpAlphaQuality)
        broadcast({
          type: 'mrao-webp-alpha-quality-updated',
          mraoWebpAlphaQuality: data.mraoWebpAlphaQuality
        })
        break
      }
      case 'pack': {
        try {
          const nextFiles = scanGltfFiles()
          const nextConfig = loadConfig()

          sendMessage(ws, {
            type: 'pack-progress',
            message: 'Scanning files...'
          })

          sendMessage(ws, {
            type: 'pack-progress',
            message: 'Generating texture atlases...'
          })

          const atlasManifest = await generateAtlases(nextConfig.selected, nextFiles, nextConfig.atlasSize ?? 8192, nextConfig.textureResolution ?? 512, nextConfig.webpQuality ?? 90, nextConfig.webpAlphaQuality ?? 100, nextConfig.mraoWebpQuality ?? 70, nextConfig.mraoWebpAlphaQuality ?? 70)

          await generateManifest(nextConfig.selected, nextFiles, atlasManifest)

          sendMessage(ws, {
            type: 'pack-progress',
            message: 'Packing GLB...'
          })

          const result = await packGlb(nextConfig.selected, nextFiles)

          broadcast({
            type: 'pack-complete',
            ...result
          })
        } catch (error) {
          console.error('Pack error:', error)

          const errorMessage = error instanceof Error ? error.message : String(error)

          broadcast({
            type: 'pack-error',
            error: errorMessage
          })
        }
        break
      }
      default:
        break
    }
  })

  ws.on('close', () => {
    console.log('Client disconnected')

    clients.delete(ws)
    missedHeartbeats.delete(ws)

    if (clients.size === 0) {
      console.log('No clients connected, shutting down...')

      setTimeout(() => {
        if (clients.size === 0) {
          server.close()
          process.exit(0)
        }
      }, 1000)
    }
  })
})

setInterval(() => {
  clients.forEach((ws) => {
    const missed = missedHeartbeats.get(ws) || 0

    if (missed > 5) {
      console.log('Client timeout, closing connection')
      ws.terminate()
      clients.delete(ws)
      missedHeartbeats.delete(ws)
    } else {
      missedHeartbeats.set(ws, missed + 1)
    }
  })
}, 500)

server.listen(PORT, () => {
  console.log(`Asset Packer running on http://localhost:${PORT}`)

  const url = `http://localhost:${PORT}`

  const command = process.platform === 'win32'
    ? `start ${url}`
    : process.platform === 'darwin'
      ? `open ${url}`
      : `xdg-open ${url}`

  exec(command, (error) => {
    if (error) {
      console.log(`Please open your browser to: ${url}`)
    }
  })
})
