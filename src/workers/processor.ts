import type { ScanWorkerResult, StripWorkerResult } from '../types/worker'
import type { MediaFormat, RemovedItem, StructureEntry } from '../types'
import { detectFormat } from '../parsers/detect'
import { inspectJpeg, stripJpeg } from '../parsers/jpeg'
import { inspectPng, stripPng, pngCompressedTextPayloads } from '../parsers/png'
import { inspectWebp, stripWebp } from '../parsers/webp'
import { inspectMp3, stripMp3 } from '../parsers/mp3'
import { inspectWav, stripWav } from '../parsers/wav'
import { inspectMp4, stripMp4 } from '../parsers/mp4'
import { scanBytes } from '../parsers/scanner'

/**
 * Pure processing pipeline used by the Web Worker (kept free of worker
 * globals so it can be tested in isolation).
 */

interface Inspection {
  entries: StructureEntry[]
  notes: string[]
}

export function inspect(bytes: Uint8Array, format: MediaFormat): Inspection {
  switch (format) {
    case 'jpeg':
      return inspectJpeg(bytes)
    case 'png':
      return inspectPng(bytes)
    case 'webp':
      return inspectWebp(bytes)
    case 'mp3':
      return inspectMp3(bytes)
    case 'wav':
      return inspectWav(bytes)
    case 'mp4':
    case 'mov':
      return inspectMp4(bytes)
    default:
      return { entries: [], notes: ['Unknown format — no structure information available.'] }
  }
}

export function stripBytes(bytes: Uint8Array, format: MediaFormat): { out: Uint8Array; removed: RemovedItem[]; notes: string[] } {
  switch (format) {
    case 'jpeg':
      return stripJpeg(bytes)
    case 'png':
      return stripPng(bytes)
    case 'webp':
      return stripWebp(bytes)
    case 'mp3':
      return stripMp3(bytes)
    case 'wav':
      return stripWav(bytes)
    case 'mp4':
    case 'mov':
      return stripMp4(bytes)
    default:
      throw new Error('This format does not support cleaning.')
  }
}

/** Inflate zlib streams (PNG zTXt / compressed iTXt) so their text can be scanned. */
async function inflateTexts(payloads: Array<{ keyword: string; data: Uint8Array }>): Promise<string[]> {
  if (typeof DecompressionStream === 'undefined') return []
  const texts: string[] = []
  const MAX_TEXT = 16 * 1024 * 1024
  for (const { keyword, data } of payloads.slice(0, 64)) {
    try {
      const stream = new Blob([data as Uint8Array<ArrayBuffer>]).stream().pipeThrough(new DecompressionStream('deflate'))
      const reader = stream.getReader()
      const chunks: Uint8Array[] = []
      let total = 0
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        chunks.push(value)
        total += value.length
        if (total > MAX_TEXT) {
          await reader.cancel()
          break
        }
      }
      const merged = new Uint8Array(total > MAX_TEXT ? MAX_TEXT : total)
      let off = 0
      for (const c of chunks) {
        if (off >= merged.length) break
        merged.set(c.subarray(0, merged.length - off), off)
        off += c.length
      }
      texts.push(`${keyword}: ${new TextDecoder('utf-8').decode(merged)}`)
    } catch {
      /* corrupt stream — the raw-byte scan still covers the chunk */
    }
  }
  return texts
}

export type ProgressFn = (percent: number) => void

export async function scanArrayBuffer(bytes: Uint8Array, name: string, progress: ProgressFn): Promise<ScanWorkerResult> {
  const { format, mime, kind } = detectFormat(bytes, name)
  progress(4)

  let structure: Inspection
  let parseError: string | undefined
  try {
    structure = inspect(bytes, format)
  } catch (err) {
    // Degrade gracefully: the raw byte scan below still runs over the whole file.
    parseError = err instanceof Error ? err.message : 'The container could not be parsed.'
    structure = {
      entries: [],
      notes: [`The ${format.toUpperCase()} structure could not be parsed (${parseError}). The raw bytes were still scanned for markers.`],
    }
  }
  progress(12)

  const extra = format === 'png' ? await inflateTexts(pngCompressedTextPayloads(bytes)) : []
  const scan = await scanBytes(bytes, (p) => progress(12 + Math.round(p * 0.87)), extra)
  progress(100)

  return { scan, structure: { ...structure, format, mime, parseError }, format, mime, kind }
}

export function stripArrayBuffer(bytes: Uint8Array, name: string): StripWorkerResult {
  const { format, mime } = detectFormat(bytes, name)
  const { out, removed, notes } = stripBytes(bytes, format)
  // Blob copies exactly the view's range, so no intermediate copy is needed.
  const blob = new Blob([out as Uint8Array<ArrayBuffer>], { type: mime })
  return { blob, size: blob.size, removed, notes, mime, format }
}
