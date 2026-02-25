// Web Worker for k-means color quantization
// Receives: { pixels: Uint8ClampedArray, width: number, height: number, colorCount: number }
// Returns:  { palette: number[][], labels: Uint8Array }
// Progress: { progress: number } (0-1)

interface KMeansInput {
  pixels: Uint8ClampedArray
  width: number
  height: number
  colorCount: number
  simplification: number
}

// Flat RGB buffers: pixel i is at offset i*3
// Avoids noUncheckedIndexedAccess issues with nested arrays

function distSqFlat(data: Float64Array, i: number, centroids: Float64Array, c: number): number {
  const di = i * 3
  const dc = c * 3
  const dr = data[di]! - centroids[dc]!
  const dg = data[di + 1]! - centroids[dc + 1]!
  const db = data[di + 2]! - centroids[dc + 2]!
  return dr * dr + dg * dg + db * db
}

function kmeans(
  data: Float64Array,   // flat RGB, length = n * 3
  n: number,
  k: number,
  maxIter: number,
  batchSize: number,
): Float64Array {
  const centroids = new Float64Array(k * 3)

  // k-means++ init: first centroid random
  const first = Math.floor(Math.random() * n) * 3
  centroids[0] = data[first]!
  centroids[1] = data[first + 1]!
  centroids[2] = data[first + 2]!

  const dists = new Float64Array(n)

  for (let c = 1; c < k; c++) {
    let totalDist = 0
    for (let i = 0; i < n; i++) {
      let minD = Infinity
      for (let j = 0; j < c; j++) {
        const d = distSqFlat(data, i, centroids, j)
        if (d < minD) minD = d
      }
      dists[i] = minD
      totalDist += minD
    }

    let r = Math.random() * totalDist
    let picked = false
    for (let i = 0; i < n; i++) {
      r -= dists[i]!
      if (r <= 0) {
        const si = i * 3
        const ci = c * 3
        centroids[ci] = data[si]!
        centroids[ci + 1] = data[si + 1]!
        centroids[ci + 2] = data[si + 2]!
        picked = true
        break
      }
    }
    if (!picked) {
      const ri = Math.floor(Math.random() * n) * 3
      const ci = c * 3
      centroids[ci] = data[ri]!
      centroids[ci + 1] = data[ri + 1]!
      centroids[ci + 2] = data[ri + 2]!
    }
  }

  // Mini-batch k-means iterations
  const sums = new Float64Array(k * 3)
  const counts = new Int32Array(k)

  for (let iter = 0; iter < maxIter; iter++) {
    sums.fill(0)
    counts.fill(0)

    const actualBatch = Math.min(batchSize, n)
    for (let b = 0; b < actualBatch; b++) {
      const idx = Math.floor(Math.random() * n)

      let bestC = 0
      let bestD = Infinity
      for (let c = 0; c < k; c++) {
        const d = distSqFlat(data, idx, centroids, c)
        if (d < bestD) {
          bestD = d
          bestC = c
        }
      }

      const si = idx * 3
      const sc = bestC * 3
      sums[sc] = sums[sc]! + data[si]!
      sums[sc + 1] = sums[sc + 1]! + data[si + 1]!
      sums[sc + 2] = sums[sc + 2]! + data[si + 2]!
      counts[bestC] = counts[bestC]! + 1
    }

    for (let c = 0; c < k; c++) {
      const cnt = counts[c]!
      if (cnt > 0) {
        const ci = c * 3
        centroids[ci] = sums[ci]! / cnt
        centroids[ci + 1] = sums[ci + 1]! / cnt
        centroids[ci + 2] = sums[ci + 2]! / cnt
      }
    }

    if (iter % 5 === 0) {
      self.postMessage({ progress: iter / maxIter })
    }
  }

  return centroids
}

