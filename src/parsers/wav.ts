import type { RemovedItem, StructureEntry } from '../types'
import { concatParts, readAscii, matchesAscii, fixRiffSizeLE } from './bytes'

/**
 * WAV = RIFF container ("RIFF"+size+"WAVE"+chunks) with little-endian sizes.
 * Only audio-essential chunks are kept (fmt / data / fact, cue + adtl lists,
 * sampler loops). LIST(INFO), bext, iXML, axml, ID3, cart, junk/padding and
 * any unknown vendor chunk are removed when cleaning.
 */

interface WavChunk {
  fourcc: string
  start: number
  dataStart: number
  payloadEnd: number
  end: number // includes pad byte (clamped to the container end)
}

/** Chunks needed to play the audio correctly (everything else is removable). */
const KEEP = new Set(['fmt ', 'data', 'fact', 'cue ', 'plst', 'smpl', 'inst', 'wavl', 'slnt'])

export function parseWavChunks(bytes: Uint8Array): { chunks: WavChunk[]; audioEnd: number; riffEnd: number; notes: string[] } {
  if (bytes.length < 12 || !matchesAscii(bytes, 0, 'RIFF') || !matchesAscii(bytes, 8, 'WAVE')) {
    throw new Error('Not a valid WAV file')
  }
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const notes: string[] = []
  // Parse only within the declared RIFF size; bytes after it are not part of the WAV.
  const declared = dv.getUint32(4, true) + 8
  const riffEnd = Math.min(declared, bytes.length)
  const chunks: WavChunk[] = []
  let pos = 12
  let audioEnd = riffEnd
  while (pos + 8 <= riffEnd) {
    const fourcc = readAscii(bytes, pos, 4)
    if (!/^[\x20-\x7e]{4}$/.test(fourcc)) throw new Error('Corrupted WAV structure')
    let size = dv.getUint32(pos + 4, true)
    if (pos + 8 + size > riffEnd) {
      // Truncated recordings / streamed WAVs often have an oversized final data chunk.
      if (fourcc !== 'data') throw new Error('Corrupted WAV structure (chunk overruns file)')
      size = riffEnd - pos - 8
      notes.push('The audio data chunk is longer than the file (truncated recording?) — only the bytes present are used.')
    }
    const payloadEnd = pos + 8 + size
    const end = Math.min(size % 2 === 1 ? payloadEnd + 1 : payloadEnd, riffEnd)
    chunks.push({ fourcc, start: pos, dataStart: pos + 8, payloadEnd, end })
    if (fourcc === 'data') audioEnd = payloadEnd
    pos = size % 2 === 1 ? payloadEnd + 1 : payloadEnd
  }
  if (chunks.length === 0) throw new Error('WAV file has no chunks')
  return { chunks, audioEnd, riffEnd, notes }
}

function listType(bytes: Uint8Array, c: WavChunk): string {
  return c.fourcc === 'LIST' || c.fourcc === 'list' ? readAscii(bytes, c.dataStart, 4) : ''
}

function isRemovable(bytes: Uint8Array, c: WavChunk): boolean {
  if (KEEP.has(c.fourcc)) return false
  // LIST/adtl holds cue-point labels tied to the audio; LIST/INFO is tag metadata.
  if ((c.fourcc === 'LIST' || c.fourcc === 'list') && listType(bytes, c) === 'adtl') return false
  return true
}

export function inspectWav(bytes: Uint8Array): { entries: StructureEntry[]; notes: string[] } {
  const { chunks, riffEnd, notes } = parseWavChunks(bytes)
  const names: Record<string, string> = {
    'fmt ': 'Audio format description',
    data: 'Audio sample data',
    fact: 'Frame counts (compressed formats)',
    'cue ': 'Cue points',
    bext: 'Broadcast extension metadata',
    iXML: 'iXML production metadata',
    axml: 'XML metadata',
    'ID3 ': 'ID3 metadata tag',
    'id3 ': 'ID3 metadata tag',
    _PMX: 'XMP metadata',
    JUNK: 'padding chunk',
    smpl: 'Sampler information',
    LIST: 'List chunk',
  }
  const entries: StructureEntry[] = [{ name: 'RIFF header (WAVE)', offset: 0, size: 12, removable: false }]
  for (const c of chunks) {
    const lt = listType(bytes, c)
    entries.push({
      name: `${c.fourcc.trim()} chunk${lt ? ` (${lt.trim()})` : ''}`,
      description: names[c.fourcc],
      offset: c.start,
      size: c.end - c.start,
      removable: isRemovable(bytes, c),
    })
  }
  if (riffEnd < bytes.length) {
    entries.push({ name: 'Data after RIFF end', offset: riffEnd, size: bytes.length - riffEnd, removable: true })
    notes.push('Extra bytes found after the end of the RIFF container — removed when cleaning.')
  }
  const infoChunks = chunks.filter((c) => listType(bytes, c) === 'INFO')
  if (infoChunks.length > 0) notes.push('LIST/INFO metadata will be removed when cleaning (title, artist, comments…).')
  return { entries, notes }
}

export function stripWav(bytes: Uint8Array): { out: Uint8Array; removed: RemovedItem[]; notes: string[] } {
  const removed: RemovedItem[] = []
  const { chunks, riffEnd, notes: parseNotes } = parseWavChunks(bytes)
  if (!chunks.some((c) => c.fourcc === 'fmt ') || !chunks.some((c) => c.fourcc === 'data')) {
    throw new Error('WAV file is missing its fmt or data chunk — refusing to produce an unplayable copy.')
  }
  const parts: Uint8Array[] = [bytes.subarray(0, 12)]

  for (const c of chunks) {
    const lt = listType(bytes, c)
    if (isRemovable(bytes, c)) {
      removed.push({ label: `${c.fourcc.trim()} chunk${lt ? ` (${lt.trim()})` : ''}`, size: c.end - c.start })
      continue
    }
    const declaredSize = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(c.start + 4, true)
    if (c.payloadEnd - c.dataStart !== declaredSize) {
      // Rewrite the size of a truncated data chunk so the output is self-consistent.
      const header = new Uint8Array(bytes.subarray(c.start, c.dataStart)) // copy
      new DataView(header.buffer, header.byteOffset, header.byteLength).setUint32(4, c.payloadEnd - c.dataStart, true)
      parts.push(header, bytes.subarray(c.dataStart, c.end))
    } else {
      parts.push(bytes.subarray(c.start, c.end))
    }
    // A final odd-sized chunk whose pad byte is missing gets it restored.
    if ((c.payloadEnd - c.dataStart) % 2 === 1 && c.end === c.payloadEnd) parts.push(new Uint8Array(1))
  }
  if (riffEnd < bytes.length) removed.push({ label: 'Trailing bytes after RIFF end', size: bytes.length - riffEnd })

  const out = concatParts(parts)
  fixRiffSizeLE(out)
  const notes: string[] = [...parseNotes]
  if (removed.length === 0) {
    notes.push('No removable metadata chunks found — the cleaned copy is identical to the original.')
  } else {
    notes.push('Metadata chunks removed. Audio sample data was copied bit-for-bit (lossless).')
  }
  return { out, removed, notes }
}
