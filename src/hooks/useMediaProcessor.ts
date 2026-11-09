import { useCallback, useEffect, useRef, useState } from 'react'
import type { FileItem, AnalysisResult, MarkerHit, MediaFormat } from '../types'
import { scanFile, stripFile, isAbortError } from '../lib/workerClient'
import { extractImageMetadata } from '../lib/metadata'
import { probeMedia, buildMediaInfo, type ProbeResult } from '../lib/probe'
import { bakeOrientation, type CanvasFormat } from '../lib/reencode'
import { splitName } from '../lib/format'
import { EXT_BY_FORMAT, FORMAT_MIME, kindOfExtension } from '../lib/constants'
import type { ScanWorkerResult, StripWorkerResult } from '../types/worker'

/**
 * Central client-side processing state:
 * every operation runs locally, files are independent, originals never
 * change, and generated blobs live only in memory until downloaded.
 */

function createItem(file: File): FileItem {
  return {
    id: crypto.randomUUID(),
    file,
    status: 'idle',
    progress: 0,
  }
}

function dedupeHints(a: MarkerHit[], b: MarkerHit[]): MarkerHit[] {
  const merged: MarkerHit[] = []
  for (const hit of [...a, ...b]) {
    if (!merged.some((h) => h.term === hit.term && h.source === hit.source)) merged.push(hit)
  }
  return merged
}

/**
 * Hits that are context only — they say metadata *exists*, not that the file
 * is AI-generated (any camera/Lightroom file has XMP, any edited file may
 * mention Photoshop, a DigitalSourceType key may hold "digitalCapture").
 */
const INFORMATIONAL_TERMS = new Set(['x:xmpmeta', 'photoshop', 'digital source type', 'digitalsourcetype'])

export function isEvidenceHit(hit: MarkerHit): boolean {
  return !INFORMATIONAL_TERMS.has(hit.term)
}

/** Output filename with the extension of the real (magic-byte) format. */
function cleanedName(name: string, format: MediaFormat): string {
  const { base, ext } = splitName(name)
  if (format === 'unknown') return ext ? `${base}-cleaned.${ext}` : `${base}-cleaned`
  const real = EXT_BY_FORMAT[format]
  const keep = ext === real || (format === 'jpeg' && ext === 'jpeg')
  return `${base}-cleaned.${keep ? ext : real}`
}

function canvasExt(mime: string, fallback: CanvasFormat): string {
  if (mime === 'image/png') return 'png'
  if (mime === 'image/webp') return 'webp'
  if (mime === 'image/jpeg') return 'jpg'
  return fallback === 'jpeg' ? 'jpg' : fallback
}

