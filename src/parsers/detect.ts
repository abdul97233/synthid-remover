import type { MediaFormat, MediaKind } from '../types'
import { matchesAscii } from './bytes'
import { FORMAT_MIME, kindOfExtension } from '../lib/constants'

export class UnsupportedFormatError extends Error {
  constructor(name: string) {
    super(
      `Unsupported or unrecognized file format (${name || 'no extension'}). Supported: JPG, PNG, WebP, MP3, WAV, MP4, MOV.`,
    )
    this.name = 'UnsupportedFormatError'
  }
}

/** Detect the real container format from magic bytes (never trust the extension). */
export function detectFormat(bytes: Uint8Array, name = ''): { format: MediaFormat; mime: string; kind: MediaKind } {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { format: 'jpeg', mime: FORMAT_MIME.jpeg, kind: 'image' }
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    matchesAscii(bytes, 1, 'PNG') &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return { format: 'png', mime: FORMAT_MIME.png, kind: 'image' }
  }
  if (bytes.length >= 12 && matchesAscii(bytes, 0, 'RIFF') && matchesAscii(bytes, 8, 'WEBP')) {
    return { format: 'webp', mime: FORMAT_MIME.webp, kind: 'image' }
  }
  if (bytes.length >= 12 && matchesAscii(bytes, 0, 'RIFF') && matchesAscii(bytes, 8, 'WAVE')) {
    return { format: 'wav', mime: FORMAT_MIME.wav, kind: 'audio' }
  }
  if (bytes.length >= 3 && matchesAscii(bytes, 0, 'ID3')) {
    return { format: 'mp3', mime: FORMAT_MIME.mp3, kind: 'audio' }
  }
  if (
    bytes.length >= 4 &&
    bytes[0] === 0xff &&
    (bytes[1] & 0xe0) === 0xe0 &&
    ((bytes[1] >> 3) & 0x03) !== 0x01 && // MPEG version not reserved
    ((bytes[1] >> 1) & 0x03) !== 0x00 && // layer not reserved (also rules out AAC ADTS)
    (bytes[2] >> 4) !== 0x0f && // bitrate index valid
    ((bytes[2] >> 2) & 0x03) !== 0x03 // sample-rate index valid
  ) {
    // Raw MPEG audio frame sync without an ID3 tag.
    return { format: 'mp3', mime: FORMAT_MIME.mp3, kind: 'audio' }
  }
  if (bytes.length >= 12 && matchesAscii(bytes, 4, 'ftyp')) {
    const brand = matchesAscii(bytes, 8, 'qt  ') || matchesAscii(bytes, 8, 'qt')
      ? 'mov'
      : 'mp4'
    return { format: brand as MediaFormat, mime: FORMAT_MIME[brand as 'mp4' | 'mov'], kind: 'video' }
  }

  if (bytes.length >= 16) {
    // Legacy QuickTime files may start directly with a moov/mdat/wide/free box (no ftyp).
    const size = ((bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3]) >>> 0
    const sizeOk = size === 0 || size === 1 || (size >= 8 && size <= bytes.length)
    if (sizeOk && ['moov', 'mdat', 'wide', 'free', 'skip', 'pnot'].some((t) => matchesAscii(bytes, 4, t))) {
      return { format: 'mov', mime: FORMAT_MIME.mov, kind: 'video' }
    }
  }

  // Unknown bytes: fall back to the extension only for probably-valid intent,
  // but still refuse — we never parse files we cannot positively identify.
  void kindOfExtension(name)
  throw new UnsupportedFormatError(name)
}
