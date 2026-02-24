export function flipImage(
  source: Blob,
  horizontal: boolean,
  vertical: boolean,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      const ctx = canvas.getContext('2d')!

      ctx.save()
      ctx.translate(
        horizontal ? canvas.width : 0,
        vertical ? canvas.height : 0,
      )
      ctx.scale(horizontal ? -1 : 1, vertical ? -1 : 1)
      ctx.drawImage(img, 0, 0)
      ctx.restore()

      canvas.toBlob((blob) => {
        URL.revokeObjectURL(img.src)
        if (blob) resolve(blob)
        else reject(new Error('Failed to export flipped image'))
      }, 'image/png')
    }
    img.onerror = () => {
      URL.revokeObjectURL(img.src)
      reject(new Error('Failed to load image for flipping'))
    }
    img.src = URL.createObjectURL(source)
  })
}
