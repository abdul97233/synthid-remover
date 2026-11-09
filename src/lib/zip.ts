/**
 * Minimal ZIP writer (STORE method, no compression). Media files are already
 * compressed, so deflating them would cost CPU for ~0% gain. The archive is
 * assembled as a Blob from the original parts, so file bytes are never copied
 * into one giant buffer.
 */

const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

function crc32(data: Uint8Array, crc = 0xffffffff): number {
  for (let i = 0; i < data.length; i++) crc = CRC_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8)
  return crc
}

/** Standard CRC-32 of a byte array (as used by ZIP and PNG). */
export function crc32Of(...chunks: Uint8Array[]): number {
  let crc = 0xffffffff
  for (const c of chunks) crc = crc32(c, crc)
  return (crc ^ 0xffffffff) >>> 0
}

async function blobCrc(blob: Blob): Promise<number> {
  const CHUNK = 8 * 1024 * 1024
  let crc = 0xffffffff
  for (let off = 0; off < blob.size; off += CHUNK) {
    crc = crc32(new Uint8Array(await blob.slice(off, off + CHUNK).arrayBuffer()), crc)
  }
  return (crc ^ 0xffffffff) >>> 0
}

function dosDateTime(d: Date): { time: number; date: number } {
  return {
    time: (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2),
    date: (Math.max(0, d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  }
}

/** Make names unique inside the archive: a.jpg, a (2).jpg, ... */
function uniqueNames(names: string[]): string[] {
  const seen = new Map<string, number>()
  return names.map((name) => {
    const key = name.toLowerCase()
    const n = (seen.get(key) ?? 0) + 1
    seen.set(key, n)
    if (n === 1) return name
    const dot = name.lastIndexOf('.')
    return dot > 0 ? `${name.slice(0, dot)} (${n})${name.slice(dot)}` : `${name} (${n})`
  })
}

export const ZIP_MAX_BYTES = 0xfffffffe // classic ZIP (no ZIP64) limit

export async function createZip(entries: { name: string; blob: Blob }[]): Promise<Blob> {
  const total = entries.reduce((s, e) => s + e.blob.size, 0)
  if (total >= ZIP_MAX_BYTES) throw new Error('Too large for a single ZIP (over 4 GB). Download files individually.')

  const enc = new TextEncoder()
  const names = uniqueNames(entries.map((e) => e.name))
  const { time, date } = dosDateTime(new Date())
  const parts: BlobPart[] = []
  const central: Uint8Array<ArrayBuffer>[] = []
  let offset = 0

  for (let i = 0; i < entries.length; i++) {
    const nameBytes = enc.encode(names[i])
    const { blob } = entries[i]
    const crc = await blobCrc(blob)

    const local = new Uint8Array(30 + nameBytes.length)
    const lv = new DataView(local.buffer)
    lv.setUint32(0, 0x04034b50, true)
    lv.setUint16(4, 20, true) // version needed
    lv.setUint16(6, 0x0800, true) // UTF-8 names
    lv.setUint16(8, 0, true) // STORE
    lv.setUint16(10, time, true)
    lv.setUint16(12, date, true)
    lv.setUint32(14, crc, true)
    lv.setUint32(18, blob.size, true)
    lv.setUint32(22, blob.size, true)
    lv.setUint16(26, nameBytes.length, true)
    local.set(nameBytes, 30)

    const cd = new Uint8Array(46 + nameBytes.length)
    const cv = new DataView(cd.buffer)
    cv.setUint32(0, 0x02014b50, true)
    cv.setUint16(4, 20, true)
    cv.setUint16(6, 20, true)
    cv.setUint16(8, 0x0800, true)
    cv.setUint16(10, 0, true)
    cv.setUint16(12, time, true)
    cv.setUint16(14, date, true)
    cv.setUint32(16, crc, true)
    cv.setUint32(20, blob.size, true)
    cv.setUint32(24, blob.size, true)
    cv.setUint16(28, nameBytes.length, true)
    cv.setUint32(42, offset, true)
    cd.set(nameBytes, 46)

    parts.push(local, blob)
    central.push(cd)
    offset += local.length + blob.size
  }

  const cdSize = central.reduce((s, c) => s + c.length, 0)
  const end = new Uint8Array(22)
  const ev = new DataView(end.buffer)
  ev.setUint32(0, 0x06054b50, true)
  ev.setUint16(8, entries.length, true)
  ev.setUint16(10, entries.length, true)
  ev.setUint32(12, cdSize, true)
  ev.setUint32(16, offset, true)

  return new Blob([...parts, ...central, end], { type: 'application/zip' })
}
