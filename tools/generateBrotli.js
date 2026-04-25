import fs from 'fs'
import path from 'path'
import { Worker } from 'worker_threads'
import os from 'os'

const __dirname = import.meta.dirname

const skipRegex = /(\.br|\.gz|\.blend.*|\.xcf|\.wav|\.zip)$/
const skipFoldersRegex = /(\bhdr\b|\btextures\b|\banimations\b)/

/**
 * @param {string} dir
 * @param {string[]} fileList
 * @returns {string[]}
 */
const collectFiles = (dir, fileList = []) => {
  fs.readdirSync(dir).forEach((file) => {
    const filePath = path.join(dir, file)
    const stat = fs.statSync(filePath)

    if (stat.isDirectory()) {
      if (!skipFoldersRegex.test(filePath)) {
        collectFiles(filePath, fileList)
      }
    } else {
      if (!skipRegex.test(filePath) && !fs.existsSync(`${filePath}.br`)) {
        fileList.push(filePath)
      }
    }
  })
  return fileList
}
const maxThreads = Math.max(1, os.cpus().length)

console.log(`Detected ${maxThreads} logical CPU cores.`)

const workerPath = path.join(__dirname, './generateBrotli_worker.js')

/**
 * @param {string[]} files
 * @param {number} maxThreads
 * @returns {void}
 */
const processFilesWithWorkers = (files, maxThreads) => {
  let index = 0
  let activeWorkers = 0

  const processNextFile = () => {
    if (index >= files.length) {
      if (activeWorkers === 0) {
        console.log('All files processed.')
      }
      return
    }

    const file = files[index]
    const worker = new Worker(workerPath, { workerData: { file } })

    activeWorkers++
    index++

    console.log(`Processing file ${file} (${index} of ${files.length})...`)

    worker.on('message', (message) => {
      if (message.success) {
        console.log(`File ${file} compressed successfully.`)
      } else {
        console.error(`Failed to compress file ${file}:`, message.error)
      }

      activeWorkers--
      processNextFile()
    })

    worker.on('error', (err) => {
      console.error(`Worker error for file ${file}:`, err)
      activeWorkers--
      processNextFile()
    })

    worker.on('exit', (code) => {
      if (code !== 0) {
        console.error(`Worker stopped with exit code ${code}`)
      }
    })

    if (activeWorkers < maxThreads) {
      processNextFile()
    }
  }

  for (let i = 0; i < maxThreads; i++) {
    processNextFile()
  }
}

const distDir = path.join(__dirname, '../dist')

if (!fs.existsSync(distDir)) {
  console.log('No dist directory found. Skipping brotli generation.')
  process.exit(0)
}

const files = collectFiles(distDir)

if (files.length > 0) {
  console.log(`Processing ${files.length} files with up to ${maxThreads} threads...`)
  processFilesWithWorkers(files, maxThreads)
} else {
  console.log('No files to process.')
}
