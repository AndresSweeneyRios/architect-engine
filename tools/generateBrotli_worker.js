import { parentPort, workerData } from 'worker_threads'
import fs from 'fs'
import zlib from 'zlib'

try {
  const file = workerData.file
  const outputFilePath = `${file}.br`

  const input = fs.readFileSync(file)

  const compressed = zlib.brotliCompressSync(input, {
    params: {
      [zlib.constants.BROTLI_PARAM_QUALITY]: 11,
    },
  })

  fs.writeFileSync(outputFilePath, compressed)

  parentPort && parentPort.postMessage({ success: true })
} catch (error) {
  const message = error instanceof Error ? error.message : String(error)
  parentPort && parentPort.postMessage({ success: false, error: message })
}
