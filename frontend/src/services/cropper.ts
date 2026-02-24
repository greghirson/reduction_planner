export function cropImage(
  source: Blob,
  x: number,
  y: number,
  width: number,
  height: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, x, y, width, height, 0, 0, width, height)
      canvas.toBlob((blob) => {
        URL.revokeObjectURL(img.src)
        if (blob) resolve(blob)
        else reject(new Error('Failed to export cropped image'))
      }, 'image/png')
    }
    img.onerror = () => {
      URL.revokeObjectURL(img.src)
      reject(new Error('Failed to load image for cropping'))
    }
    img.src = URL.createObjectURL(source)
  })
}
