declare module 'gifenc' {
  type RGBA = [number, number, number, number]

  interface GIFEncoderInstance {
    writeFrame(
      index: Uint8Array,
      width: number,
      height: number,
      opts?: {
        palette?: RGBA[]
        delay?: number
        transparent?: boolean
        transparentIndex?: number
        dispose?: number
        repeat?: number
        colorDepth?: number
        first?: boolean
      },
    ): void
    finish(): void
    bytes(): Uint8Array
    bytesView(): Uint8Array
    reset(): void
    readonly buffer: ArrayBuffer
  }

  export function GIFEncoder(opts?: {
    initialCapacity?: number
    auto?: boolean
  }): GIFEncoderInstance

  export function quantize(
    rgba: Uint8Array | Uint8ClampedArray,
    maxColors: number,
    opts?: { format?: string; oneBitAlpha?: boolean | number },
  ): RGBA[]

  export function applyPalette(
    rgba: Uint8Array | Uint8ClampedArray,
    palette: RGBA[],
    format?: string,
  ): Uint8Array
}