export function useMediaProcessor() {
  const [items, setItems] = useState<FileItem[]>([])
  const itemsRef = useRef(items)
  itemsRef.current = items
  /** One AbortController per running operation, keyed "<id>:<op>". */
  const controllers = useRef(new Map<string, AbortController>())

  const begin = useCallback((id: string, op: 'analyze' | 'clean'): AbortSignal => {
    const key = `${id}:${op}`
    controllers.current.get(key)?.abort() // a newer run supersedes an older one
    const controller = new AbortController()
    controllers.current.set(key, controller)
    return controller.signal
  }, [])

  const finish = useCallback((id: string, op: 'analyze' | 'clean', signal: AbortSignal) => {
    const key = `${id}:${op}`
    const current = controllers.current.get(key)
    if (current && current.signal === signal) controllers.current.delete(key)
  }, [])

  const abortItem = useCallback((id: string) => {
    for (const op of ['analyze', 'clean'] as const) {
      const key = `${id}:${op}`
      controllers.current.get(key)?.abort()
      controllers.current.delete(key)
    }
  }, [])

  useEffect(() => {
    const map = controllers.current
    return () => {
      for (const c of map.values()) c.abort()
      map.clear()
    }
  }, [])

  const update = useCallback((id: string, patch: Partial<FileItem> | ((prev: FileItem) => Partial<FileItem>)) => {
    setItems((prev) => {
      const next = prev.map((item) => {
        if (item.id !== id) return item
        const delta = typeof patch === 'function' ? patch(item) : patch
        return { ...item, ...delta }
      })
      itemsRef.current = next
      return next
    })
  }, [])

  const analyze = useCallback(
    async (item: FileItem) => {
      const { id, file } = item
      const signal = begin(id, 'analyze')

      update(id, { status: 'analyzing', progress: 0, error: undefined })

      try {
        // Provisional kind from the extension; the worker reports the real one from magic bytes.
        const extKind = kindOfExtension(file.name) ?? 'image'

        const scanPromise = scanFile(
          file,
          (p) => {
            if (!signal.aborted) update(id, { progress: Math.round(p * 0.85) })
          },
          signal,
        )
        const probePromise = probeMedia(file, extKind)

        const scanResult: ScanWorkerResult = await scanPromise
        if (signal.aborted) return
        const kind = scanResult.kind ?? extKind

        let metadataEntries: FileItem['metadata'] = undefined
        let metaHints: MarkerHit[] = []
        if (kind === 'image') {
          try {
            const meta = await extractImageMetadata(file)
            metadataEntries = meta.entries.length ? meta.entries : undefined
            metaHints = meta.hints
          } catch {
            /* metadata is optional */
          }
        }

        let probe: ProbeResult = await probePromise
        // Wrong extension (e.g. an MP3 named .jpg): probe again with the real kind.
        if (kind !== extKind) probe = await probeMedia(file, kind)
        if (signal.aborted) return

        const hints = dedupeHints(scanResult.scan.hits, metaHints)
        const evidence = hints.filter(isEvidenceHit)
        const parseError = scanResult.structure.parseError
        const determination: AnalysisResult['determination'] =
          evidence.length > 0 ? 'found' : parseError ? 'undetermined' : 'none-found'
        const analysis: AnalysisResult = {
          scan: scanResult.scan,
          determination,
          undeterminedReason:
            determination === 'undetermined'
              ? `The file's container could not be parsed (${parseError}), so embedded metadata could not be inspected reliably.`
              : undefined,
          c2paPresent: hints.some((h) => ['c2pa', 'jumbf', 'contentcredentials', 'urn:c2pa'].includes(h.term)),
          synthIdMentioned: hints.some((h) => h.term === 'synthid'),
          digitalSourceType:
            [...new Set(hints.filter((h) => h.term.includes('algorithmicmedia')).map((h) => h.label.replace(/^IPTC DigitalSourceType:\s*/, '')))].join('; ') ||
            undefined,
          hints,
        }

        const info = buildMediaInfo(file, kind, scanResult.format, scanResult.mime, probe)

        update(id, {
          status: 'ready',
          progress: 100,
          analysis,
          structure: scanResult.structure,
          metadata: metadataEntries,
          info,
        })
      } catch (err) {
        if (isAbortError(err) || signal.aborted) return
        update(id, {
          status: 'error',
          error: err instanceof Error ? err.message : 'Analysis failed unexpectedly.',
          progress: 0,
        })
      } finally {
        finish(id, 'analyze', signal)
      }
    },
    [update, begin, finish],
  )

  const clean = useCallback(
    async (id: string) => {
      const item = itemsRef.current.find((i) => i.id === id)
      if (!item) return
      const signal = begin(id, 'clean')
      update(id, { status: 'cleaning', progress: 0, error: undefined })
      try {
        const result: StripWorkerResult = await stripFile(
          item.file,
          (p) => {
            if (!signal.aborted) update(id, { progress: p })
          },
          signal,
        )
        if (signal.aborted) return
        update(id, {
          status: 'ready',
          progress: 100,
          clean: {
            blob: result.blob,
            size: result.size,
            originalSize: item.file.size,
            removed: result.removed,
            notes: result.notes,
            filename: cleanedName(item.file.name, result.format),
            format: result.format,
            mime: result.mime,
          },
        })
      } catch (err) {
        if (isAbortError(err) || signal.aborted) return
        update(id, {
          status: 'error',
          error: `Cleaning failed: ${err instanceof Error ? err.message : 'unknown error'}`,
          progress: 0,
        })
      } finally {
        finish(id, 'clean', signal)
      }
    },
    [update, begin, finish],
  )

  const reencode = useCallback(
    async (id: string, target: CanvasFormat = 'jpeg') => {
      const item = itemsRef.current.find((i) => i.id === id)
      if (!item) return
      const signal = begin(id, 'clean')
      update(id, { status: 'cleaning', progress: 25, error: undefined })
      try {
        const blob = await bakeOrientation(item.file, target)
        if (signal.aborted) return
        const { base } = splitName(item.file.name)
        // Browsers silently fall back to PNG when they cannot encode the target type.
        const mime = blob.type || FORMAT_MIME[target]
        const ext = canvasExt(mime, target)
        const format: MediaFormat = ext === 'jpg' ? 'jpeg' : (ext as MediaFormat)
        update(id, {
          status: 'ready',
          progress: 100,
          clean: {
            blob,
            size: blob.size,
            originalSize: item.file.size,
            removed: [{ label: 'All metadata (canvas re-encode)', size: Math.max(0, item.file.size - blob.size) }],
            notes: [
              'Re-encoded through the browser Canvas API: every metadata record was discarded by construction.',
              'This is a lossy re-compression — pixels were recomputed, not copied. Use the lossless clean when possible.',
              'EXIF orientation, if any, is baked into the pixels of this copy.',
              ...(mime !== FORMAT_MIME[target] ? [`This browser cannot encode ${target.toUpperCase()}, so a ${ext.toUpperCase()} copy was produced instead.`] : []),
            ],
            filename: `${base}-cleaned.${ext}`,
            format,
            mime,
          },
        })
      } catch (err) {
        if (signal.aborted) return
        update(id, {
          status: 'error',
          error: `Re-encode failed: ${err instanceof Error ? err.message : 'unknown error'}`,
          progress: 0,
        })
      } finally {
        finish(id, 'clean', signal)
      }
    },
    [update, begin, finish],
  )

  const addFiles = useCallback(
    (files: File[]) => {
      const newItems = files.map(createItem)
      itemsRef.current = [...itemsRef.current, ...newItems]
      setItems((prev) => [...prev, ...newItems])
      // Kick off independent analyses immediately; the worker runs them one at a time.
      for (const item of newItems) void analyze(item)
    },
    [analyze],
  )

  const remove = useCallback(
    (id: string) => {
      abortItem(id) // stop queued / running work for this file
      itemsRef.current = itemsRef.current.filter((i) => i.id !== id)
      setItems((prev) => prev.filter((i) => i.id !== id))
    },
    [abortItem],
  )

  const clearAll = useCallback(() => {
    for (const item of itemsRef.current) abortItem(item.id)
    itemsRef.current = []
    setItems([])
  }, [abortItem])

  const isBusy = (item: FileItem) => item.status === 'analyzing' || item.status === 'cleaning'

  const analyzeAll = useCallback(async () => {
    for (const item of [...itemsRef.current]) {
      const current = itemsRef.current.find((i) => i.id === item.id)
      if (!current || isBusy(current)) continue // removed meanwhile, or already running
      await analyze(current)
    }
  }, [analyze])

  const cleanAll = useCallback(async () => {
    for (const item of [...itemsRef.current]) {
      const current = itemsRef.current.find((i) => i.id === item.id)
      if (!current || current.clean || isBusy(current)) continue
      // Files whose analysis failed (unsupported / unreadable) cannot be cleaned either.
      if (current.status === 'error' && !current.structure) continue
      await clean(current.id)
    }
  }, [clean])

  return {
    items,
    addFiles,
    remove,
    clearAll,
    analyze,
    clean,
    reencode,
    analyzeAll,
    cleanAll,
  }
}
