export interface QuantizeResult {
  palette: number[][]
  labels: Uint8Array
  quantizedBlob: Blob
  width: number
  height: number
}

async function loadImageData(source: Blob): Promise<{ imageData: ImageData; width: number; height: number }> {
  const bitmap = await createImageBitmap(source)
  const canvas = document.createElement('canvas')
  canvas.width = bitmap.width
  canvas.height = bitmap.height
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(bitmap, 0, 0)
  bitmap.close()
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
  return { imageData, width: canvas.width, height: canvas.height }
}

function renderQuantized(
  palette: number[][],
  labels: Uint8Array,
  width: number,
  height: number,
): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')!
  const imageData = ctx.createImageData(width, height)
  const data = imageData.data
  const totalPixels = width * height

  for (let i = 0; i < totalPixels; i++) {
    const color = palette[labels[i]!]!
    const offset = i * 4
    data[offset] = color[0]!
    data[offset + 1] = color[1]!
    data[offset + 2] = color[2]!
    data[offset + 3] = 255
  }

  ctx.putImageData(imageData, 0, 0)

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('Failed to render quantized image'))
    }, 'image/png')
  })
}

export async function quantize(
  source: Blob,
  colorCount: number,
  simplification: number = 0,
  onProgress?: (progress: number) => void,
): Promise<QuantizeResult> {
  const { imageData, width, height } = await loadImageData(source)

  const { palette, labels } = await new Promise<{ palette: number[][]; labels: Uint8Array }>((resolve, reject) => {
    const worker = new Worker(
      new URL('../workers/quantize.worker.ts', import.meta.url),
      { type: 'module' },
    )

    worker.onmessage = (e) => {
      if (e.data.progress !== undefined) {
        onProgress?.(e.data.progress)
        return
      }

      worker.terminate()
      resolve(e.data as { palette: number[][]; labels: Uint8Array })
    }

    worker.onerror = (err) => {
      worker.terminate()
      reject(new Error(`Quantization worker error: ${err.message}`))
    }

    worker.postMessage({
      pixels: imageData.data,
      width,
      height,
      colorCount,
      simplification,
    })
  })

  const quantizedBlob = await renderQuantized(palette, labels, width, height)
  return { palette, labels, quantizedBlob, width, height }
}

export async function replacePalette(
  labels: Uint8Array,
  newPalette: number[][],
  width: number,
  height: number,
): Promise<Blob> {
  return renderQuantized(newPalette, labels, width, height)
}

export async function mergeAndReplace(
  labels: Uint8Array,
  palette: number[][],
  keepIdx: number,
  removeIdx: number,
  width: number,
  height: number,
): Promise<{ labels: Uint8Array; palette: number[][]; quantizedBlob: Blob }> {
  const newLabels = new Uint8Array(labels.length)
  for (let i = 0; i < labels.length; i++) {
    let label = labels[i]!
    if (label === removeIdx) {
      label = keepIdx
    }
    // Shift labels above the removed index down by 1
    if (label > removeIdx) {
      label--
    }
    newLabels[i] = label
  }

  // Adjust keepIdx if it was above removeIdx
  const newPalette = palette.filter((_, i) => i !== removeIdx)
  const quantizedBlob = await renderQuantized(newPalette, newLabels, width, height)
  return { labels: newLabels, palette: newPalette, quantizedBlob }
}