function modeFilter(labels: Uint8Array, width: number, height: number, radius: number): void {
  if (radius <= 0) return
  const copy = new Uint8Array(labels)
  const counts = new Uint32Array(256)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      counts.fill(0)
      const x0 = Math.max(0, x - radius)
      const x1 = Math.min(width - 1, x + radius)
      const y0 = Math.max(0, y - radius)
      const y1 = Math.min(height - 1, y + radius)
      for (let ny = y0; ny <= y1; ny++) {
        for (let nx = x0; nx <= x1; nx++) {
          const lbl = copy[ny * width + nx]!
          counts[lbl] = counts[lbl]! + 1
        }
      }
      const current = copy[y * width + x]!
      let bestLabel = current
      let bestCount = counts[current]!
      for (let lbl = 0; lbl < 256; lbl++) {
        if (counts[lbl]! > bestCount) {
          bestCount = counts[lbl]!
          bestLabel = lbl
        }
      }
      labels[y * width + x] = bestLabel
    }
  }
}

function mergeSmallRegions(labels: Uint8Array, width: number, height: number, minSize: number): void {
  if (minSize <= 1) return
  const totalPixels = width * height

  // Pass 1: BFS flood-fill to assign component IDs.
  // The queue stores ALL pixel indices; each component occupies a contiguous slice.
  const componentId = new Int32Array(totalPixels).fill(-1)
  const queue = new Uint32Array(totalPixels)
  let queueEnd = 0
  let numComponents = 0
  const componentStart: number[] = []
  const componentLabel: number[] = []

  for (let i = 0; i < totalPixels; i++) {
    if (componentId[i] !== -1) continue
    const label = labels[i]!
    const id = numComponents++
    componentLabel.push(label)
    componentStart.push(queueEnd)
    let head = queueEnd
    queue[queueEnd++] = i
    componentId[i] = id
    while (head < queueEnd) {
      const px = queue[head++]!
      const x = px % width
      const y = (px - x) / width
      if (y > 0 && componentId[px - width] === -1 && labels[px - width] === label) {
        componentId[px - width] = id
        queue[queueEnd++] = px - width
      }
      if (y < height - 1 && componentId[px + width] === -1 && labels[px + width] === label) {
        componentId[px + width] = id
        queue[queueEnd++] = px + width
      }
      if (x > 0 && componentId[px - 1] === -1 && labels[px - 1] === label) {
        componentId[px - 1] = id
        queue[queueEnd++] = px - 1
      }
      if (x < width - 1 && componentId[px + 1] === -1 && labels[px + 1] === label) {
        componentId[px + 1] = id
        queue[queueEnd++] = px + 1
      }
    }
  }
  // Sentinel so last component's size can be computed as start[c+1] - start[c]
  componentStart.push(queueEnd)

  // Pass 2: For each small component, iterate its pixels from the queue
  // and find the most common neighboring label
  const neighborCounts = new Uint32Array(256)
  for (let c = 0; c < numComponents; c++) {
    const size = componentStart[c + 1]! - componentStart[c]!
    if (size >= minSize) continue

    neighborCounts.fill(0)
    for (let q = componentStart[c]!; q < componentStart[c + 1]!; q++) {
      const px = queue[q]!
      const x = px % width
      const y = (px - x) / width
      if (y > 0 && componentId[px - width] !== c) { const l = labels[px - width]!; neighborCounts[l] = neighborCounts[l]! + 1 }
      if (y < height - 1 && componentId[px + width] !== c) { const l = labels[px + width]!; neighborCounts[l] = neighborCounts[l]! + 1 }
      if (x > 0 && componentId[px - 1] !== c) { const l = labels[px - 1]!; neighborCounts[l] = neighborCounts[l]! + 1 }
      if (x < width - 1 && componentId[px + 1] !== c) { const l = labels[px + 1]!; neighborCounts[l] = neighborCounts[l]! + 1 }
    }

    let bestLabel = componentLabel[c]!
    let bestCount = 0
    for (let lbl = 0; lbl < 256; lbl++) {
      if (neighborCounts[lbl]! > bestCount) {
        bestCount = neighborCounts[lbl]!
        bestLabel = lbl
      }
    }
    if (bestCount === 0) continue

    // Relabel this component's pixels
    for (let q = componentStart[c]!; q < componentStart[c + 1]!; q++) {
      labels[queue[q]!] = bestLabel
    }
  }
}

