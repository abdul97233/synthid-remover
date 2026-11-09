import type { RemovedItem, StructureEntry } from '../types'
import { readAscii, matchesAscii } from './bytes'

/**
 * MP3: ID3v2 tag at the front, optional ID3v1 / APEv2 tags at the end.
 * The MPEG audio frames between the tags are byte-copied — a lossless strip.
 */

interface Id3Info {
  version: string
  tagSize: number // includes header, footer and padding
  hasFooter: boolean
  frames: Array<{ id: string; size: number; offset: number; value?: string }>
}

const FRAME_NAMES: Record<string, string> = {
  TIT2: 'Title', TPE1: 'Artist', TPE2: 'Album artist', TALB: 'Album', TBPM: 'BPM',
  TCOM: 'Composer', TCON: 'Genre', TCOP: 'Copyright', TDAT: 'Date', TDRC: 'Recording time',
  TDLY: 'Playlist delay', TENR: 'Engineer', TEXT: 'Lyricist', TFLT: 'File type', TIME: 'Time',
  TIT1: 'Grouping', TIT3: 'Subtitle', TKEY: 'Key', TLAN: 'Language', TLEN: 'Length',
  TMED: 'Media type', TMOO: 'Mood', TOAL: 'Original album', TOFN: 'Original filename',
  TOLY: 'Original lyricist', TOPE: 'Original artist', TOWN: 'Owner', TPE3: 'Conductor',
  TPE4: 'Remixer', TPOS: 'Disc number', TPRO: 'Produced notice', TPUB: 'Publisher',
  TRCK: 'Track number', TRDA: 'Recording date', TRSN: 'Radio station', TRSO: 'Owner',
  TSIZ: 'Size', TSO2: 'Album sort order', TSOA: 'Album sort', TSOP: 'Artist sort',
  TSOT: 'Title sort', TSRC: 'ISRC', TSS2: 'Software/Hardware', TSSE: 'Encoder settings',
  TYER: 'Year', TXXX: 'User-defined text',
  WCOM: 'Commercial URL', WCOP: 'Copyright URL', WOAF: 'File URL', WOAR: 'Artist URL',
  WOAS: 'Source URL', WORS: 'Radio URL', WPAY: 'Payment URL', WPUB: 'Publisher URL',
  ICRD: 'Creation date', IENG: 'Engineer', IMUS: 'Musician', IPRO: 'Producer',
  GEOB: 'General object', PRIV: 'Private data', 'MP3 Gain': 'Replay gain info',
}

function synchsafe(b: Uint8Array, i: number): number {
  return ((b[i] & 0x7f) << 21) | ((b[i + 1] & 0x7f) << 14) | ((b[i + 2] & 0x7f) << 7) | (b[i + 3] & 0x7f)
}

function uint32be(b: Uint8Array, i: number): number {
  return (b[i] << 24) | (b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]
}

function decodeText(bytes: Uint8Array): string {
  if (bytes.length === 0) return ''
  const enc = bytes[0]
  let label = 'windows-1252'
  let start = 1
  if (enc === 0) label = 'windows-1252'
  else if (enc === 1) label = 'utf-16'
  else if (enc === 2) label = 'utf-16be'
  else if (enc === 3) label = 'utf-8'
  if (enc === 1 && bytes.length >= 3) {
    // UTF-16 with BOM: pick the byte order the BOM declares.
    if (bytes[1] === 0xfe && bytes[2] === 0xff) { label = 'utf-16be'; start = 3 }
    else if (bytes[1] === 0xff && bytes[2] === 0xfe) { label = 'utf-16le'; start = 3 }
    else label = 'utf-16le'
  }
  try {
    let text = new TextDecoder(label).decode(bytes.subarray(start))
    text = text.replace(/\0+$/, '').trim()
    return text
  } catch {
    return readAscii(bytes, start, Math.min(40, bytes.length - start))
  }
}

