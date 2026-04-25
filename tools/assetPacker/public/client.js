let ws = null
let heartbeatInterval = null
let allFiles = []
let selectedFiles = new Set()
const PORT = 3456

function getElement(id) {
  const element = document.getElementById(id)
  if (!(element instanceof HTMLElement)) {
    throw new Error(`${id} element not found`)
  }
  return element
}

function getInput(id) {
  const input = getElement(id)
  if (!(input instanceof HTMLInputElement)) {
    throw new Error(`${id} input not found`)
  }
  return input
}

function connect() {
  ws = new WebSocket(`ws://localhost:${PORT}`)
  ws.onopen = () => {
    console.log('Connected to server')
    startHeartbeat()
  }
  ws.onmessage = (event) => {
    const data = JSON.parse(event.data)
    switch (data.type) {
      case 'init':
        allFiles = data.files
        selectedFiles = new Set(data.selected)
        getInput('atlasSize').value = String(data.atlasSize ?? 8192)
        getInput('textureResolution').value = String(data.textureResolution ?? 512)
        getInput('webpQuality').value = String(data.webpQuality ?? 90)
        getInput('webpAlphaQuality').value = String(data.webpAlphaQuality ?? 100)
        getInput('mraoWebpQuality').value = String(data.mraoWebpQuality ?? 70)
        getInput('mraoWebpAlphaQuality').value = String(data.mraoWebpAlphaQuality ?? 70)
        renderFileList()
        updateStats()
        break
      case 'config-updated':
        selectedFiles = new Set(data.selected)
        updateCheckboxes()
        updateStats()
        break
      case 'atlas-size-updated':
        getInput('atlasSize').value = String(data.atlasSize)
        break
      case 'texture-resolution-updated':
        getInput('textureResolution').value = String(data.textureResolution)
        break
      case 'webp-quality-updated':
        getInput('webpQuality').value = String(data.webpQuality)
        break
      case 'webp-alpha-quality-updated':
        getInput('webpAlphaQuality').value = String(data.webpAlphaQuality)
        break
      case 'mrao-webp-quality-updated':
        getInput('mraoWebpQuality').value = String(data.mraoWebpQuality)
        break
      case 'mrao-webp-alpha-quality-updated':
        getInput('mraoWebpAlphaQuality').value = String(data.mraoWebpAlphaQuality)
        break
      case 'pack-progress':
        showStatus(data.message, 'processing')
        break
      case 'pack-complete':
        showStatus(`✓ Success! Packed to ${data.outputPath} (${formatBytes(data.fileSize)})`, 'success')
        break
      case 'pack-error':
        showStatus(`✗ Error: ${data.error}`, 'error')
        break
    }
  }
  ws.onclose = () => {
    console.log('Disconnected from server')
    stopHeartbeat()
  }
  ws.onerror = (error) => {
    console.error('WebSocket error:', error)
  }
}

function startHeartbeat() {
  heartbeatInterval = setInterval(() => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'heartbeat' }))
    }
  }, 500)
}

function stopHeartbeat() {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval)
    heartbeatInterval = null
  }
}

function send(data) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data))
  }
}

function renderFileList() {
  const fileList = getElement('fileList')
  fileList.innerHTML = ''
  allFiles.forEach((file) => {
    const item = document.createElement('div')
    item.className = 'file-item'
    item.dataset.path = file.gltfPath

    const checkbox = document.createElement('input')
    checkbox.type = 'checkbox'
    checkbox.checked = selectedFiles.has(file.gltfPath)
    checkbox.addEventListener('change', (event) => {
      const target = event.currentTarget
      if (!(target instanceof HTMLInputElement)) {
        return
      }
      toggleFile(file.gltfPath, target.checked)
    })

    const info = document.createElement('div')
    info.className = 'file-info'

    const name = document.createElement('div')
    name.className = 'file-name'
    name.textContent = file.name

    const pathDiv = document.createElement('div')
    pathDiv.className = 'file-path'
    pathDiv.textContent = file.gltfPath

    if (file.binPath) {
      const badge = document.createElement('span')
      badge.className = 'file-badge'
      badge.textContent = '+ BIN'
      name.appendChild(badge)
    }

    info.appendChild(name)
    info.appendChild(pathDiv)
    item.appendChild(checkbox)
    item.appendChild(info)
    item.addEventListener('click', (event) => {
      if (event.target !== checkbox) {
        checkbox.checked = !checkbox.checked
        toggleFile(file.gltfPath, checkbox.checked)
      }
    })
    fileList.appendChild(item)
  })

  getElement('totalCount').textContent = String(allFiles.length)
}

function toggleFile(path, selected) {
  if (selected) {
    selectedFiles.add(path)
  }
  else {
    selectedFiles.delete(path)
  }
  updateStats()
  send({ type: 'update-selection', selected: Array.from(selectedFiles) })
}

function updateCheckboxes() {
  document.querySelectorAll('.file-item').forEach((item) => {
    if (!(item instanceof HTMLElement)) {
      return
    }
    const checkbox = item.querySelector('input[type="checkbox"]')
    if (!(checkbox instanceof HTMLInputElement)) {
      throw new Error('Checkbox not found in file item')
    }
    const path = item.dataset.path
    checkbox.checked = typeof path === 'string' && selectedFiles.has(path)
  })
}

function updateStats() {
  getElement('selectedCount').textContent = String(selectedFiles.size)
}

