import type { RemovedItem, StructureEntry } from '../types'
import { concatParts, readAscii, isPrintableText } from './bytes'

/** PNG chunk splitter — chunk type + CRC copied verbatim, so kept chunks stay valid. */

const SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]

/** Chunks preserved when cleaning. Includes APNG + HDR-relevant chunks. */
const KEEP_CHUNKS = new Set([
  'IHDR', 'PLTE', 'IDAT', 'IEND',
  'tRNS', 'gAMA', 'cHRM', 'sRGB', 'iCCP', 'bKGD', 'sBIT', 'pHYs',
  'cICP', 'mDCv', 'cLLi',
  'acTL', 'fcTL', 'fdAT',
])

const CHUNK_LABELS: Record<string, string> = {
  tEXt: 'Text metadata (uncompressed)',
  zTXt: 'Text metadata (compressed)',
  iTXt: 'International text metadata',
  eXIf: 'EXIF metadata',
  caBX: 'C2PA / Content Credentials manifest',
  tIME: 'Timestamp metadata',
  pHYs: 'Physical dimensions',
  iCCP: 'ICC color profile',
  gAMA: 'Gamma',
  sRGB: 'sRGB rendering intent',
  cICP: 'HDR color coding',
  mDCv: 'HDR mastering display',
  cLLi: 'HDR light level',
  acTL: 'APNG animation control',
  fcTL: 'APNG frame control',
  fdAT: 'APNG frame data',
}

interface PngChunk {
  type: string
  start: number
  end: number
  dataStart: number
  dataEnd: number
}

export function parsePngChunks(bytes: Uint8Array, strict = true): { chunks: PngChunk[]; notes: string[] } {
  const notes: string[] = []
  for (let i = 0; i < 8; i++) {
    if (bytes[i] !== SIGNATURE[i]) throw new Error('Not a valid PNG file (bad signature)')
  }
  const chunks: PngChunk[] = []
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let pos = 8
  while (pos + 8 <= bytes.length) {
    const length = dv.getUint32(pos, false)
    const type = readAscii(bytes, pos + 4, 4)
    if (length > 0x7fffffff || pos + 12 + length > bytes.length) {
      if (strict) throw new Error('Corrupted PNG structure (bad chunk length)')
      notes.push('File contains a malformed chunk — structure report may be incomplete.')
      break
    }
    const chunk: PngChunk = {
      type,
      start: pos,
      dataStart: pos + 8,
      dataEnd: pos + 8 + length,
      end: pos + 12 + length,
    }
    chunks.push(chunk)
    pos = chunk.end
    if (type === 'IEND') break
  }
  if (strict && (chunks.length === 0 || chunks[chunks.length - 1].type !== 'IEND')) {
    throw new Error('PNG file is missing its IEND chunk (truncated?)')
  }
  if (pos < bytes.length) notes.push('Extra bytes found after IEND — removed when cleaning.')
  return { chunks, notes }
}

function textChunkDescription(c: PngChunk, bytes: Uint8Array): string | undefined {
  const data = bytes.subarray(c.dataStart, c.dataEnd)
  if (c.type === 'tEXt' || c.type === 'zTXt') {
    const nul = data.indexOf(0)
    if (nul > 0) {
      const keyword = readAscii(data, 0, nul)
      return compressed(c) ? `${keyword} (deflated content)` : `${keyword}: ${readAscii(data, nul + 1, Math.min(64, data.length - nul - 1))}`
    }
  }
  if (c.type === 'iTXt') {
    const nul = data.indexOf(0)
    if (nul > 0) {
      const keyword = readAscii(data, 0, nul)
      const compressedFlag = data[nul + 1]
      return compressedFlag === 1 ? `${keyword} (deflated content)` : textAfterItxt(data, nul)
    }
  }
  return chunkLabelFallback(c)
}

function compressed(c: PngChunk): boolean {
  return c.type === 'zTXt'
}

