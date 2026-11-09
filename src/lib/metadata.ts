import type { MarkerHit, MetadataEntry } from '../types'

/**
 * EXIF / XMP / IPTC inspection for images via exifr (lazy-loaded in the
 * browser, ~40 kB gzipped, runs fully offline against the local File).
 */

interface GeneratorTerm {
  term: string
  label: string
}

const GENERATOR_TERMS: GeneratorTerm[] = [
  { term: 'synthid', label: 'SynthID reference in metadata' },
  { term: 'c2pa', label: 'C2PA / Content Credentials entry in metadata' },
  { term: 'jumbf', label: 'C2PA JUMBF entry in metadata' },
  { term: 'trainedalgorithmicmedia', label: 'IPTC DigitalSourceType: trained algorithmic media (AI-generated)' },
  { term: 'compositewithtrainedalgorithmicmedia', label: 'IPTC DigitalSourceType: composite with AI media' },
  { term: 'made with google ai', label: '"Made with Google AI" tag' },
  { term: 'gemini', label: 'Gemini tag' },
  { term: 'imagen', label: 'Google Imagen tag' },
  { term: 'midjourney', label: 'Midjourney tag' },
  { term: 'dall-e', label: 'OpenAI DALL·E tag' },
  { term: 'dall·e', label: 'OpenAI DALL·E tag' },
  { term: 'stable diffusion', label: 'Stable Diffusion tag' },
  { term: 'stablediffusion', label: 'Stable Diffusion tag' },
  { term: 'stability ai', label: 'Stability AI tag' },
  { term: 'adobe firefly', label: 'Adobe Firefly tag' },
  { term: 'firefly', label: 'Adobe Firefly tag' },
  { term: 'runwayml', label: 'Runway tag' },
  { term: 'leonardo.ai', label: 'Leonardo.Ai tag' },
  { term: 'openai', label: 'OpenAI tag' },
  { term: 'digitalsourcetype', label: 'IPTC digital source type entry' },
]

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '—'
  if (value instanceof Date) return value.toISOString().replace('T', ' ').replace(/Z$/, ' UTC')
  if (Array.isArray(value)) return value.map((v) => formatValue(v)).join(', ')
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value, (_k, v) => (typeof v === 'bigint' ? String(v) : v), 0).slice(0, 240)
    } catch {
      return String(value)
    }
  }
  if (typeof value === 'number') {
    const rounded = Math.round(value * 10000) / 10000
    return String(rounded)
  }
  return String(value).slice(0, 400)
}

function flatten(parsed: Record<string, unknown>, maxEntries = 300): MetadataEntry[] {
  const entries: MetadataEntry[] = []
  for (const [rawKey, rawValue] of Object.entries(parsed)) {
    const key = rawKey
    let group = 'EXIF'
    if (rawKey.includes(':')) {
      group = rawKey.split(':')[0].replace(/\d+$/, '').toUpperCase() || 'XMP'
    } else if (/^(DRM|HTML|CSS|SVG|JUMBF|c2pa)/i.test(rawKey)) {
      group = 'Container'
    }
    const groupName: Record<string, string> = {
      EXIF: 'EXIF',
      XMP: 'XMP',
      IPTC: 'IPTC',
      MPF: 'Multi-picture',
      ICC: 'ICC',
      JFIF: 'JFIF',
      DAR: 'Container',
      Container: 'Container',
    }
    entries.push({ group: groupName[group] ?? group, key, value: formatValue(rawValue) })
    if (entries.length >= maxEntries) break
  }
  return entries
}

/** Short generic words must not match inside longer identifiers ("imagen" in "ImageNumber"). */
const BOUNDARY_TERMS = new Set(['imagen', 'gemini', 'firefly', 'openai', 'trainedalgorithmicmedia'])

/** `text` is lower-cased; `original` is the same string before lower-casing (equal length). */
function findWord(text: string, original: string, term: string): number {
  let idx = text.indexOf(term)
  if (!BOUNDARY_TERMS.has(term)) return idx
  const isLower = (ch: string | undefined) => ch !== undefined && ch >= 'a' && ch <= 'z'
  while (idx !== -1) {
    if (!isLower(original[idx - 1]) && !isLower(original[idx + term.length])) return idx
    idx = text.indexOf(term, idx + 1)
  }
  return -1
}

export interface ImageMetadataResult {
  entries: MetadataEntry[]
  hints: MarkerHit[]
  orientation?: number
}

export async function extractImageMetadata(file: File): Promise<ImageMetadataResult> {
  const exifr = await import('exifr')
  try {
    const parsed = (await exifr.parse(file, {
      exif: true,
      iptc: true,
      xmp: true,
      translateValues: true,
      reviveValues: false,
    })) as Record<string, unknown> | undefined

    if (!parsed) return { entries: [], hints: [] }

    const original = JSON.stringify(parsed, (_k, v) => (typeof v === 'bigint' ? String(v) : v)) ?? ''
    const serialized = original.toLowerCase()
    const hits: MarkerHit[] = []
    for (const { term, label } of GENERATOR_TERMS) {
      if (hits.some((h) => h.term === term)) continue
      const idx = findWord(serialized, original, term)
      if (idx !== -1) {
        hits.push({
          term,
          label,
          strength: term === 'synthid' || term.includes('algorithmicmedia') || term === 'c2pa' || term.startsWith('made with') ? 'strong' : 'weak',
          source: 'metadata',
          snippet: serialized
            .slice(Math.max(0, idx - 48), idx + term.length + 48)
            .replace(/[^a-z0-9 .,:%@/+-·]/gi, ' ')
            .trim(),
        })
      }
    }

    // translateValues turns Orientation into text ("Rotate 90 CW"), so read the raw number separately.
    let orientation: number | undefined
    try {
      const raw = await exifr.orientation(file)
      orientation = typeof raw === 'number' ? raw : undefined
    } catch {
      orientation = undefined
    }
    return { entries: flatten(parsed), hints: hits, orientation }
  } catch {
    // Never let a corrupt metadata block fail the whole analysis.
    return { entries: [], hints: [] }
  }
}
