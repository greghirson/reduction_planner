// Web Worker for k-means color quantization
// Receives: { pixels: Uint8ClampedArray, width: number, height: number, colorCount: number }
// Returns:  { palette: number[][], labels: Uint8Array }
// Progress: { progress: number } (0-1)

interface KMeansInput {
  pixels: Uint8ClampedArray
  width: number
  height: number
  colorCount: number
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

self.onmessage = (e: MessageEvent<KMeansInput>) => {
  const { pixels, width, height, colorCount } = e.data
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
