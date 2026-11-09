import type { MediaInfo, MediaKind, MediaFormat } from '../types'
import { FORMAT_MIME } from './constants'

/**
 * Decode-level probing (dimensions, duration) using the browser's own media
 * stack. Object URLs are revoked immediately after metadata is read.
 */

function withTimeout<T>(promise: Promise<T>, ms: number, label: string, onTimeout?: () => void): Promise<T> {
  let timer: number | undefined
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      timer = window.setTimeout(() => {
        onTimeout?.()
        reject(new Error(`${label} timed out`))
      }, ms)
    }),
  ]).finally(() => window.clearTimeout(timer))
}

function probeImage(file: File): Promise<{ width?: number; height?: number }> {
  const url = URL.createObjectURL(file)
  const img = new Image()
  return withTimeout(
    new Promise((resolve, reject) => {
      img.onload = () => {
        resolve({ width: img.naturalWidth, height: img.naturalHeight })
        URL.revokeObjectURL(url)
      }
      img.onerror = () => {
        reject(new Error('Could not decode image'))
        URL.revokeObjectURL(url)
      }
      img.src = url
    }),
    15000,
    'Image decoding',
    () => {
      img.src = ''
      URL.revokeObjectURL(url)
    },
  )
}

function probeDurationElement(
  file: File,
  element: 'video' | 'audio',
): Promise<{ duration?: number; width?: number; height?: number }> {
  const url = URL.createObjectURL(file)
  const el = document.createElement(element)
  const release = () => {
    el.onloadedmetadata = null
    el.onerror = null
    URL.revokeObjectURL(url)
    el.removeAttribute('src') // release decoder resources promptly
    el.load()
  }
  return withTimeout(
    new Promise((resolve, reject) => {
      el.preload = 'metadata'
      el.onloadedmetadata = () => {
        const video = el as HTMLVideoElement
        resolve({
          duration: Number.isFinite(el.duration) ? el.duration : undefined,
          width: element === 'video' ? video.videoWidth || undefined : undefined,
          height: element === 'video' ? video.videoHeight || undefined : undefined,
        })
        release()
      }
      el.onerror = () => {
        reject(new Error('Could not read media metadata'))
        release()
      }
      el.src = url
    }),
    20000,
    'Media metadata read',
    release,
  )
}

export interface ProbeResult {
  width?: number
  height?: number
  duration?: number
  decodeError?: string
}

export async function probeMedia(file: File, kind: MediaKind): Promise<ProbeResult> {
  try {
    if (kind === 'image') {
      const { width, height } = await probeImage(file)
      return { width, height }
    }
    if (kind === 'document') return {}
    if (kind === 'video') return await probeDurationElement(file, 'video')
    return await probeDurationElement(file, 'audio')
  } catch (e) {
    return { decodeError: e instanceof Error ? e.message : 'Unknown decode problem' }
  }
}

export function buildMediaInfo(
  file: File,
  kind: MediaKind,
  format: MediaFormat,
  mime: string,
  probe?: ProbeResult,
): MediaInfo {
  return {
    name: file.name,
    size: file.size,
    type: file.type || mime,
    lastModified: new Date(file.lastModified).toISOString(),
    kind,
    format,
    // Prefer the MIME of the detected format; file.type only reflects the extension.
    mime: mime || file.type || FORMAT_MIME.jpeg,
    width: probe?.width,
    height: probe?.height,
    duration: probe?.duration,
  }
}
