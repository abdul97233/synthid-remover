import type { FileItem } from '../types'
import { downloadBlob } from './download'
import { getPreferences } from './preferences'
import { createZip } from './zip'
import { isEvidenceHit } from '../hooks/useMediaProcessor'

/** Apply the user's naming preference to a cleaned filename ("x-cleaned.jpg"). */
export function outputName(filename: string): string {
  if (getPreferences().naming === 'suffix') return filename
  return filename.replace(/-cleaned(?=\.[^.]+$)/, '')
}

export function downloadCleaned(item: FileItem): void {
  if (item.clean) downloadBlob(item.clean.blob, outputName(item.clean.filename))
}

/** One cleaned file → direct download; several → a single ZIP. */
export async function downloadAllCleaned(items: FileItem[]): Promise<void> {
  const cleaned = items.filter((i) => i.clean)
  if (cleaned.length === 0) return
  if (cleaned.length === 1) return downloadCleaned(cleaned[0])
  const zip = await createZip(cleaned.map((i) => ({ name: outputName(i.clean!.filename), blob: i.clean!.blob })))
  const stamp = new Date().toISOString().slice(0, 10)
  downloadBlob(zip, `cleaned-files-${stamp}.zip`)
}

// ---------- Web Share (phones) ----------

export function canShareFiles(): boolean {
  try {
    const probe = new File([new Uint8Array(1)], 'x.jpg', { type: 'image/jpeg' })
    return typeof navigator.share === 'function' && !!navigator.canShare?.({ files: [probe] })
  } catch {
    return false
  }
}

export async function shareCleaned(item: FileItem): Promise<void> {
  if (!item.clean) return
  const file = new File([item.clean.blob], outputName(item.clean.filename), { type: item.clean.mime })
  if (!navigator.canShare?.({ files: [file] })) throw new Error('Sharing this file type is not supported here.')
  try {
    await navigator.share({ files: [file], title: file.name })
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') return // user closed the sheet
    throw e
  }
}

// ---------- Privacy insights ----------

const LOCATION_KEY = /gps|latitude|longitude|location|©xyz|geotag/i
const DEVICE_KEY = /^(make|model|lensmodel|lens|bodyserialnumber|serialnumber|cameraownername|ownername|artist|creator|author|copyright|software|hostcomputer)$/i

export interface Insights {
  aiFound: boolean
  c2pa: boolean
  location: boolean
  device: boolean
  removedCount: number
  removedBytes: number
}

export function insightsOf(item: FileItem): Insights {
  const meta = item.metadata ?? []
  const structure = item.structure?.entries ?? []
  return {
    aiFound: item.analysis?.determination === 'found' || !!item.analysis?.scan.hits.some(isEvidenceHit),
    c2pa: !!item.analysis?.c2paPresent,
    location: meta.some((m) => LOCATION_KEY.test(m.key) || m.group.toUpperCase() === 'GPS') ||
      structure.some((s) => LOCATION_KEY.test(s.name)),
    device: meta.some((m) => DEVICE_KEY.test(m.key.replace(/^.*:/, ''))),
    removedCount: item.clean?.removed.length ?? 0,
    removedBytes: item.clean ? item.clean.removed.reduce((s, r) => s + r.size, 0) : 0,
  }
}

// ---------- Report export ----------

export function downloadReport(items: FileItem[]): void {
  const report = {
    generator: 'SynthID Remover (local analysis — nothing was uploaded)',
    createdAt: new Date().toISOString(),
    note: 'Metadata analysis only. Pixel-level SynthID watermarks cannot be detected or removed locally.',
    files: items.map((i) => {
      const ins = insightsOf(i)
      return {
        name: i.file.name,
        size: i.file.size,
        format: i.info?.format ?? null,
        status: i.status,
        error: i.error ?? null,
        determination: i.analysis?.determination ?? null,
        undeterminedReason: i.analysis?.undeterminedReason ?? null,
        c2paPresent: ins.c2pa,
        digitalSourceType: i.analysis?.digitalSourceType ?? null,
        locationDataFound: ins.location,
        deviceInfoFound: ins.device,
        markers: (i.analysis?.scan.hits ?? []).map((h) => ({ label: h.label, term: h.term, strength: h.strength, source: h.source })),
        metadata: i.metadata ?? [],
        cleaned: i.clean
          ? { filename: outputName(i.clean.filename), size: i.clean.size, removed: i.clean.removed, notes: i.clean.notes }
          : null,
      }
    }),
  }
  const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' })
  downloadBlob(blob, `metadata-report-${new Date().toISOString().slice(0, 10)}.json`)
}