export function parseId3v2(bytes: Uint8Array): Id3Info | null {
  if (bytes.length < 10 || !matchesAscii(bytes, 0, 'ID3')) return null
  // Size bytes are always synchsafe (7 bits each) in a real tag header.
  if ((bytes[6] | bytes[7] | bytes[8] | bytes[9]) & 0x80) return null
  const major = bytes[3]
  const flags = bytes[5]
  // The tag size in the header is synchsafe in every ID3v2 version (2.2, 2.3, 2.4).
  const bodySize = synchsafe(bytes, 6)
  const hasFooter = major >= 4 && (flags & 0x10) !== 0
  const tagSize = 10 + bodySize + (hasFooter ? 10 : 0)

  const frames: Id3Info['frames'] = []
  let pos = 10
  // Skip the extended header (v2.3: size excludes its own 4 bytes; v2.4: synchsafe, includes itself).
  if (major >= 3 && (flags & 0x40) !== 0 && bytes.length >= 14) {
    pos += major >= 4 ? synchsafe(bytes, 10) : uint32be(bytes, 10) + 4
  }
  const frameEnd = Math.min(10 + bodySize, bytes.length)
  const idLen = major <= 2 ? 3 : 4
  while (pos + idLen + (major <= 2 ? 3 : 6) <= frameEnd) {
    const id = readAscii(bytes, pos, idLen)
    if (!/^[A-Z0-9]{3,4}$/.test(id)) break
    let size: number
    let flagsSize: number
    if (major <= 2) {
      size = (bytes[pos + 3] << 16) | (bytes[pos + 4] << 8) | bytes[pos + 5]
      flagsSize = 0
    } else {
      size = major >= 4 ? synchsafe(bytes, pos + 4) : uint32be(bytes, pos + 4)
      flagsSize = 2
    }
    if (size <= 0 || pos + idLen + flagsSize + size > frameEnd + 1) break
    const shift = major <= 2 ? 6 : 10 // id + size (+flags)
    const dataStart = pos + shift
    if (/^T/.test(id)) {
      frames.push({ id, size, offset: pos, value: decodeText(bytes.subarray(dataStart, Math.min(dataStart + size, frameEnd))) })
    } else {
      frames.push({ id, size, offset: pos })
    }
    pos = dataStart + size
  }
  return { version: `ID3v2.${major}`, tagSize, hasFooter, frames }
}

export function inspectMp3(bytes: Uint8Array): { entries: StructureEntry[]; notes: string[] } {
  const notes: string[] = []
  const entries: StructureEntry[] = []
  const id3 = parseId3v2(bytes)
  if (id3) {
    entries.push({ name: `${id3.version} tag header`, offset: 0, size: 10, removable: true })
    for (const f of id3.frames.slice(0, 80)) {
      entries.push({
        name: f.id !== 'TXXX' ? `Frame ${f.id}` : 'Frame TXXX (user text)',
        description: f.value ? `${FRAME_NAMES[f.id] ?? 'Frame'}: ${f.value}` : (FRAME_NAMES[f.id] ?? undefined),
        offset: f.offset,
        size: f.size,
        removable: true,
      })
    }
    const last = id3.frames[id3.frames.length - 1]
    const framesEnd = last ? last.offset + last.size + (id3.version === 'ID3v2.2' ? 6 : 10) : 10
    if (id3.tagSize > framesEnd) {
      entries.push({
        name: `${id3.version} padding / footer`,
        offset: framesEnd,
        size: id3.tagSize - framesEnd,
        removable: true,
      })
    }
    notes.push(`${id3.version} tag with ${id3.frames.length} frames will be removed when cleaning. Audio bitstream is not touched.`)
  } else {
    notes.push('No ID3v2 tag at the start of this file.')
  }
  if (bytes.length >= 128 && matchesAscii(bytes, bytes.length - 128, 'TAG')) {
    entries.push({ name: 'ID3v1 tag (end of file)', offset: bytes.length - 128, size: 128, removable: true })
    notes.push('ID3v1 tag found at the end of the file — removed when cleaning.')
  }
  const apeEnd = bytes.length >= 128 && matchesAscii(bytes, bytes.length - 128, 'TAG') ? bytes.length - 128 : bytes.length
  const apeTag = findApeFooter(bytes.subarray(0, apeEnd))
  if (apeTag !== null) {
    entries.push({ name: 'APEv2 tag (end of file)', offset: apeTag.tagStart, size: apeTag.tagEnd - apeTag.tagStart, removable: true })
    notes.push('APEv2 tag found near the end of the file — removed when cleaning.')
  }
  return { entries, notes }
}

