/**
 * Canvas fallback re-encode for images whose lossless strip is unsafe
 * (unusual chunk layouts) or whose EXIF orientation needs baking in.
 * This re-compresses pixels — always disclosed to the user as a
 * *lossy* alternative to the lossless strip.
 */

export type CanvasFormat = 'jpeg' | 'png' | 'webp'

export function bakeOrientation(file: File, target: CanvasFormat = 'jpeg'): Promise<Blob> {
  const quality = target === 'jpeg' ? 0.92 : undefined
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      try {
        // Modern browsers apply EXIF orientation when decoding <img>, so the
        // canvas output already has the rotation baked in.
        const canvas = document.createElement('canvas')
        canvas.width = img.naturalWidth
        canvas.height = img.naturalHeight
        const ctx = canvas.getContext('2d')
        if (!ctx) throw new Error('Canvas 2D is unavailable in this browser.')
        ctx.drawImage(img, 0, 0)
        canvas.toBlob(
          (blob) => {
            URL.revokeObjectURL(url)
            if (blob) resolve(blob)
            else reject(new Error(`This browser could not encode a ${target.toUpperCase()} copy.`))
          },
          `image/${target}`,
          quality,
        )
      } catch (e) {
        URL.revokeObjectURL(url)
        reject(e instanceof Error ? e : new Error('Canvas re-encoding failed'))
      }
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Could not decode the image for re-encoding.'))
    }
    img.src = url
  })
}
