export interface QuantizeResult {
  palette: number[][]
  labels: Uint8Array
  quantizedBlob: Blob
  width: number
  height: number
}

function loadImageData(source: Blob): Promise<{ imageData: ImageData; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0)
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(img.src)
      resolve({ imageData, width: canvas.width, height: canvas.height })
    }
    img.onerror = () => {
      URL.revokeObjectURL(img.src)
      reject(new Error('Failed to load image for quantization'))
    }
    img.src = URL.createObjectURL(source)
  })
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

export function quantize(
  source: Blob,
  colorCount: number,
  onProgress?: (progress: number) => void,
): Promise<QuantizeResult> {
  return new Promise(async (resolve, reject) => {
    const { imageData, width, height } = await loadImageData(source)

    const worker = new Worker(
      new URL('../workers/quantize.worker.ts', import.meta.url),
      { type: 'module' },
    )

    worker.onmessage = async (e) => {
      if (e.data.progress !== undefined) {
        onProgress?.(e.data.progress)
        return
      }

      const { palette, labels } = e.data as { palette: number[][]; labels: Uint8Array }
      worker.terminate()

      try {
        const quantizedBlob = await renderQuantized(palette, labels, width, height)
        resolve({ palette, labels, quantizedBlob, width, height })
      } catch (err) {
        reject(err)
      }
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
    })
  })
}

export async function replacePalette(
  labels: Uint8Array,
  newPalette: number[][],
  width: number,
  height: number,
): Promise<Blob> {
  return renderQuantized(newPalette, labels, width, height)
}
