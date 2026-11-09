import type { MarkerHit, MetadataEntry, RemovedItem, StructureEntry } from '../types'
import type { PDFDocument, PDFObject, PDFRef } from 'pdf-lib'

/**
 * PDF metadata inspection and cleaning (pdf-lib, loaded lazily on first PDF).
 *
 * Cleans:
 *  - the document Info dictionary (Title, Author, Subject, Keywords, Creator,
 *    Producer, CreationDate, ModDate, custom keys)
 *  - every XMP /Metadata stream (document, pages, images…) and /PieceInfo
 *    (application private data) — the objects themselves are deleted, so
 *    nothing stays behind as an orphan in the file
 *  - utm_* tracking parameters in link URLs, which AI chat tools append to
 *    cited links (e.g. ?utm_source=chatgpt.com)
 * Page content (text, images, fonts) is copied unchanged.
 */

type PdfLib = typeof import('pdf-lib')
let lib: Promise<PdfLib> | null = null
const loadLib = () => (lib ??= import('pdf-lib'))

/** utm_source values that identify an AI assistant. */
const AI_SOURCE =
  /chatgpt|openai|perplexity|copilot|gemini|bard|claude|anthropic|deepseek|grok|x\.ai|meta\.ai|mistral|you\.com|phind|poe\.com|character\.ai/i

/** Producer / Creator values written by AI tools. */
const AI_TOOL =
  /\b(chatgpt|openai|gpt-?[345]|claude|anthropic|gemini|bard|copilot|perplexity|deepseek|grok|midjourney|dall[-·]?e|jasper|writesonic|gamma\.app|beautiful\.ai|tome\.app)\b/i

export interface PdfInspection {
  entries: StructureEntry[]
  notes: string[]
  metadata: MetadataEntry[]
  hits: MarkerHit[]
  /** Decoded text (Info values, XMP, link URLs) for the generic marker scanner. */
  texts: string[]
  encrypted: boolean
}

async function load(bytes: Uint8Array): Promise<{ L: PdfLib; doc: PDFDocument }> {
  const L = await loadLib()
  const doc = await L.PDFDocument.load(bytes, {
    ignoreEncryption: true,
    updateMetadata: false, // never stamp our own Producer / ModDate
    throwOnInvalidObject: false,
  })
  return { L, doc }
}

/** Visit every dict / array / stream dict inside an object (no ref following). */
function walk(L: PdfLib, obj: PDFObject | undefined, visit: (o: PDFObject) => void, depth = 0): void {
  if (!obj || depth > 64) return
  visit(obj)
  if (obj instanceof L.PDFDict) for (const [, v] of obj.entries()) walk(L, v, visit, depth + 1)
  else if (obj instanceof L.PDFArray) for (const v of obj.asArray()) walk(L, v, visit, depth + 1)
  else if (obj instanceof L.PDFStream) walk(L, obj.dict, visit, depth + 1)
}

function forEachObject(L: PdfLib, doc: PDFDocument, visit: (o: PDFObject) => void): void {
  for (const [, obj] of doc.context.enumerateIndirectObjects()) walk(L, obj, visit)
}

function textOf(L: PdfLib, o: PDFObject | undefined): string | null {
  if (o instanceof L.PDFString || o instanceof L.PDFHexString) return o.decodeText()
  if (o instanceof L.PDFName) return o.decodeText()
  return null
}

/** Remove utm_* query parameters; returns null when nothing changed. */
export function stripUtm(url: string): string | null {
  const q = url.indexOf('?')
  if (q === -1 || !/[?&]utm_[a-z]+=/i.test(url)) return null
  const hashAt = url.indexOf('#', q)
  const query = url.slice(q + 1, hashAt === -1 ? undefined : hashAt)
  const hash = hashAt === -1 ? '' : url.slice(hashAt)
  const kept = query.split('&').filter((p) => p && !/^utm_[a-z]+=/i.test(p))
  return url.slice(0, q) + (kept.length ? `?${kept.join('&')}` : '') + hash
}

