import type { RemovedItem, StructureEntry } from '../types'
import { concatParts, writeUint32LE, readAscii } from './bytes'

/**
 * WebP = RIFF file ("RIFF" + size + "WEBP" + chunks).
 * Metadata lives in EXIF / XMP chunks (top-level or nested inside ANMF frames),
 * and C2PA manifests in a "C2PA" chunk. Only chunks needed to decode the
 * image are kept; odd-length payloads are re-padded on rebuild.
 */

const KEEP = new Set(['VP8 ', 'VP8L', 'VP8X', 'ANIM', 'ANMF', 'ICCP', 'ALPH'])
/** Chunks allowed inside an ANMF frame payload. */
const FRAME_KEEP = new Set(['VP8 ', 'VP8L', 'ALPH'])
const METADATA = new Set(['EXIF', 'XMP ', 'C2PA'])

/** VP8X flag bits that announce metadata chunks. */
const VP8X_EXIF_FLAG = 0x08
const VP8X_XMP_FLAG = 0x04

interface RiffChunk {
  fourcc: string
  start: number
  dataStart: number
  dataEnd: number // includes padding byte if the payload is odd-sized
  payloadEnd: number // without padding
}

function parseRiffChunks(bytes: Uint8Array, start: number, end: number): RiffChunk[] {
  const chunks: RiffChunk[] = []
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let pos = start
  while (pos + 8 <= end) {
    const fourcc = readAscii(bytes, pos, 4)
    if (!/^[\x20-\x7e]{4}$/.test(fourcc)) throw new Error('Corrupted RIFF structure')
    const size = dv.getUint32(pos + 4, true)
    if (pos + 8 + size > end) throw new Error('Corrupted RIFF structure (chunk overruns container)')
    const payloadEnd = pos + 8 + size
    const padded = size % 2 === 1 ? payloadEnd + 1 : payloadEnd
    chunks.push({ fourcc, start: pos, dataStart: pos + 8, dataEnd: Math.min(padded, end), payloadEnd })
    pos = padded
  }
  return chunks
}

/** End of the RIFF payload declared by the header, clamped to the file. */
function riffEnd(bytes: Uint8Array): number {
  if (bytes.length < 12) throw new Error('Truncated WebP file')
  const declared = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(4, true) + 8
  return Math.min(declared, bytes.length)
}

function buildRiffChunks(chunks: Array<{ fourcc: string; data: Uint8Array }>): Uint8Array {
  const parts: Uint8Array[] = []
  for (const c of chunks) {
    const header = new Uint8Array(8)
    for (let i = 0; i < 4; i++) header[i] = c.fourcc.charCodeAt(i)
    writeUint32LE(header, 4, c.data.length)
    parts.push(header, c.data)
    if (c.data.length % 2 === 1) parts.push(new Uint8Array(1))
  }
  return concatParts(parts)
}

function chunkLabel(fourcc: string): string {
  if (fourcc === 'C2PA') return 'C2PA chunk (Content Credentials)'
  if (METADATA.has(fourcc)) return `${fourcc.trim()} chunk (metadata)`
  return `${fourcc.trim()} chunk (unknown / non-image data)`
}

function stripChunkList(
  bytes: Uint8Array,
  start: number,
  end: number,
  removed: RemovedItem[],
  keep: Set<string>,
): Uint8Array {
  const kept: Array<{ fourcc: string; data: Uint8Array }> = []
  for (const c of parseRiffChunks(bytes, start, end)) {
    if (!keep.has(c.fourcc)) {
      removed.push({ label: chunkLabel(c.fourcc), size: c.dataEnd - c.start })
      continue
    }
    if (c.fourcc === 'ANMF') {
      // Animated WebP frames may carry nested chunks after the 16-byte frame header.
      if (c.payloadEnd - c.dataStart < 16) throw new Error('Corrupted WebP animation frame')
      const frameHeader = bytes.subarray(c.dataStart, c.dataStart + 16)
      const inner = stripChunkList(bytes, c.dataStart + 16, c.payloadEnd, removed, FRAME_KEEP)
      kept.push({ fourcc: 'ANMF', data: concatParts([frameHeader, inner]) })
      continue
    }
    if (c.fourcc === 'VP8X' && c.payloadEnd - c.dataStart >= 1) {
      // Clear the "has EXIF" / "has XMP" flags — those chunks no longer exist.
      const data = new Uint8Array(bytes.subarray(c.dataStart, c.payloadEnd)) // copy; never mutate the input
      data[0] &= ~(VP8X_EXIF_FLAG | VP8X_XMP_FLAG)
      kept.push({ fourcc: c.fourcc, data })
      continue
    }
    kept.push({ fourcc: c.fourcc, data: bytes.subarray(c.dataStart, c.payloadEnd) })
  }
  return buildRiffChunks(kept)
}

export function fixRiffSize(out: Uint8Array): void {
  writeUint32LE(out, 4, out.length - 8)
}

export function inspectWebp(bytes: Uint8Array): { entries: StructureEntry[]; notes: string[] } {
  const notes: string[] = []
  const end = riffEnd(bytes)
  const chunks = parseRiffChunks(bytes, 12, end)
  const names: Record<string, string> = {
    VP8X: 'Extended format header',
    'VP8 ': 'Lossy image data',
    VP8L: 'Lossless image data',
    ANIM: 'Animation header',
    ANMF: 'Animation frame',
    ICCP: 'ICC color profile',
    EXIF: 'EXIF metadata',
    'XMP ': 'XMP metadata',
    C2PA: 'C2PA / Content Credentials manifest',
    ALPH: 'Alpha transparency data',
  }
  const entries: StructureEntry[] = [
    { name: 'RIFF header (WEBP)', offset: 0, size: 12, removable: false },
    ...chunks.map((c) => ({
      name: `${c.fourcc.trim()} chunk`,
      description: names[c.fourcc],
      offset: c.start,
      size: c.dataEnd - c.start,
      removable: !KEEP.has(c.fourcc),
    })),
  ]
  if (end < bytes.length) {
    entries.push({ name: 'Data after RIFF end', offset: end, size: bytes.length - end, removable: true })
    notes.push('Extra bytes found after the end of the RIFF container — removed when cleaning.')
  }
  if (chunks.some((c) => c.fourcc === 'ANMF')) notes.push('Animated WebP detected — nested EXIF/XMP inside frames is also stripped when cleaning.')
  return { entries, notes }
}

export function stripWebp(bytes: Uint8Array): { out: Uint8Array; removed: RemovedItem[]; notes: string[] } {
  const removed: RemovedItem[] = []
  const end = riffEnd(bytes)
  const inner = stripChunkList(bytes, 12, end, removed, KEEP)
  if (end < bytes.length) removed.push({ label: 'Trailing bytes after RIFF end', size: bytes.length - end })
  const header = new Uint8Array(12)
  header.set([0x52, 0x49, 0x46, 0x46]) // RIFF
  header.set([0x57, 0x45, 0x42, 0x50], 8) // WEBP
  const out = concatParts([header, inner])
  fixRiffSize(out)
  const notes: string[] = []
  if (removed.length === 0) {
    notes.push('No removable metadata chunks found — the cleaned copy is identical to the original.')
  } else {
    notes.push('Metadata chunks removed. Pixel data is untouched (lossless operation).')
  }
  return { out, removed, notes }
}
