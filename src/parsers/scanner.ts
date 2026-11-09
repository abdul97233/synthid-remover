import type { MarkerHit, ScanResult } from '../types'
import { matchesAscii } from './bytes'

/**
 * Evidence-based byte scanning.
 *
 * These searches look for *explicit, documented strings* that appear in the
 * metadata of AI-generated media (generator tags, C2PA manifests, IPTC
 * digital source types). This is honest, verifiable evidence — not a
 * statistical detector. Scroll-level SynthID watermarks are invisible,
 * model-embedded, and can NOT be detected from file bytes; the UI states
 * this plainly instead of fabricating results.
 */

interface Pattern {
  term: string
  label: string
  strength?: 'strong' | 'weak'
  /** Require non-letter characters around the match (avoids e.g. "imagen" in "ImageNumber"). */
  boundary?: boolean
}

const STRONG: Pattern[] = [
  { term: 'synthid', label: 'Explicit SynthID reference in file data', strength: 'strong' },
  { term: 'c2pa', label: 'C2PA / Content Credentials marker', strength: 'strong' },
  { term: 'jumbf', label: 'C2PA JUMBF container marker', strength: 'strong' },
  { term: 'contentcredentials', label: 'Content Credentials marker', strength: 'strong' },
  { term: 'urn:c2pa', label: 'C2PA claim URN', strength: 'strong' },
  { term: 'compositewithtrainedalgorithmicmedia', label: 'IPTC DigitalSourceType: composite with trained algorithmic media (AI-generated)', strength: 'strong' },
  { term: 'trainedalgorithmicmedia', label: 'IPTC DigitalSourceType: trained algorithmic media (AI-generated)', strength: 'strong', boundary: true },
  { term: 'regularwithtrainedalgorithmicmedia', label: 'IPTC DigitalSourceType: regular with trained algorithmic media', strength: 'strong' },
  { term: 'made with google ai', label: '"Made with Google AI" generator tag', strength: 'strong' },
  { term: 'digital source type', label: 'IPTC digital source type entry', strength: 'weak' },
  { term: 'x:xmpmeta', label: 'XMP metadata present (checked for generator tags)', strength: 'weak' },
]

const WEAK: Pattern[] = [
  { term: 'google ai', label: 'Google AI generator tag' },
  { term: 'imagen', label: 'Google Imagen tag', boundary: true },
  { term: 'gemini', label: 'Gemini tag', boundary: true },
  { term: 'midjourney', label: 'Midjourney tag' },
  { term: 'dall-e', label: 'OpenAI DALL·E tag' },
  { term: 'dall·e', label: 'OpenAI DALL·E tag' },
  { term: 'stable diffusion', label: 'Stable Diffusion tag' },
  { term: 'stablediffusion', label: 'Stable Diffusion tag' },
  { term: 'stability ai', label: 'Stability AI tag' },
  { term: 'adobe firefly', label: 'Adobe Firefly tag' },
  { term: 'firefly', label: 'Adobe Firefly tag', boundary: true },
  { term: 'runwayml', label: 'Runway tag' },
  { term: 'leonardo.ai', label: 'Leonardo.Ai tag' },
  { term: 'openai', label: 'OpenAI tag', boundary: true },
  { term: 'photoshop', label: 'Adobe Photoshop (editing history reference)', strength: 'weak' },
]

function extractContext(text: string, index: number, termLen: number): string {
  const from = Math.max(0, index - 56)
  const to = Math.min(text.length, index + termLen + 56)
  let context = text.slice(from, to)
  // Collapse unprintable chars for display purposes only.
  context = context
    .split('')
    .map((ch) => (ch.charCodeAt(0) >= 0x20 && ch.charCodeAt(0) <= 0x7e ? ch : '·'))
    .join('')
  return context.trim()
}

const PATTERNS: Pattern[] = [...STRONG, ...WEAK]

function isLower(ch: string | undefined): boolean {
  return ch !== undefined && ch >= 'a' && ch <= 'z'
}

/**
 * Index of the first acceptable occurrence of `p.term` in lower-cased `text`, or -1.
 * Boundary terms must not be glued to lowercase letters in the ORIGINAL text, so
 * "ImageNumber" / "compositeWithTrainedAlgorithmicMedia" are rejected while
 * "Gemini" directly followed by an uppercase ID3 frame id ("TIT2") still matches.
 */
function findTerm(text: string, original: string, p: Pattern): number {
  let idx = text.indexOf(p.term)
  if (!p.boundary) return idx
  while (idx !== -1) {
    if (!isLower(original[idx - 1]) && !isLower(original[idx + p.term.length])) return idx
    idx = text.indexOf(p.term, idx + 1)
  }
  return -1
}

function scanText(original: string, hits: MarkerHit[], source: MarkerHit['source']): void {
  const text = original.toLowerCase()
  for (const p of PATTERNS) {
    if (hits.some((h) => h.term === p.term)) continue
    const idx = findTerm(text, original, p)
    if (idx !== -1) {
      hits.push({
        term: p.term,
        label: p.label,
        strength: p.strength ?? 'weak',
        source,
        snippet: extractContext(original, idx, p.term.length),
      })
    }
  }
}

/**
 * Chunked case-insensitive search over the whole file with overlapping
 * windows so matches at chunk borders cannot be missed. Each window is also
 * searched with NUL bytes removed, which catches UTF-16 text (common in ID3
 * frames and EXIF XP* tags). `extraTexts` are decoded payloads that are not
 * visible in the raw bytes (e.g. inflated PNG zTXt chunks).
 */
export async function scanBytes(
  bytes: Uint8Array,
  onProgress?: (percent: number) => void,
  extraTexts: string[] = [],
): Promise<ScanResult> {
  const CHUNK = 8 * 1024 * 1024
  // Longest term is < 40 chars; UTF-16 text doubles that, so 128 bytes of overlap is safe.
  const OVERLAP = 128
  const decoder = new TextDecoder('latin1')
  const hits: MarkerHit[] = []

  for (let start = 0; start < bytes.length; start += CHUNK) {
    const end = Math.min(bytes.length, start + CHUNK + OVERLAP)
    const text = decoder.decode(bytes.subarray(start, end))
    scanText(text, hits, 'file bytes')
    if (hits.length < PATTERNS.length && text.includes('\0')) {
      scanText(text.replace(/\0/g, ''), hits, 'file bytes')
    }
    onProgress?.(Math.min(99, Math.round((end / bytes.length) * 100)))
    // Yield so progress messages flush and cancellation can be observed.
    if (end < bytes.length) await new Promise((r) => setTimeout(r, 0))
  }
  for (const extra of extraTexts) scanText(extra, hits, 'metadata')

  // The whole file was scanned, so report it honestly.
  return { hits, bytesScanned: bytes.length, totalBytes: bytes.length }
}

/** Quick magic-byte presence check used by the UI too. */
export function quickC2paCheck(bytes: Uint8Array): boolean {
  return ['c2pa', 'jumbf'].some((t) => matchesAscii(bytes, 0, t) || bytesContains(bytes, t))
}

function bytesContains(bytes: Uint8Array, needle: string): boolean {
  const n = needle.length
  const limit = bytes.length - n
  const first = needle.charCodeAt(0)
  for (let i = 0; i <= limit; i++) {
    if (bytes[i] !== first) continue
    if (matchesAscii(bytes, i, needle)) return true
  }
  return false
}
