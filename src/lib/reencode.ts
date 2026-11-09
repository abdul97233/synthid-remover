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

/**
 * Re-frame an image to an exact output size (centre crop, cover) and encode
 * it as JPEG. Decodes the original file so EXIF orientation is applied.
 */
export async function renderFrame(file: Blob, width: number, height: number, quality: number): Promise<Blob> {
  let source: ImageBitmap | HTMLImageElement
  let sw: number
  let sh: number
  let url: string | null = null
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' })
    source = bmp
    sw = bmp.width
    sh = bmp.height
  } catch {
    url = URL.createObjectURL(file)
    const img = new Image()
    await new Promise<void>((res, rej) => {
      img.onload = () => res()
      img.onerror = () => rej(new Error('Could not decode the image.'))
      img.src = url!
    })
    source = img
    sw = img.naturalWidth
    sh = img.naturalHeight
  }
  try {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas 2D is unavailable in this browser.')
    // Cover: scale to fill, then crop the centre.
    const scale = Math.max(width / sw, height / sh)
    const cw = width / scale
    const ch = height / scale
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(source, (sw - cw) / 2, (sh - ch) / 2, cw, ch, 0, 0, width, height)
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', quality))
    if (!blob) throw new Error('This browser could not encode a JPEG.')
    return blob
  } finally {
    if ('close' in source) source.close()
    if (url) URL.revokeObjectURL(url)
  }
}
