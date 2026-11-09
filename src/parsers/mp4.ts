import type { RemovedItem, StructureEntry } from '../types'
import { concatParts, readAscii, describeBytes, writeUint32BE } from './bytes'

/**
 * MP4 / MOV = ISO base media file: a tree of boxes (size + type).
 *
 * Cleaning strategy (lossless, no re-encode):
 *  1. Rebuild `moov` children, and `udta`/`meta` boxes inside each `trak`,
 *     dropping metadata (udta, meta, id32, uuid) and padding (free, skip).
 *  2. Drop top-level metadata/padding boxes.
 *  3. If anything before `mdat` shrank, patch chunk offsets (stco/co64).
 *  4. Validate the result by fully re-parsing it; refuse unsafe outputs.
 */

export interface Atom {
  type: string
  start: number
  end: number
  dataStart: number
}

const TOP_DROP = new Set(['free', 'skip', 'wide', 'uuid', 'meta', 'sig', 'id32', 'prft'])
const INNER_DROP = new Set(['udta', 'meta', 'free', 'skip', 'id32', 'uuid'])
const CONTAINERS = new Set(['moov', 'trak', 'mdia', 'minf', 'stbl', 'edts', 'mvex'])

function parseAtoms(bytes: Uint8Array, start: number, end: number): { atoms: Atom[]; complete: boolean } {
  const atoms: Atom[] = []
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let pos = start
  while (pos + 8 <= end) {
    let size = dv.getUint32(pos, false)
    const type = readAscii(bytes, pos + 4, 4)
    let headerSize = 8
    if (size === 1) {
      if (pos + 16 > end) return { atoms, complete: false }
      size = Number(dv.getBigUint64(pos + 8, false))
      headerSize = 16
    } else if (size === 0) {
      size = end - pos
    }
    if (size < headerSize || pos + size > end) return { atoms, complete: false }
    atoms.push({ type, start: pos, end: pos + size, dataStart: pos + headerSize })
    pos += size
  }
  // Legacy QuickTime may end a container with a 32-bit zero terminator.
  if (end - pos === 4 && bytes[pos] === 0 && bytes[pos + 1] === 0 && bytes[pos + 2] === 0 && bytes[pos + 3] === 0) {
    return { atoms, complete: true }
  }
  return { atoms, complete: pos === end }
}

/**
 * Children of a plain container atom. `meta` is a full box: it carries a
 * 4-byte version/flags prefix before its child boxes.
 */
function parseChildren(bytes: Uint8Array, atom: Atom): { atoms: Atom[]; complete: boolean } {
  if (atom.type === 'meta') {
    // meta is a full box: it carries a 4-byte version/flags prefix before its child boxes.
    return parseAtoms(bytes, atom.dataStart + 4, atom.end)
  }
  return parseAtoms(bytes, atom.dataStart, atom.end)
}

function boxHeader(type: string, contentSize: number): Uint8Array {
  const header = new Uint8Array(8)
  writeUint32BE(header, 0, contentSize + 8)
  for (let i = 0; i < 4; i++) header[4 + i] = type.charCodeAt(i)
  return header
}

/** Recursively rebuild a container, dropping metadata boxes. */
function rebuildContainer(bytes: Uint8Array, atom: Atom, removed: RemovedItem[], path: string): Uint8Array {
  const { atoms, complete } = parseChildren(bytes, atom)
  if (!complete) throw new Error(`Malformed ${path} box (children do not fill it exactly) — refusing unsafe output`)
  const parts: Uint8Array[] = []
  for (const child of atoms) {
    if (INNER_DROP.has(child.type)) {
      removed.push({ label: `${path}/${child.type} box`, size: child.end - child.start })
      continue
    }
    if (child.type === 'trak') {
      // Descend so udta/meta INSIDE each trak are removed as well.
      const inner = rebuildContainer(bytes, child, removed, `${path}/trak`)
      parts.push(boxHeader('trak', inner.length), inner)
      continue
    }
    parts.push(bytes.subarray(child.start, child.end))
  }
  return concatParts(parts)
}

