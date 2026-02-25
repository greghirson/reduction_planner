import { GIFEncoder, quantize, applyPalette } from 'gifenc'

/**
 * Load a blob into an offscreen canvas and replace white (255,255,255)
 * pixels with fully transparent, returning the canvas.
 */
function loadLayerTransparent(
  blob: Blob,
  width: number,
  height: number,
): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0, width, height)
      const imageData = ctx.getImageData(0, 0, width, height)
      const d = imageData.data
      for (let i = 0; i < d.length; i += 4) {
        if (d[i] === 255 && d[i + 1] === 255 && d[i + 2] === 255) {
          d[i + 3] = 0
        }
      }
      ctx.putImageData(imageData, 0, 0)
      URL.revokeObjectURL(img.src)
      resolve(canvas)
    }
    img.onerror = () => {
      URL.revokeObjectURL(img.src)
      reject(new Error('Failed to load layer image'))
    }
    img.src = URL.createObjectURL(blob)
  })
}

function getImageDimensions(blob: Blob): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight })
      URL.revokeObjectURL(img.src)
    }
    img.onerror = () => {
      URL.revokeObjectURL(img.src)
      reject(new Error('Failed to read layer dimensions'))
    }
    img.src = URL.createObjectURL(blob)
  })
}

/**
 * Build an animated GIF showing layers composited in reverse order.
 *
 * Each layer blob is a monochrome cumulative image (layers 0..i in one color,
 * white elsewhere). We composite them back-to-front:
 *   Frame 0: layer N (last/lightest)
 *   Frame 1: layer N + layer N-1 on top (white → transparent)
 *   Frame 2: layer N + N-1 + N-2 on top
 *   ...through layer 0 (darkest on top)
 *
 * This shows the reduction print build-up from background to foreground.
 */
export async function buildLayerGif(
  layers: Blob[],
  delay: number = 500,
): Promise<Blob> {
  if (layers.length === 0) throw new Error('No layers to encode')

  const { width, height } = await getImageDimensions(layers[0]!)

  // Pre-load all layers with white → transparent
  const transparentLayers: HTMLCanvasElement[] = []
  for (const blob of layers) {
    transparentLayers.push(await loadLayerTransparent(blob, width, height))
  }

  // Composite canvas accumulates layers
  const composite = document.createElement('canvas')
  composite.width = width
  composite.height = height
  const compCtx = composite.getContext('2d')!

  const gif = GIFEncoder()

  // Build frames in reverse: last layer first, layer 0 last
  for (let i = layers.length - 1; i >= 0; i--) {
    // Draw this layer on top of the composite (white is already transparent)
    compCtx.drawImage(transparentLayers[i]!, 0, 0)

    // Extract RGBA pixels from the composite
    const imageData = compCtx.getImageData(0, 0, width, height)
    const rgba = new Uint8Array(imageData.data.buffer)

    // Quantize for GIF
    const gifPalette = quantize(rgba, 256, { format: 'rgba4444', oneBitAlpha: true })
    const index = applyPalette(rgba, gifPalette, 'rgba4444')

    // Find transparent index in palette
    let transparentIndex = 0
    for (let pi = 0; pi < gifPalette.length; pi++) {
      if (gifPalette[pi]![3] === 0) {
        transparentIndex = pi
        break
      }
    }

    const isLast = i === 0
    const frameDelay = isLast ? Math.max(delay, 1500) : delay

    gif.writeFrame(index, width, height, {
      palette: gifPalette,
      delay: frameDelay,
      transparent: true,
      transparentIndex,
      dispose: 2,
    })
  }

  gif.finish()
  const bytes = gif.bytes()
  return new Blob([new Uint8Array(bytes)], { type: 'image/gif' })
}
