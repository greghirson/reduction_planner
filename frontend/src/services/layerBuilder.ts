function luminance(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b
}

function loadImageData(source: Blob): Promise<{ data: Uint8ClampedArray; width: number; height: number }> {
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
      resolve({ data: imageData.data, width: canvas.width, height: canvas.height })
    }
    img.onerror = () => {
      URL.revokeObjectURL(img.src)
      reject(new Error('Failed to load image for layer building'))
    }
    img.src = URL.createObjectURL(source)
  })
}

function renderLayer(
  labels: Uint8Array,
  order: number[],
  layerIdx: number,
  layerColor: number[],
  width: number,
  height: number,
): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')!
  const imageData = ctx.createImageData(width, height)
  const pixels = imageData.data
  const totalPixels = width * height

  // Start with white canvas
  for (let i = 0; i < totalPixels; i++) {
    const offset = i * 4
    pixels[offset] = 255
    pixels[offset + 1] = 255
    pixels[offset + 2] = 255
    pixels[offset + 3] = 255
  }

  // Paint all pixels from layers 0..layerIdx in this layer's color
  const r = layerColor[0]!
  const g = layerColor[1]!
  const b = layerColor[2]!
  for (let ci = 0; ci <= layerIdx; ci++) {
    const paletteIdx = order[ci]!
    for (let i = 0; i < totalPixels; i++) {
      if (labels[i] === paletteIdx) {
        const offset = i * 4
        pixels[offset] = r
        pixels[offset + 1] = g
        pixels[offset + 2] = b
        pixels[offset + 3] = 255
      }
    }
  }

  ctx.putImageData(imageData, 0, 0)

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('Failed to render layer'))
    }, 'image/png')
  })
}

export interface BuildLayersResult {
  layers: Blob[]
  order: number[]
}

export async function buildLayers(
  source: Blob,
  palette: number[][],
  storedLabels: Uint8Array | undefined,
  imageWidth: number | undefined,
  imageHeight: number | undefined,
  isFlipped: boolean,
  order?: number[],
): Promise<BuildLayersResult> {
  // Get labels: reuse stored labels only if not flipped (labels match unflipped image)
  let labels: Uint8Array
  let width: number
  let height: number

  if (storedLabels && imageWidth && imageHeight && !isFlipped) {
    labels = storedLabels
    width = imageWidth
    height = imageHeight
  } else {
    // Recompute labels from source image
    const img = await loadImageData(source)
    width = img.width
    height = img.height
    const totalPixels = width * height
    labels = new Uint8Array(totalPixels)

    for (let i = 0; i < totalPixels; i++) {
      const offset = i * 4
      const pr = img.data[offset]!
      const pg = img.data[offset + 1]!
      const pb = img.data[offset + 2]!

      let bestIdx = 0
      let bestD = Infinity
      for (let c = 0; c < palette.length; c++) {
        const cr = palette[c]![0]!
        const cg = palette[c]![1]!
        const cb = palette[c]![2]!
        const dr = pr - cr
        const dg = pg - cg
        const db = pb - cb
        const d = dr * dr + dg * dg + db * db
        if (d < bestD) {
          bestD = d
          bestIdx = c
        }
      }
      labels[i] = bestIdx
    }
  }

  // Find white (lightest) color — always last
  const whiteIdx = palette.reduce((best, color, i) =>
    luminance(color[0]!, color[1]!, color[2]!) > luminance(palette[best]![0]!, palette[best]![1]!, palette[best]![2]!)
      ? i : best
  , 0)

  if (!order) {
    // Sort by luminance: darkest first, lightest last
    const indexed = palette.map((color, i) => ({ i, lum: luminance(color[0]!, color[1]!, color[2]!) }))
    indexed.sort((a, b) => a.lum - b.lum)
    order = indexed.map(x => x.i)
  } else if (order[order.length - 1] !== whiteIdx) {
    // Ensure white is always last
    order = [...order.filter(i => i !== whiteIdx), whiteIdx]
  }

  const sortedPalette = order.map(i => palette[i]!)

  // Render each layer
  const layers: Blob[] = []
  for (let layerIdx = 0; layerIdx < sortedPalette.length; layerIdx++) {
    const blob = await renderLayer(labels, order, layerIdx, sortedPalette[layerIdx]!, width, height)
    layers.push(blob)
  }

  return { layers, order }
}