/** Collect stco / co64 atoms (they live inside stbl) with absolute positions in a buffer. */
function collectChunkOffsetBoxes(
  bytes: Uint8Array,
  start: number,
  end: number,
  found: Array<Atom & { kind: 'stco' | 'co64' }>,
): void {
  const { atoms, complete } = parseAtoms(bytes, start, end)
  if (!complete) throw new Error('Malformed box tree inside moov — refusing unsafe output')
  for (const atom of atoms) {
    if (atom.type === 'stco' || atom.type === 'co64') {
      found.push({ ...atom, kind: atom.type })
      continue
    }
    if (CONTAINERS.has(atom.type) && atom.end > atom.dataStart) {
      collectChunkOffsetBoxes(bytes, atom.dataStart, atom.end, found)
    }
  }
}

/** A byte range [start, end) of the ORIGINAL file that no longer exists in the output. */
interface RemovedRange {
  start: number
  end: number
}

/**
 * Rewrite every stco/co64 chunk offset in the rebuilt file: an offset in the
 * original file moves left by the number of removed bytes before it. Offsets
 * that must move are required to point inside an original mdat payload.
 */
function patchChunkOffsets(out: Uint8Array, ranges: RemovedRange[], mdats: Atom[]): string[] {
  const notes: string[] = []
  const top = parseAtoms(out, 0, out.length)
  const moov = top.atoms.find((a) => a.type === 'moov')
  if (!moov) throw new Error('Internal error: rebuilt file has no moov')
  const found: Array<Atom & { kind: 'stco' | 'co64' }> = []
  collectChunkOffsetBoxes(out, moov.dataStart, moov.end, found)
  const dv = new DataView(out.buffer, out.byteOffset, out.byteLength)
  const fail = (): never => {
    throw new Error('Chunk offset validation failed (refusing unsafe output)')
  }
  let patched = 0
  for (const box of found) {
    // Full box: 1 byte version + 3 bytes flags, then a 32-bit entry count.
    if (box.end - box.dataStart < 8) fail()
    const count = dv.getUint32(box.dataStart + 4, false)
    const slotSize = box.kind === 'stco' ? 4 : 8
    if (box.dataStart + 8 + count * slotSize > box.end) fail()
    for (let i = 0; i < count; i++) {
      const pos = box.dataStart + 8 + i * slotSize
      const off = box.kind === 'stco' ? dv.getUint32(pos, false) : Number(dv.getBigUint64(pos, false))
      let shift = 0
      for (const r of ranges) {
        if (off >= r.start && off < r.end) fail() // points into removed data
        if (r.end <= off) shift += r.end - r.start
      }
      if (shift === 0) continue
      if (!mdats.some((m) => off >= m.dataStart && off < m.end)) fail()
      const fixed = off - shift
      if (box.kind === 'stco') dv.setUint32(pos, fixed, false)
      else dv.setBigUint64(pos, BigInt(fixed), false)
      patched++
    }
  }
  if (patched > 0) {
    notes.push(`Rewired ${patched.toLocaleString()} chunk offset(s) to compensate for boxes removed before the media data.`)
  }
  return notes
}

function uuidLabel(bytes: Uint8Array, atom: Atom): string {
  const from = atom.dataStart + 16 // 16-byte extended UUID
  const probe = readAscii(bytes, Math.min(from, bytes.length), Math.min(200, atom.end - Math.min(from, bytes.length)))
  if (probe.includes('x:xmpmeta') || probe.startsWith('<?xpacket')) return 'uuid box (XMP metadata)'
  if (probe.toLowerCase().includes('c2pa')) return 'uuid box (C2PA / Content Credentials)'
  const described = describeBytes(bytes, Math.min(from, bytes.length), Math.min(40, atom.end - Math.min(from, bytes.length)))
  return described ? `uuid box (${described})` : 'uuid box (vendor data)'
}

