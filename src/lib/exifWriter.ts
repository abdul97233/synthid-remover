/**
 * EXPERIMENTAL — write user-chosen EXIF tags into an already-cleaned image.
 *
 * Writes a minimal TIFF/EXIF block (ASCII tags only) and inserts it
 * losslessly: an APP1 segment for JPEG, an `eXIf` chunk for PNG. Pixels are
 * never touched. These tags are *claims* the user chose; they are not
 * provenance and do not create or imitate C2PA / Content Credentials.
 */
import { crc32Of } from './zip'

export interface TagFields {
  make?: string
  model?: string
  lensMake?: string
  lensModel?: string
  software?: string
  artist?: string
  copyright?: string
  description?: string
  /** "YYYY:MM:DD HH:MM:SS" */
  dateTimeOriginal?: string
}

export interface TagPreset {
  id: string
  label: string
  fields: Pick<TagFields, 'make' | 'model' | 'lensMake' | 'lensModel' | 'software'>
}

/** Device presets (typical published EXIF values; firmware versions vary). */
export const TAG_PRESETS: TagPreset[] = [
  { id: 'rayban-meta', label: 'Ray-Ban Meta glasses', fields: { make: 'Meta', model: 'Ray-Ban Meta Smart Glasses', software: '' } },
  { id: 'iphone-15-pro', label: 'iPhone 15 Pro', fields: { make: 'Apple', model: 'iPhone 15 Pro', lensMake: 'Apple', lensModel: 'iPhone 15 Pro back triple camera 6.765mm f/1.78', software: '17.5.1' } },
  { id: 'iphone-16', label: 'iPhone 16', fields: { make: 'Apple', model: 'iPhone 16', lensMake: 'Apple', lensModel: 'iPhone 16 back dual wide camera 5.96mm f/1.6', software: '18.1' } },
  { id: 'pixel-9-pro', label: 'Google Pixel 9 Pro', fields: { make: 'Google', model: 'Pixel 9 Pro', software: '' } },
  { id: 'galaxy-s24-ultra', label: 'Samsung Galaxy S24 Ultra', fields: { make: 'samsung', model: 'SM-S928B', software: 'S928BXXU1AXB5' } },
  { id: 'canon-r5', label: 'Canon EOS R5', fields: { make: 'Canon', model: 'Canon EOS R5', lensModel: 'RF24-105mm F4 L IS USM', software: '' } },
  { id: 'sony-a7iv', label: 'Sony α7 IV', fields: { make: 'SONY', model: 'ILCE-7M4', lensModel: 'FE 24-70mm F2.8 GM II', software: '' } },
  { id: 'fuji-x100vi', label: 'Fujifilm X100VI', fields: { make: 'FUJIFILM', model: 'X100VI', software: '' } },
  { id: 'dji-mini-4', label: 'DJI Mini 4 Pro', fields: { make: 'DJI', model: 'FC8482', software: '' } },
  { id: 'gopro-12', label: 'GoPro HERO12', fields: { make: 'GoPro', model: 'HERO12 Black', software: '' } },
]

const ASCII = 2
const LONG = 4

type Entry = { tag: number; type: number; value: Uint8Array | number }

function ascii(s: string): Uint8Array {
  // EXIF ASCII is 7-bit; replace anything else so readers never choke.
  const clean = s
    .replace(/©/g, '(c)')
    .replace(/®/g, '(R)')
    .replace(/™/g, '(TM)')
    .replace(/[^\x20-\x7e]/g, '?')
  const out = new Uint8Array(clean.length + 1)
  for (let i = 0; i < clean.length; i++) out[i] = clean.charCodeAt(i)
  return out
}

