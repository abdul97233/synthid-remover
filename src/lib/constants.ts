import type { MediaFormat, MediaKind } from '../types'

export const APP_NAME = 'SynthID Remover'
/** Set automatically by the GitHub Pages workflow (VITE_REPO_URL); placeholder otherwise. */
export const GITHUB_URL: string =
  import.meta.env.VITE_REPO_URL || 'https://github.com/abdul97233/synthid-remover'

/**
 * Official third-party verification tools. These are plain outbound links that
 * open in a new tab. This application never sends any user file anywhere.
 */
export const SYNTHID_DETECTOR_URL = 'https://synthid.google/'
export const C2PA_VERIFY_URL = 'https://contentcredentials.org/verify'

export const MAX_FILE_SIZE = 500 * 1024 * 1024 // 500 MB per file, browser-memory bound

export const PRIVACY_STATEMENT =
  'Your files never leave your device. All processing happens locally in your browser. No uploads, no tracking, no storage.'

export const SUPPORTED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'mp3', 'wav', 'mp4', 'mov'] as const

export const ACCEPT_ATTR = '.jpg,.jpeg,.png,.webp,.mp3,.wav,.mp4,.mov,image/*,audio/*,video/*'

export const FORMAT_MIME: Record<Exclude<MediaFormat, 'unknown'>, string> = {
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  mp4: 'video/mp4',
  mov: 'video/quicktime',
}

export const FORMAT_LABEL: Record<MediaFormat, string> = {
  jpeg: 'JPEG',
  png: 'PNG',
  webp: 'WebP',
  mp3: 'MP3',
  wav: 'WAV',
  mp4: 'MP4',
  mov: 'QuickTime MOV',
  unknown: 'Unknown',
}

export const EXT_BY_FORMAT: Record<Exclude<MediaFormat, 'unknown'>, string> = {
  jpeg: 'jpg',
  png: 'png',
  webp: 'webp',
  mp3: 'mp3',
  wav: 'wav',
  mp4: 'mp4',
  mov: 'mov',
}

export function extensionOf(name: string): string {
  const i = name.lastIndexOf('.')
  return i === -1 ? '' : name.slice(i + 1).toLowerCase()
}

export function isSupportedExtension(name: string): boolean {
  return (SUPPORTED_EXTENSIONS as readonly string[]).includes(extensionOf(name))
}

export function kindOfExtension(name: string): MediaKind | null {
  const ext = extensionOf(name)
  if (['jpg', 'jpeg', 'png', 'webp'].includes(ext)) return 'image'
  if (['mp3', 'wav'].includes(ext)) return 'audio'
  if (['mp4', 'mov'].includes(ext)) return 'video'
  return null
}
