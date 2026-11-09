import type { RemovedItem, StructureEntry } from '../types'
import { concatParts, readAscii } from './bytes'

/**
 * JPEG segment splitter.
 *
 * JPEG = a chain of marker segments (FFxx + length) with entropy-coded scan
 * data after each SOS (0xDA), terminated by EOI (0xD9). Metadata lives in
 * APP1–APP15 and COM segments; image data is untouched by removing them —
 * a lossless operation.
 */

interface Segment {
  marker: number
  name: string
  start: number // offset of the 0xFF marker byte
  headerEnd: number // offset just after the segment header/payload (before any entropy data)
  dataEnd: number // end of this segment incl. scan data for SOS (start of next marker)
  description?: string
  metadata?: boolean
}

const MARKER_NAMES: Record<number, string> = {
  0xe0: 'APP0 (JFIF)',
  0xe1: 'APP1 (EXIF / XMP)',
  0xe2: 'APP2 (ICC / MPF)',
  0xe3: 'APP3',
  0xe4: 'APP4',
  0xe5: 'APP5',
  0xe6: 'APP6',
  0xe7: 'APP7',
  0xe8: 'APP8',
  0xe9: 'APP9',
  0xea: 'APP10',
  0xeb: 'APP11 (JUMBF / C2PA)',
  0xec: 'APP12 (Picture Info)',
  0xed: 'APP13 (Photoshop / IPTC)',
  0xee: 'APP14 (Adobe)',
  0xef: 'APP15',
  0xfe: 'COM (Comment)',
  0xdb: 'DQT (Quant tables)',
  0xc0: 'SOF0 (Frame)',
  0xc1: 'SOF1',
  0xc2: 'SOF2',
  0xc4: 'DHT (Huffman tables)',
  0xda: 'SOS (Scan start)',
  0xdd: 'DRI (Restart interval)',
}

/** Segments that count as removable metadata. ICC (APP2 ICC_PROFILE) and Adobe APP14 are kept. */
function isMetadataSegment(marker: number, data: Uint8Array): boolean {
  if (marker === 0xfe) return true // COM
  if (marker === 0xe2) {
    // Keep the ICC profile (color accuracy); MPF / FlashPix APP2 payloads are metadata.
    return readAscii(data, 2, 12) !== 'ICC_PROFILE\0'
  }
  if (marker === 0xee) {
    // The Adobe APP14 segment carries the color-transform flag decoders need
    // (CMYK / YCCK / RGB JPEGs render with wrong colors without it) — not metadata.
    return readAscii(data, 2, 5) !== 'Adobe'
  }
  if (marker >= 0xe1 && marker <= 0xef) return true // APP1..APP15 (incl. APP11 C2PA)
  return false
}

/** `data` starts at the 2-byte length field. */
function segmentDescription(marker: number, data: Uint8Array): string | undefined {
  if (data.length < 4) return undefined
  if (marker === 0xe1) {
    if (readAscii(data, 2, 4) === 'Exif') return 'EXIF camera metadata'
    if (data[2] === 0x3c || readAscii(data, 2, 12).includes('http')) return 'XMP metadata'
    return 'Metadata segment'
  }
  if (marker === 0xe2) {
    if (readAscii(data, 2, 12) === 'ICC_PROFILE\0') return 'ICC color profile'
    if (readAscii(data, 2, 3) === 'MPF') return 'Multi-picture format index (MPF)'
    return 'APP2 metadata'
  }
  if (marker === 0xeb) return 'C2PA / JUMBF manifest'
  if (marker === 0xed && readAscii(data, 2, 20).includes('Photoshop')) return 'Photoshop / IPTC image resources'
  if (marker === 0xee) return readAscii(data, 2, 5) === 'Adobe' ? 'Adobe color transform (kept)' : 'APP14 data'
  if (marker === 0xfe) return 'Text comment'
  return undefined
}

export interface JpegParse {
  /** Every marker segment in file order. SOS segments include their entropy-coded scan data. */
  segments: Segment[]
  /** Offset just past EOI (or the file end when EOI is missing). */
  eoiEnd: number
  hasEoi: boolean
  /** End of the first SOS header (kept for compatibility). */
  tailStart: number
}