/** Build a little-endian TIFF block: IFD0 (+ optional Exif sub-IFD). */
export function buildExif(f: TagFields): Uint8Array {
  const ifd0: Entry[] = []
  const exif: Entry[] = []
  const add = (list: Entry[], tag: number, v?: string) => {
    if (v && v.trim()) list.push({ tag, type: ASCII, value: ascii(v.trim()) })
  }
  add(ifd0, 0x010e, f.description)
  add(ifd0, 0x010f, f.make)
  add(ifd0, 0x0110, f.model)
  add(ifd0, 0x0131, f.software)
  add(ifd0, 0x0132, f.dateTimeOriginal)
  add(ifd0, 0x013b, f.artist)
  add(ifd0, 0x8298, f.copyright)
  add(exif, 0x9003, f.dateTimeOriginal)
  add(exif, 0x9004, f.dateTimeOriginal)
  add(exif, 0xa433, f.lensMake)
  add(exif, 0xa434, f.lensModel)
  if (exif.length) ifd0.push({ tag: 0x8769, type: LONG, value: 0 }) // patched below
  ifd0.sort((a, b) => a.tag - b.tag)
  exif.sort((a, b) => a.tag - b.tag)

  const ifdSize = (n: number) => 2 + n * 12 + 4
  const extSize = (list: Entry[]) =>
    list.reduce((s, e) => s + (e.value instanceof Uint8Array && e.value.length > 4 ? e.value.length + (e.value.length & 1) : 0), 0)

  const ifd0Off = 8
  const ifd0DataOff = ifd0Off + ifdSize(ifd0.length)
  const exifOff = ifd0DataOff + extSize(ifd0)
  const exifDataOff = exifOff + (exif.length ? ifdSize(exif.length) : 0)
  const total = exifDataOff + extSize(exif)

  const buf = new Uint8Array(total)
  const dv = new DataView(buf.buffer)
  buf.set([0x49, 0x49, 0x2a, 0x00]) // "II*\0"
  dv.setUint32(4, ifd0Off, true)

  const writeIfd = (list: Entry[], at: number, dataAt: number) => {
    dv.setUint16(at, list.length, true)
    let p = at + 2
    let d = dataAt
    for (const e of list) {
      dv.setUint16(p, e.tag, true)
      dv.setUint16(p + 2, e.type, true)
      if (e.value instanceof Uint8Array) {
        dv.setUint32(p + 4, e.value.length, true)
        if (e.value.length <= 4) buf.set(e.value, p + 8)
        else {
          dv.setUint32(p + 8, d, true)
          buf.set(e.value, d)
          d += e.value.length + (e.value.length & 1)
        }
      } else {
        dv.setUint32(p + 4, 1, true)
        dv.setUint32(p + 8, e.tag === 0x8769 ? exifOff : e.value, true)
      }
      p += 12
    }
    dv.setUint32(p, 0, true) // no next IFD
  }
  writeIfd(ifd0, ifd0Off, ifd0DataOff)
  if (exif.length) writeIfd(exif, exifOff, exifDataOff)
  return buf
}

export function hasAnyTag(f: TagFields): boolean {
  return Object.values(f).some((v) => typeof v === 'string' && v.trim() !== '')
}

/** Insert EXIF into a JPEG (expects no existing APP1 EXIF, i.e. a cleaned file). */
export function insertExifJpeg(jpeg: Uint8Array, tiff: Uint8Array): Uint8Array {
  if (jpeg[0] !== 0xff || jpeg[1] !== 0xd8) throw new Error('Not a JPEG file.')
  const payloadLen = 6 + tiff.length
  if (payloadLen + 2 > 0xffff) throw new Error('Tag data too large.')
  // Keep a leading JFIF APP0 first, as most readers expect.
  let at = 2
  if (jpeg[2] === 0xff && jpeg[3] === 0xe0) at = 4 + ((jpeg[4] << 8) | jpeg[5])
  const seg = new Uint8Array(4 + payloadLen)
  seg.set([0xff, 0xe1, ((payloadLen + 2) >> 8) & 0xff, (payloadLen + 2) & 0xff, 0x45, 0x78, 0x69, 0x66, 0, 0])
  seg.set(tiff, 10)
  const out = new Uint8Array(jpeg.length + seg.length)
  out.set(jpeg.subarray(0, at))
  out.set(seg, at)
  out.set(jpeg.subarray(at), at + seg.length)
  return out
}

/** Insert an eXIf chunk into a PNG, right before the first IDAT. */
export function insertExifPng(png: Uint8Array, tiff: Uint8Array): Uint8Array {
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
  if (!sig.every((b, i) => png[i] === b)) throw new Error('Not a PNG file.')
  const dv = new DataView(png.buffer, png.byteOffset, png.byteLength)
  let p = 8
  while (p + 8 <= png.length) {
    const len = dv.getUint32(p)
    const type = String.fromCharCode(png[p + 4], png[p + 5], png[p + 6], png[p + 7])
    if (type === 'IDAT') break
    p += 12 + len
  }
  if (p + 8 > png.length) throw new Error('PNG has no image data chunk.')
  const type = new Uint8Array([0x65, 0x58, 0x49, 0x66]) // eXIf
  const chunk = new Uint8Array(12 + tiff.length)
  const cv = new DataView(chunk.buffer)
  cv.setUint32(0, tiff.length)
  chunk.set(type, 4)
  chunk.set(tiff, 8)
  cv.setUint32(8 + tiff.length, crc32Of(type, tiff))
  const out = new Uint8Array(png.length + chunk.length)
  out.set(png.subarray(0, p))
  out.set(chunk, p)
  out.set(png.subarray(p), p + chunk.length)
  return out
}

export const TAGGABLE_FORMATS = ['jpeg', 'png'] as const

/** Apply tags to a cleaned blob. Returns a new Blob of the same type. */
export async function applyTags(blob: Blob, format: string, fields: TagFields): Promise<Blob> {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  const tiff = buildExif(fields)
  const out = format === 'jpeg' ? insertExifJpeg(bytes, tiff) : format === 'png' ? insertExifPng(bytes, tiff) : null
  if (!out) throw new Error('Only JPEG and PNG can be tagged.')
  return new Blob([out.buffer as ArrayBuffer], { type: blob.type })
}

/** "2026-11-09T12:48" (datetime-local) → "2026:11:09 12:48:00" */
export function toExifDate(local: string): string {
  const m = local.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/)
  return m ? `${m[1]}:${m[2]}:${m[3]} ${m[4]}:${m[5]}:${m[6] ?? '00'}` : ''
}
