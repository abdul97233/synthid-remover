/** Shared low-level byte helpers for all format parsers. */

export function readAscii(bytes: Uint8Array, start: number, length: number): string {
  let out = ''
  for (let i = 0; i < length && start + i < bytes.length; i++) {
    out += String.fromCharCode(bytes[start + i])
  }
  return out
}

export function matchesAscii(bytes: Uint8Array, start: number, text: string): boolean {
  if (start + text.length > bytes.length) return false
  for (let i = 0; i < text.length; i++) {
    if (bytes[start + i] !== text.charCodeAt(i)) return false
  }
  return true
}

export function isPrintableText(bytes: Uint8Array, start: number, length: number): boolean {
  const end = Math.min(bytes.length, start + length)
  for (let i = start; i < end; i++) {
    const b = bytes[i]
    if (b === 0) continue
    if (b < 0x20 || b > 0x7e) return false
  }
  return true
}

/** Concatenate byte ranges into one exact-size buffer. */
export function concatParts(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, p) => n + p.length, 0)
  const out = new Uint8Array(total)
  let offset = 0
  for (const p of parts) {
    out.set(p, offset)
    offset += p.length
  }
  return out
}

/** Fix the RIFF container size field (bytes 4..8, little-endian). */
export function fixRiffSizeLE(bytes: Uint8Array): void {
  writeUint32LE(bytes, 4, bytes.length - 8)
}

/** Write a big-endian uint32 into a buffer. */
export function writeUint32BE(bytes: Uint8Array, offset: number, value: number): void {
  new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).setUint32(offset, value >>> 0, false)
}

export function writeUint32LE(bytes: Uint8Array, offset: number, value: number): void {
  new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).setUint32(offset, value >>> 0, true)
}

/** Write a 64-bit big-endian value (Number must be < 2^53). */
export function writeUint64BE(bytes: Uint8Array, offset: number, value: number): void {
  new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).setBigUint64(offset, BigInt(Math.floor(value)), false)
}

/** Short printable description of unknown/odd box content, if printable. */
export function describeBytes(bytes: Uint8Array, start: number, length: number, max = 48): string | undefined {
  const end = Math.min(bytes.length, start + length)
  if (!isPrintableText(bytes, start, Math.min(length, 64))) return undefined
  let text = ''
  for (let i = start; i < end && text.length < max; i++) {
    const b = bytes[i]
    if (b === 0) { text += ' '; continue }
    text += String.fromCharCode(b)
  }
  text = text.trim()
  return text.length ? text.slice(0, max) : undefined
}