export function inspectMp4(bytes: Uint8Array): { entries: StructureEntry[]; notes: string[] } {
  const notes: string[] = []
  const { atoms, complete } = parseAtoms(bytes, 0, bytes.length)
  if (!complete) notes.push('File ends inside a box (truncated) — structure report may be incomplete.')
  const labels: Record<string, string> = {
    ftyp: 'File type / brand',
    moov: 'Movie metadata (track index, timing)',
    mdat: 'Media data (audio/video payload)',
    free: 'Padding box',
    skip: 'Padding box',
    wide: '64-bit size placeholder',
    uuid: 'Vendor / metadata box',
    meta: 'Metadata box (XMP / iTunes tags)',
    sidx: 'Segment index (streaming)',
    sig: 'C2PA signature box',
    prft: 'Producer reference time',
  }
  const entries: StructureEntry[] = atoms.map((a) => ({
    name: `${a.type} box`,
    description: a.type === 'uuid' ? uuidLabel(bytes, a) : labels[a.type],
    offset: a.start,
    size: a.end - a.start,
    removable: TOP_DROP.has(a.type),
  }))

  const moov = atoms.find((a) => a.type === 'moov')
  if (moov) {
    const { atoms: children } = parseChildren(bytes, moov)
    for (const child of children) {
      // Show inner metadata boxes not visible at the top level.
      if (INNER_DROP.has(child.type) && !TOP_DROP.has(child.type)) {
        entries.push({
          name: `moov/${child.type} box`,
          description:
            child.type === 'udta'
              ? 'User data (encoder name, artist, ©-tags)'
              : 'Metadata box (XMP / iTunes tags)',
          offset: child.start,
          size: child.end - child.start,
          removable: true,
        })
      }
    }
  }

  if (atoms.some((a) => a.type === 'moof')) {
    notes.push('Fragmented MP4 detected (moof boxes). Cleaning is disabled for this file for safety — inspection only.')
  }
  const removableCount = atoms.filter((a) => TOP_DROP.has(a.type)).length
  if (removableCount > 0) {
    notes.push(
      `${removableCount} top-level metadata/padding box(es) will be removed when cleaning. The media payload is copied byte-for-byte.`,
    )
  }
  return { entries, notes }
}

export function stripMp4(bytes: Uint8Array): { out: Uint8Array; removed: RemovedItem[]; notes: string[] } {
  const top = parseAtoms(bytes, 0, bytes.length)
  if (!top.complete) throw new Error('Truncated MP4 structure (file ends inside a box)')
  const atoms = top.atoms
  const mdats = atoms.filter((a) => a.type === 'mdat')
  if (mdats.length === 0) throw new Error('File has no mdat box (no audio/video payload)')
  if (!atoms.some((a) => a.type === 'moov')) throw new Error('File has no moov box (no track index)')
  if (atoms.some((a) => a.type === 'moof')) {
    throw new Error('Fragmented MP4 (moof boxes) cannot be cleaned safely by local rewriting — inspection only.')
  }
  const hadFtyp = atoms.some((a) => a.type === 'ftyp')

  const removed: RemovedItem[] = []
  const parts: Uint8Array[] = []
  const ranges: RemovedRange[] = []

  for (const atom of atoms) {
    if (atom.type === 'moov') {
      const inner = rebuildContainer(bytes, atom, removed, 'moov')
      parts.push(boxHeader('moov', inner.length), inner)
      const delta = atom.end - atom.start - (inner.length + 8)
      if (delta > 0) ranges.push({ start: atom.end - delta, end: atom.end })
    } else if (TOP_DROP.has(atom.type)) {
      removed.push({ label: atom.type === 'uuid' ? uuidLabel(bytes, atom) : `${atom.type} box`, size: atom.end - atom.start })
      ranges.push({ start: atom.start, end: atom.end })
    } else {
      parts.push(bytes.subarray(atom.start, atom.end))
    }
  }

  const out = concatParts(parts)
  const notes: string[] = []
  if (ranges.length > 0) notes.push(...patchChunkOffsets(out, ranges, mdats))
  validateMp4(out, hadFtyp)

  if (removed.length === 0) notes.push('No removable boxes found — the cleaned copy is identical to the original.')
  if (removed.some((r) => r.label.includes('C2PA'))) notes.push('A C2PA / Content Credentials box was removed (provenance metadata).')
  if (removed.some((r) => r.label.includes('XMP'))) notes.push('XMP metadata box removed.')
  return { out, removed, notes }
}

/** Post-clean safety net: rebuilt file must re-parse exactly (incl. the moov tree) and contain the essential boxes. */
export function validateMp4(out: Uint8Array, requireFtyp = true): void {
  const { atoms, complete } = parseAtoms(out, 0, out.length)
  if (!complete) throw new Error('Validation failed: rebuilt file does not parse to its exact size')
  for (const required of requireFtyp ? ['ftyp', 'moov', 'mdat'] : ['moov', 'mdat']) {
    if (!atoms.some((a) => a.type === required)) {
      throw new Error(`Validation failed: missing ${required} box after cleaning`)
    }
  }
  const moov = atoms.find((a) => a.type === 'moov')!
  const found: Array<Atom & { kind: 'stco' | 'co64' }> = []
  try {
    collectChunkOffsetBoxes(out, moov.dataStart, moov.end, found)
  } catch {
    throw new Error('Validation failed: the rebuilt moov box does not re-parse')
  }
}
