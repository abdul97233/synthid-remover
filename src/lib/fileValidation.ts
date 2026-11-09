import { formatBytes } from './format'
import { FORMAT_MIME, MAX_FILE_SIZE, extensionOf, isSupportedExtension } from './constants'

export interface Rejection {
  name: string
  reason: string
}

const SUPPORTED_MIMES = new Set<string>([...Object.values(FORMAT_MIME), 'audio/mp3', 'audio/x-wav', 'audio/wave', 'audio/vnd.wave', 'image/jpg'])

/**
 * Accept by extension, or by MIME type for extension-less files (e.g. pasted
 * images). The worker still verifies the real format from the magic bytes.
 */
export function partitionFiles(files: File[]): { accepted: File[]; rejected: Rejection[] } {
  const accepted: File[] = []
  const rejected: Rejection[] = []
  for (const file of files) {
    const ext = extensionOf(file.name)
    const byMime = !ext && SUPPORTED_MIMES.has(file.type.toLowerCase())
    if (!isSupportedExtension(file.name) && !byMime) {
      rejected.push({
        name: file.name || 'Unnamed file',
        reason: `Unsupported format (.${ext || 'none'}). Supported: JPG, PNG, WebP, MP3, WAV, MP4, MOV.`,
      })
      continue
    }
    if (file.size === 0) {
      rejected.push({ name: file.name || 'Unnamed file', reason: 'The file is empty (0 bytes).' })
      continue
    }
    if (file.size > MAX_FILE_SIZE) {
      rejected.push({
        name: file.name || 'Unnamed file',
        reason: `File is ${formatBytes(file.size)} — the browser limit for local processing is ${formatBytes(MAX_FILE_SIZE)}.`,
      })
      continue
    }
    accepted.push(file)
  }
  return { accepted, rejected }
}
