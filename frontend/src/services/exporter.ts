import { zipSync } from 'fflate'
import type { ProjectRecord } from './storage'

export async function exportZip(record: ProjectRecord): Promise<Blob> {
  const files: Record<string, Uint8Array> = {}

  if (record.images.quantized) {
    files['quantized.png'] = new Uint8Array(await record.images.quantized.arrayBuffer())
  }

  if (record.images.layers) {
    for (let i = 0; i < record.images.layers.length; i++) {
      const buf = await record.images.layers[i]!.arrayBuffer()
      files[`layers/layer_${i}.png`] = new Uint8Array(buf)
    }
  }

  const zipped = zipSync(files, { level: 6 })
  return new Blob([zipped.buffer as ArrayBuffer], { type: 'application/zip' })
}

export function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