export function parseJpegSegments(bytes: Uint8Array): JpegParse {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) throw new Error('Not a valid JPEG file (missing SOI marker)')
  const segments: Segment[] = []
  let i = 2
  let tailStart = -1

  while (i < bytes.length) {
    if (bytes[i] !== 0xff) throw new Error('Corrupted JPEG structure (expected marker)')
    while (i < bytes.length && bytes[i] === 0xff) i++ // fill bytes
    if (i >= bytes.length) break
    const marker = bytes[i]
    const segStart = i - 1
    if (marker === 0xd9) {
      segments.push({ marker, name: 'EOI', start: segStart, headerEnd: i + 1, dataEnd: i + 1 })
      if (tailStart === -1) throw new Error('Corrupted JPEG structure (no image scan found)')
      return { segments, eoiEnd: i + 1, hasEoi: true, tailStart }
    }
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      // Standalone markers (TEM / RSTn) have no length field.
      segments.push({ marker, name: `Marker 0x${marker.toString(16)}`, start: segStart, headerEnd: i + 1, dataEnd: i + 1 })
      i++
      continue
    }
    if (i + 2 >= bytes.length) throw new Error('Truncated JPEG file')
    // The length counts its own two bytes plus the payload (not the FFxx marker).
    const length = (bytes[i + 1] << 8) | bytes[i + 2]
    if (length < 2) throw new Error('Corrupted JPEG structure (invalid segment length)')
    const lengthStart = i + 1
    const headerEnd = lengthStart + length
    if (headerEnd > bytes.length) throw new Error('Truncated JPEG segment')
    const data = bytes.subarray(lengthStart, headerEnd)
    let dataEnd = headerEnd
    if (marker === 0xda) {
      // Entropy-coded data follows the SOS header up to the next real marker.
      // Inside it, 0xFF is always followed by 0x00 (byte stuffing) or RSTn.
      let j = headerEnd
      while (j < bytes.length) {
        if (bytes[j] === 0xff && j + 1 < bytes.length) {
          const n = bytes[j + 1]
          if (n === 0x00 || (n >= 0xd0 && n <= 0xd7)) {
            j += 2
            continue
          }
          if (n === 0xff) {
            j++
            continue
          }
          break
        }
        j++
      }
      dataEnd = j
      if (tailStart === -1) tailStart = headerEnd
    }
    segments.push({
      marker,
      name: MARKER_NAMES[marker] ?? `Marker 0x${marker.toString(16)}`,
      start: segStart,
      headerEnd,
      dataEnd,
      description: segmentDescription(marker, data),
      metadata: isMetadataSegment(marker, data),
    })
    i = dataEnd
  }
  if (tailStart === -1) throw new Error('Corrupted JPEG structure (no image scan found)')
  // Truncated after the scan started (no EOI) — keep what exists.
  return { segments, eoiEnd: bytes.length, hasEoi: false, tailStart }
}

export function inspectJpeg(bytes: Uint8Array): { entries: StructureEntry[]; notes: string[] } {
  const { segments, eoiEnd, hasEoi } = parseJpegSegments(bytes)
  const notes: string[] = []
  const entries: StructureEntry[] = [{ name: 'SOI (Start of image)', offset: 0, size: 2, removable: false }]
  for (const s of segments) {
    if (s.marker === 0x01 || (s.marker >= 0xd0 && s.marker <= 0xd7)) continue
    entries.push({
      name: s.marker === 0xda ? 'SOS (Scan + image data)' : s.name,
      description: s.description,
      offset: s.start,
      size: s.dataEnd - s.start,
      removable: s.metadata === true,
    })
  }
  if (!hasEoi) notes.push('The file ends without an EOI marker (truncated?) — the existing image data is kept as-is.')
  if (eoiEnd < bytes.length) {
    entries.push({
      name: 'Data after EOI',
      description: 'Appended data (e.g. embedded gain map, motion photo or trailer)',
      offset: eoiEnd,
      size: bytes.length - eoiEnd,
      removable: true,
    })
    notes.push('Extra data found after the end of the image — removed when cleaning.')
  }
  return { entries, notes }
}

export function stripJpeg(bytes: Uint8Array): { out: Uint8Array; removed: RemovedItem[]; notes: string[] } {
  const { segments, eoiEnd, hasEoi } = parseJpegSegments(bytes)
  const removed: RemovedItem[] = []
  const notes: string[] = []
  const parts: Uint8Array[] = [bytes.subarray(0, 2)] // SOI

  for (const s of segments) {
    if (s.metadata) {
      removed.push({ label: s.description ? `${s.name} — ${s.description}` : s.name, size: s.dataEnd - s.start })
      continue
    }
    // Structural segments, scans (with their entropy data) and EOI are copied verbatim.
    parts.push(bytes.subarray(s.start, s.dataEnd))
  }

  if (eoiEnd < bytes.length) {
    removed.push({ label: 'Data after EOI (appended trailer / embedded secondary image)', size: bytes.length - eoiEnd })
  }
  if (!hasEoi) notes.push('The original file had no EOI marker (truncated); the image data was copied as-is.')

  if (removed.length === 0) {
    notes.push('No removable metadata segments found — the cleaned copy is identical to the original.')
  }
  const labels = removed.map((r) => r.label)
  if (labels.some((l) => l.includes('C2PA'))) notes.push('A C2PA / Content Credentials manifest was removed (provenance metadata).')
  if (labels.some((l) => l.includes('EXIF camera'))) notes.push('EXIF data removed. If the photo relied on the Orientation tag, some viewers may display it rotated.')
  if (labels.some((l) => l.startsWith('Data after EOI'))) {
    notes.push('Data appended after the image (e.g. an HDR gain map or motion-photo video) was removed; the primary image is unchanged.')
  }
  return { out: concatParts(parts), removed, notes }
}