self.onmessage = (e: MessageEvent<KMeansInput>) => {
  const { pixels, width, height, colorCount, simplification } = e.data
  const totalPixels = width * height

  // Extract RGB into flat Float64Array (skip alpha)
  const rgbData = new Float64Array(totalPixels * 3)
  for (let i = 0; i < totalPixels; i++) {
    const pi = i * 4
    const ri = i * 3
    rgbData[ri] = pixels[pi]!
    rgbData[ri + 1] = pixels[pi + 1]!
    rgbData[ri + 2] = pixels[pi + 2]!
  }

  self.postMessage({ progress: 0 })

  // Cluster into N-1 colors, then add white as fixed base
  const nClusters = Math.max(colorCount - 1, 1)

  // Downsample for clustering if image is large
  const maxSample = 50000
  let sampleData = rgbData
  let sampleN = totalPixels
  if (totalPixels > maxSample) {
    sampleData = new Float64Array(maxSample * 3)
    sampleN = maxSample
    for (let i = 0; i < maxSample; i++) {
      const src = Math.floor(Math.random() * totalPixels) * 3
      const dst = i * 3
      sampleData[dst] = rgbData[src]!
      sampleData[dst + 1] = rgbData[src + 1]!
      sampleData[dst + 2] = rgbData[src + 2]!
    }
  }

  const centroids = kmeans(sampleData, sampleN, nClusters, 30, Math.min(10000, sampleN))

  // Build full palette: clusters + white [255, 255, 255]
  const paletteSize = nClusters + 1
  const paletteBuf = new Float64Array(paletteSize * 3)
  paletteBuf.set(centroids)
  paletteBuf[nClusters * 3] = 255
  paletteBuf[nClusters * 3 + 1] = 255
  paletteBuf[nClusters * 3 + 2] = 255

  self.postMessage({ progress: 0.8 })

  // Assign every pixel to nearest palette color
  const labels = new Uint8Array(totalPixels)
  for (let i = 0; i < totalPixels; i++) {
    const ri = i * 3
    let bestIdx = 0
    let bestD = Infinity
    for (let c = 0; c < paletteSize; c++) {
      const ci = c * 3
      const dr = rgbData[ri]! - paletteBuf[ci]!
      const dg = rgbData[ri + 1]! - paletteBuf[ci + 1]!
      const db = rgbData[ri + 2]! - paletteBuf[ci + 2]!
      const d = dr * dr + dg * dg + db * db
      if (d < bestD) {
        bestD = d
        bestIdx = c
      }
    }
    labels[i] = bestIdx
  }

  // Post-processing: spatial cleanup controlled by simplification (0-100)
  if (simplification > 0) {
    // Mode filter: radius 0-4 based on simplification
    const radius = Math.round(simplification / 25)
    modeFilter(labels, width, height, radius)
    self.postMessage({ progress: 0.85 })

    // Connected component merge: minSize scales to ~0.5% of total pixels at 100
    const minSize = Math.round((simplification / 100) * 0.005 * totalPixels)
    mergeSmallRegions(labels, width, height, minSize)
    self.postMessage({ progress: 0.95 })
  }

  // Convert flat palette buffer to number[][] for output
  const palette: number[][] = []
  for (let c = 0; c < paletteSize; c++) {
    const ci = c * 3
    palette.push([
      Math.round(paletteBuf[ci]!),
      Math.round(paletteBuf[ci + 1]!),
      Math.round(paletteBuf[ci + 2]!),
    ])
  }

  self.postMessage({ progress: 1 })
  self.postMessage({ palette, labels })
}