function utmSource(url: string): string | null {
  const m = url.match(/[?&]utm_source=([^&#]+)/i)
  if (!m) return null
  try {
    return decodeURIComponent(m[1])
  } catch {
    return m[1]
  }
}

function sizeOf(L: PdfLib, o: PDFObject | undefined): number {
  return o instanceof L.PDFStream ? o.getContentsSize() : 0
}

export async function inspectPdf(bytes: Uint8Array): Promise<PdfInspection> {
  const { L, doc } = await load(bytes)
  const entries: StructureEntry[] = []
  const notes: string[] = []
  const metadata: MetadataEntry[] = []
  const hits: MarkerHit[] = []
  const texts: string[] = []
  const ctx = doc.context

  const header = new TextDecoder('latin1').decode(bytes.subarray(0, 16)).match(/%PDF-(\d\.\d)/)
  entries.push({ name: 'Header', description: `PDF ${header?.[1] ?? '?'} · ${doc.getPageCount()} page(s)`, offset: 0, size: 8, removable: false })

  if (doc.isEncrypted) {
    notes.push('This PDF is encrypted. Its metadata can be read but it cannot be cleaned safely without the password.')
  }

  // Document Info dictionary
  const infoObj = ctx.lookup(ctx.trailerInfo.Info)
  if (infoObj instanceof L.PDFDict) {
    let count = 0
    for (const [key, val] of infoObj.entries()) {
      const name = key.decodeText()
      let value = textOf(L, val)
      if (value === null) continue
      if (/Date$/.test(name)) {
        const d = name === 'CreationDate' ? doc.getCreationDate() : name === 'ModDate' ? doc.getModificationDate() : undefined
        if (d) value = d.toISOString()
      }
      count++
      metadata.push({ group: 'PDF Info', key: name, value })
      texts.push(`${name}: ${value}`)
      if ((name === 'Producer' || name === 'Creator') && AI_TOOL.test(value)) {
        hits.push({
          term: `pdf-${name.toLowerCase()}-ai`,
          label: `PDF ${name} names an AI tool: "${value.slice(0, 80)}"`,
          strength: 'strong',
          source: 'metadata',
          snippet: `${name}: ${value}`,
        })
      }
    }
    if (count) entries.push({ name: 'Info dictionary', description: `${count} field(s): ${metadata.map((m) => m.key).join(', ')}`, offset: 0, size: 0, removable: true })
  }

  // XMP metadata streams (document-level and on any other object)
  let xmpCount = 0
  let xmpBytes = 0
  forEachObject(L, doc, (o) => {
    if (!(o instanceof L.PDFDict)) return
    const ref = o.get(L.PDFName.of('Metadata'))
    const stream = ref instanceof L.PDFRef ? ctx.lookup(ref) : ref
    if (!(stream instanceof L.PDFRawStream)) return
    xmpCount++
    xmpBytes += stream.getContentsSize()
    try {
      const xml = new TextDecoder('utf-8').decode(L.decodePDFRawStream(stream).decode())
      texts.push(xml)
      if (xmpCount === 1) {
        for (const tag of ['xmp:CreatorTool', 'pdf:Producer', 'dc:creator', 'dc:title', 'xmp:CreateDate']) {
          const m = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`)) ?? xml.match(new RegExp(`${tag}="([^"]*)"`))
          const v = m?.[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
          if (v) metadata.push({ group: 'XMP', key: tag, value: v })
        }
      }
    } catch {
      /* undecodable stream — still removable */
    }
  })
  if (xmpCount) entries.push({ name: 'XMP metadata', description: `${xmpCount} stream(s)`, offset: 0, size: xmpBytes, removable: true })

  // Links: utm tracking parameters, especially from AI assistants
  let links = 0
  let tracked = 0
  const aiSources = new Map<string, number>()
  forEachObject(L, doc, (o) => {
    if (!(o instanceof L.PDFDict)) return
    const url = textOf(L, o.get(L.PDFName.of('URI')))
    if (!url) return
    links++
    texts.push(url)
    if (!/[?&]utm_[a-z]+=/i.test(url)) return
    tracked++
    const src = utmSource(url)
    if (src && AI_SOURCE.test(src)) aiSources.set(src, (aiSources.get(src) ?? 0) + 1)
    if (tracked <= 20) metadata.push({ group: 'Tracked links', key: `Link ${tracked}`, value: url })
  })
  if (links) {
    entries.push({
      name: 'Links',
      description: `${links} link(s)${tracked ? ` · ${tracked} with utm_ tracking` : ''}`,
      offset: 0,
      size: 0,
      removable: tracked > 0,
    })
  }
  for (const [src, n] of aiSources) {
    hits.push({
      term: `utm-ai:${src.toLowerCase()}`,
      label: `${n} link(s) tagged utm_source=${src} — added when links are copied from an AI assistant`,
      strength: 'strong',
      source: 'metadata',
      snippet: `utm_source=${src}`,
    })
  }

  // Application private data
  let piece = 0
  forEachObject(L, doc, (o) => {
    if (o instanceof L.PDFDict && o.has(L.PDFName.of('PieceInfo'))) piece++
  })
  if (piece) entries.push({ name: 'PieceInfo', description: `Application private data on ${piece} object(s)`, offset: 0, size: 0, removable: true })

  notes.push('Images embedded inside the PDF keep their own internal data; text, fonts and page layout are copied unchanged.')
  return { entries, notes, metadata, hits, texts, encrypted: doc.isEncrypted }
}

export async function stripPdf(bytes: Uint8Array): Promise<{ out: Uint8Array; removed: RemovedItem[]; notes: string[] }> {
  const { L, doc } = await load(bytes)
  if (doc.isEncrypted) throw new Error('This PDF is encrypted (password-protected), so it cannot be cleaned safely.')
  const ctx = doc.context
  const removed: RemovedItem[] = []
  const notes: string[] = []
  const toDelete = new Set<PDFRef>()

  // 1. Info dictionary
  const infoRef = ctx.trailerInfo.Info
  const info = ctx.lookup(infoRef)
  if (info instanceof L.PDFDict && info.entries().length) {
    removed.push({ label: `Document info (${info.entries().map(([k]) => k.decodeText()).join(', ')})`, size: 0 })
  }
  if (infoRef instanceof L.PDFRef) toDelete.add(infoRef)
  ctx.trailerInfo.Info = undefined

  // 2. XMP /Metadata and /PieceInfo everywhere
  let xmp = 0
  let xmpSize = 0
  let piece = 0
  const META = L.PDFName.of('Metadata')
  const PIECE = L.PDFName.of('PieceInfo')
  forEachObject(L, doc, (o) => {
    if (!(o instanceof L.PDFDict)) return
    const m = o.get(META)
    if (m) {
      xmp++
      xmpSize += sizeOf(L, m instanceof L.PDFRef ? ctx.lookup(m) : m)
      if (m instanceof L.PDFRef) toDelete.add(m)
      o.delete(META)
    }
    const p = o.get(PIECE)
    if (p) {
      piece++
      if (p instanceof L.PDFRef) toDelete.add(p)
      o.delete(PIECE)
    }
  })
  if (xmp) removed.push({ label: `XMP metadata (${xmp} stream${xmp === 1 ? '' : 's'})`, size: xmpSize })
  if (piece) removed.push({ label: `Application private data (PieceInfo ×${piece})`, size: 0 })

  // 3. utm_* tracking parameters in links
  let cleanedLinks = 0
  const aiSources = new Set<string>()
  const URI = L.PDFName.of('URI')
  forEachObject(L, doc, (o) => {
    if (!(o instanceof L.PDFDict)) return
    const url = textOf(L, o.get(URI))
    if (!url) return
    const next = stripUtm(url)
    if (next === null) return
    const src = utmSource(url)
    if (src && AI_SOURCE.test(src)) aiSources.add(src)
    o.set(URI, L.PDFString.of(next))
    cleanedLinks++
  })
  if (cleanedLinks) {
    removed.push({
      label: `utm_ tracking removed from ${cleanedLinks} link${cleanedLinks === 1 ? '' : 's'}${aiSources.size ? ` (incl. ${[...aiSources].join(', ')})` : ''}`,
      size: 0,
    })
  }

  for (const ref of toDelete) ctx.delete(ref)

  const out = await doc.save({ useObjectStreams: false, addDefaultPage: false, updateFieldAppearances: false })

  // Validate: the output must re-open, keep its pages, and carry none of the removed data.
  const check = await L.PDFDocument.load(out, { updateMetadata: false, throwOnInvalidObject: false })
  if (check.getPageCount() !== doc.getPageCount()) throw new Error('Validation failed: page count changed. The file was not modified.')
  if (check.context.lookup(check.context.trailerInfo.Info)) throw new Error('Validation failed: document info still present.')
  let leftovers = 0
  forEachObject(L, check, (o) => {
    if (o instanceof L.PDFDict && (o.has(META) || /[?&]utm_[a-z]+=/i.test(textOf(L, o.get(URI)) ?? ''))) leftovers++
  })
  if (leftovers) throw new Error('Validation failed: some metadata could not be removed. The file was not modified.')

  if (!removed.length) notes.push('No document metadata or tracked links were found — the cleaned copy is equivalent to the original.')
  notes.push('The PDF was rewritten with the same pages, text, fonts and images; only metadata objects and link tracking parameters were dropped.')
  notes.push('Images embedded inside the PDF keep their own internal data.')
  return { out, removed, notes }
}