function showStatus(message, type = '') {
  const status = getElement('status')
  status.textContent = message
  status.className = `status ${type}`
}

function formatBytes(bytes) {
  if (bytes === 0) {
    return '0 Bytes'
  }
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
}

const filterEl = getInput('filter')
filterEl.addEventListener('input', (event) => {
  const target = event.currentTarget
  if (!(target instanceof HTMLInputElement)) {
    return
  }
  const filter = target.value.toLowerCase()
  document.querySelectorAll('.file-item').forEach((item) => {
    if (!(item instanceof HTMLElement)) {
      return
    }
    const fileNameEl = item.querySelector('.file-name')
    const filePathEl = item.querySelector('.file-path')
    const name = (fileNameEl?.textContent ?? '').toLowerCase()
    const filePath = (filePathEl?.textContent ?? '').toLowerCase()
    if (name.includes(filter) || filePath.includes(filter)) {
      item.classList.remove('hidden')
    }
    else {
      item.classList.add('hidden')
    }
  })
})

getElement('selectAll').addEventListener('click', () => {
  const visibleItems = Array.from(document.querySelectorAll('.file-item:not(.hidden)'))
  visibleItems.forEach((item) => {
    if (!(item instanceof HTMLElement)) {
      return
    }
    const path = item.dataset.path
    if (path) {
      selectedFiles.add(path)
    }
  })
  updateCheckboxes()
  updateStats()
  send({ type: 'update-selection', selected: Array.from(selectedFiles) })
})

getElement('deselectAll').addEventListener('click', () => {
  const visibleItems = Array.from(document.querySelectorAll('.file-item:not(.hidden)'))
  visibleItems.forEach((item) => {
    if (!(item instanceof HTMLElement)) {
      return
    }
    const path = item.dataset.path
    if (path) {
      selectedFiles.delete(path)
    }
  })
  updateCheckboxes()
  updateStats()
  send({ type: 'update-selection', selected: Array.from(selectedFiles) })
})

getInput('atlasSize').addEventListener('change', (event) => {
  const target = event.currentTarget
  if (!(target instanceof HTMLInputElement)) {
    return
  }
  const atlasSize = Number.parseInt(target.value, 10)
  if (Number.isNaN(atlasSize)) {
    return
  }
  send({ type: 'update-atlas-size', atlasSize })
  showStatus(`Atlas size set to ${atlasSize}x${atlasSize}`, '')
})

getInput('textureResolution').addEventListener('change', (event) => {
  const target = event.currentTarget
  if (!(target instanceof HTMLInputElement)) {
    return
  }
  const textureResolution = Number.parseInt(target.value, 10)
  if (Number.isNaN(textureResolution)) {
    return
  }
  send({ type: 'update-texture-resolution', textureResolution })
  showStatus(`PBR texture size set to ${textureResolution}x${textureResolution}`, '')
})

getInput('webpQuality').addEventListener('change', (event) => {
  const target = event.currentTarget
  if (!(target instanceof HTMLInputElement)) {
    return
  }
  let webpQuality = Number.parseInt(target.value, 10)
  webpQuality = Math.max(0, Math.min(100, webpQuality))
  target.value = String(webpQuality)
  send({ type: 'update-webp-quality', webpQuality })
  showStatus(`WebP quality set to ${webpQuality}`, '')
})

getInput('webpAlphaQuality').addEventListener('change', (event) => {
  const target = event.currentTarget
  if (!(target instanceof HTMLInputElement)) {
    return
  }
  let webpAlphaQuality = Number.parseInt(target.value, 10)
  webpAlphaQuality = Math.max(0, Math.min(100, webpAlphaQuality))
  target.value = String(webpAlphaQuality)
  send({ type: 'update-webp-alpha-quality', webpAlphaQuality })
  showStatus(`WebP alpha quality set to ${webpAlphaQuality}`, '')
})

getInput('mraoWebpQuality').addEventListener('change', (event) => {
  const target = event.currentTarget
  if (!(target instanceof HTMLInputElement)) {
    return
  }
  let mraoWebpQuality = Number.parseInt(target.value, 10)
  mraoWebpQuality = Math.max(0, Math.min(100, mraoWebpQuality))
  target.value = String(mraoWebpQuality)
  send({ type: 'update-mrao-webp-quality', mraoWebpQuality })
  showStatus(`MRAO WebP quality set to ${mraoWebpQuality}`, '')
})

getInput('mraoWebpAlphaQuality').addEventListener('change', (event) => {
  const target = event.currentTarget
  if (!(target instanceof HTMLInputElement)) {
    return
  }
  let mraoWebpAlphaQuality = Number.parseInt(target.value, 10)
  mraoWebpAlphaQuality = Math.max(0, Math.min(100, mraoWebpAlphaQuality))
  target.value = String(mraoWebpAlphaQuality)
  send({ type: 'update-mrao-webp-alpha-quality', mraoWebpAlphaQuality })
  showStatus(`MRAO WebP alpha quality set to ${mraoWebpAlphaQuality}`, '')
})

getElement('pack').addEventListener('click', () => {
  if (selectedFiles.size === 0) {
    showStatus('✗ No files selected!', 'error')
    return
  }
  showStatus('📦 Packing files...', 'processing')
  send({ type: 'pack' })
})

window.addEventListener('beforeunload', () => {
  stopHeartbeat()
  if (ws) {
    ws.close()
  }
})

connect()