function textAfterItxt(data: Uint8Array, nul: number): string | undefined {
  // iTXt: keyword\0 compFlag compMethod\0 languageTag\0 translatedKeyword\0 text
  let pos = nul + 3 // skip compression flag + method
  for (let skips = 0; skips < 2; skips++) {
    const nextNul = data.indexOf(0, pos)
    if (nextNul === -1) return undefined
    pos = nextNul + 1
  }
  if (!isPrintableText(data, pos, Math.min(64, data.length - pos))) return 'text content'
  return readAscii(data, pos, Math.min(64, data.length - pos))
}

function chunkLabelFallback(c: PngChunk): string | undefined {
  return CHUNK_LABELS[c.type]
}

export function inspectPng(bytes: Uint8Array): { entries: StructureEntry[]; notes: string[] } {
  const { chunks, notes } = parsePngChunks(bytes)
  const entries: StructureEntry[] = chunks.map((c) => ({
    name: `${c.type} chunk`,
    description: textChunkDescription(c, bytes) ?? chunkLabelFallback(c),
    offset: c.start,
    size: c.end - c.start,
    removable: !KEEP_CHUNKS.has(c.type),
  }))
  return { entries, notes }
}

export function stripPng(bytes: Uint8Array): { out: Uint8Array; removed: RemovedItem[]; notes: string[] } {
  const { chunks, notes } = parsePngChunks(bytes)
  const removed: RemovedItem[] = []
  const parts: Uint8Array[] = [bytes.subarray(0, 8)] // signature

  for (const c of chunks) {
    if (!KEEP_CHUNKS.has(c.type)) {
      removed.push({ label: `${c.type} chunk`, size: c.end - c.start })
      continue
    }
    parts.push(bytes.subarray(c.start, c.end))
  }

  // Strip any trailing garbage after IEND (some tools append plain-text there).
  const lastKeep = chunks.filter((c) => KEEP_CHUNKS.has(c.type)).pop() ?? chunks[chunks.length - 1]
  if (lastKeep.end < bytes.length) {
    removed.push({ label: 'Trailing bytes after IEND', size: bytes.length - lastKeep.end })
  }

  if (removed.length === 0) {
    notes.push('No removable metadata chunks found — the cleaned copy is identical to the original.')
  }
  if (removed.some((r) => r.label.startsWith('eXIf'))) notes.push('PNG eXIf chunk removed.')
  if (removed.some((r) => r.label.startsWith('iTXt') || r.label.startsWith('tEXt') || r.label.startsWith('zTXt'))) {
    notes.push('Embedded text metadata removed. AI tools (e.g. Stable Diffusion) often store prompts here — those were part of the removed text.')
  }
  return { out: concatParts(parts), removed, notes }
}

/**
 * Deflated text payloads (zTXt and compressed iTXt). Their content is not
 * visible to a raw byte scan, so the worker inflates and scans them too.
 */
export function pngCompressedTextPayloads(bytes: Uint8Array): Array<{ keyword: string; data: Uint8Array }> {
  const out: Array<{ keyword: string; data: Uint8Array }> = []
  let chunks: PngChunk[]
  try {
    chunks = parsePngChunks(bytes, false).chunks
  } catch {
    return out
  }
  for (const c of chunks) {
    const data = bytes.subarray(c.dataStart, c.dataEnd)
    const nul = data.indexOf(0)
    if (nul <= 0) continue
    const keyword = readAscii(data, 0, nul)
    if (c.type === 'zTXt') {
      out.push({ keyword, data: data.subarray(nul + 2) })
    } else if (c.type === 'iTXt' && data[nul + 1] === 1) {
      let pos = nul + 3
      let ok = true
      for (let skips = 0; skips < 2; skips++) {
        const next = data.indexOf(0, pos)
        if (next === -1) { ok = false; break }
        pos = next + 1
      }
      if (ok) out.push({ keyword, data: data.subarray(pos) })
    }
  }
  return out
}
