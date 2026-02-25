import { GIFEncoder, quantize, applyPalette } from 'gifenc'

/**
 * Load a blob into an offscreen canvas and replace white (255,255,255)
 * pixels with fully transparent, returning the canvas at native size.
 */
function loadLayerTransparent(blob: Blob): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0)
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
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
  targetWidth?: number,
): Promise<Blob> {
  if (layers.length === 0) throw new Error('No layers to encode')

  // Pre-load all layers at native size with white → transparent
  const transparentLayers: HTMLCanvasElement[] = []
  for (const blob of layers) {
    transparentLayers.push(await loadLayerTransparent(blob))
  }

  const srcW = transparentLayers[0]!.width
  const srcH = transparentLayers[0]!.height

  // Output dimensions (scale down if targetWidth is smaller than source)
  const outW = targetWidth && targetWidth < srcW ? targetWidth : srcW
  const outH = Math.round(srcH * (outW / srcW))

  // Composite canvas at native resolution (avoids scaling artifacts between layers)
  const composite = document.createElement('canvas')
  composite.width = srcW
  composite.height = srcH
  const compCtx = composite.getContext('2d')!

  // Scale canvas for final frame output
  const scaled = document.createElement('canvas')
  scaled.width = outW
  scaled.height = outH
  const scaledCtx = scaled.getContext('2d')!
  scaledCtx.imageSmoothingEnabled = false

  const gif = GIFEncoder()

  // First frame: solid white background
  const whitePixels = new Uint8Array(outW * outH * 4)
  for (let i = 0; i < whitePixels.length; i += 4) {
    whitePixels[i] = 255
    whitePixels[i + 1] = 255
    whitePixels[i + 2] = 255
    whitePixels[i + 3] = 255
  }
  const whitePalette = quantize(whitePixels, 256, { format: 'rgba4444', oneBitAlpha: true })
  const whiteIndex = applyPalette(whitePixels, whitePalette, 'rgba4444')
  gif.writeFrame(whiteIndex, outW, outH, {
    palette: whitePalette,
    delay,
  })

  // Build frames in reverse: last layer first, layer 0 last
  for (let i = layers.length - 1; i >= 0; i--) {
    // Draw this layer on top of the composite at native resolution
    compCtx.drawImage(transparentLayers[i]!, 0, 0)

    // Scale the composite down to output size
    scaledCtx.clearRect(0, 0, outW, outH)
    scaledCtx.drawImage(composite, 0, 0, outW, outH)

    // Extract RGBA pixels from the scaled frame
    const imageData = scaledCtx.getImageData(0, 0, outW, outH)
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

    gif.writeFrame(index, outW, outH, {
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
