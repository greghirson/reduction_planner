function loadBlobToCanvas(blob: Blob): Promise<{ canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D }> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0)
      URL.revokeObjectURL(img.src)
      resolve({ canvas, ctx })
    }
    img.onerror = () => {
      URL.revokeObjectURL(img.src)
      reject(new Error('Failed to load image'))
    }
    img.src = URL.createObjectURL(blob)
  })
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('Failed to convert canvas to blob'))
    }, 'image/png')
  })
}

function colorDistance(data: Uint8ClampedArray, i: number, r: number, g: number, b: number): number {
  const dr = data[i]! - r
  const dg = data[i + 1]! - g
  const db = data[i + 2]! - b
  return Math.sqrt(dr * dr + dg * dg + db * db)
}

function floodFill(
  imageData: ImageData,
  startX: number,
  startY: number,
  tolerance: number,
  fillColor: [number, number, number],
): void {
  const { width, height, data } = imageData
  const startIdx = (startY * width + startX) * 4
  const seedR = data[startIdx]!
  const seedG = data[startIdx + 1]!
  const seedB = data[startIdx + 2]!

  const visited = new Uint8Array(width * height)
  const queue: number[] = [startX, startY]
  visited[startY * width + startX] = 1

  while (queue.length > 0) {
    const y = queue.pop()!
    const x = queue.pop()!
    const idx = (y * width + x) * 4

    // Fill pixel
    data[idx] = fillColor[0]
    data[idx + 1] = fillColor[1]
    data[idx + 2] = fillColor[2]
    data[idx + 3] = 255

    // Check 4-connected neighbors
    const neighbors: [number, number][] = [
      [x - 1, y],
      [x + 1, y],
      [x, y - 1],
      [x, y + 1],
    ]
    for (const [nx, ny] of neighbors) {
      if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue
      const nPixel = ny * width + nx
      if (visited[nPixel]) continue
      visited[nPixel] = 1
      const nIdx = nPixel * 4
      if (colorDistance(data, nIdx, seedR, seedG, seedB) <= tolerance) {
        queue.push(nx, ny)
      }
    }
  }
}

export async function floodFillToWhite(
  source: Blob,
  x: number,
  y: number,
  tolerance: number,
): Promise<Blob> {
  return floodFillToColor(source, x, y, tolerance, [255, 255, 255])
}

export async function floodFillToColor(
  source: Blob,
  x: number,
  y: number,
  tolerance: number,
  color: [number, number, number],
): Promise<Blob> {
  const { canvas, ctx } = await loadBlobToCanvas(source)
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
  floodFill(imageData, Math.round(x), Math.round(y), tolerance, color)
  ctx.putImageData(imageData, 0, 0)
  return canvasToBlob(canvas)
}