/** Locate an APEv2 footer ("APETAGEX", 32-byte header/footer layout). */
export function findApeFooter(bytes: Uint8Array): { footerPos: number; tagStart: number; tagEnd: number } | null {
  const limit = bytes.length - 32
  if (limit < 0) return null
  for (let i = bytes.length - 32; i >= Math.max(0, bytes.length - 160); i--) {
    if (matchesAscii(bytes, i, 'APETAGEX')) {
      const size = (bytes[i + 12] | (bytes[i + 13] << 8) | (bytes[i + 14] << 16) | (bytes[i + 15] << 24)) >>> 0
      // Layout: "APETAGEX"(8) version(4) size(4) item count(4) flags(4) reserved(8).
      const flags = (bytes[i + 20] | (bytes[i + 21] << 8) | (bytes[i + 22] << 16) | (bytes[i + 23] << 24)) >>> 0
      const hasHeader = (flags & 0x80000000) !== 0
      // The size field covers the items + footer, but not the optional 32-byte header.
      const tagStart = Math.max(0, i + 32 - size - (hasHeader ? 32 : 0))
      return { footerPos: i, tagStart, tagEnd: i + 32 }
    }
  }
  void limit
  return null
}

export function stripMp3(bytes: Uint8Array): { out: Uint8Array; removed: RemovedItem[]; notes: string[] } {
  const removed: RemovedItem[] = []
  const notes: string[] = []
  let start = 0
  let end = bytes.length

  // One or more ID3v2 tags at the front (some taggers prepend a second tag).
  for (let guard = 0; guard < 8; guard++) {
    const id3 = parseId3v2(bytes.subarray(start))
    if (!id3) break
    removed.push({ label: `${id3.version} tag (${id3.frames.length} frames)`, size: Math.min(id3.tagSize, bytes.length - start) })
    start = Math.min(start + id3.tagSize, bytes.length)
  }

  // ID3v1 at the tail.
  if (bytes.length >= start + 128 && matchesAscii(bytes, bytes.length - 128, 'TAG')) {
    removed.push({ label: 'ID3v1 tag', size: 128 })
    end -= 128
  }

  // APEv2 near the tail (above ID3v1 if both existed).
  const ape = findApeFooter(bytes.subarray(0, end))
  if (ape) {
    removed.push({ label: 'APEv2 tag', size: ape.tagEnd - ape.tagStart })
    end = ape.tagStart
  }

  // An appended ID3v2.4 tag at the end is identified by its "3DI" footer.
  if (end - start >= 20 && matchesAscii(bytes, end - 10, '3DI')) {
    const f = end - 10
    if (!((bytes[f + 6] | bytes[f + 7] | bytes[f + 8] | bytes[f + 9]) & 0x80)) {
      const tagSize = synchsafe(bytes, f + 6) + 20
      const tagStart = end - tagSize
      if (tagStart >= start && matchesAscii(bytes, tagStart, 'ID3')) {
        removed.push({ label: 'Trailing ID3v2 tag', size: tagSize })
        end = tagStart
      }
    }
  }

  if (removed.length === 0) {
    notes.push('No removable metadata tags found — the cleaned copy is identical to the original.')
  }
  if (end <= start) throw new Error('File contains only metadata tags with no audio data.')
  return { out: bytes.subarray(start, end), removed, notes }
}
