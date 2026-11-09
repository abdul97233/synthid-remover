import type { AnalysisResult, CleanResult, FileItem, MediaKind } from '../../types'
import type { Tone } from '../ui/Badge'
import { kindOfExtension } from '../../lib/constants'

/** Kind from decoded info, falling back to the extension before analysis completes. */
export function kindOf(item: FileItem): MediaKind {
  return item.info?.kind ?? kindOfExtension(item.file.name) ?? 'image'
}

export function isBusy(item: FileItem): boolean {
  return item.status === 'analyzing' || item.status === 'cleaning'
}

/** The three honest verdict states shown in the UI. */
export type Verdict = 'found' | 'none-found' | 'undetermined'

export interface VerdictInfo {
  verdict: Verdict
  /** Why the result cannot be determined (only for "undetermined"). */
  reason?: string
}

/**
 * Map an analysis to one of three states. Metadata evidence that *was* found
 * stays "found" even on a partial scan; an absence of markers is only reported
 * as "none found" when the whole file was actually inspected.
 */
export function verdictOf(analysis: AnalysisResult | undefined, item?: FileItem): VerdictInfo {
  if (!analysis) {
    if (item?.status === 'error') {
      return {
        verdict: 'undetermined',
        reason: item.error ? `The analysis could not finish: ${item.error}` : 'The analysis could not finish.',
      }
    }
    return { verdict: 'undetermined', reason: 'This file has not been analyzed yet.' }
  }
  const det = analysis.determination as string
  const extra = analysis as AnalysisResult & { reason?: string; undeterminedReason?: string }
  if (det === 'found') return { verdict: 'found' }
  if (det !== 'none-found') {
    return {
      verdict: 'undetermined',
      reason: extra.reason ?? extra.undeterminedReason ?? 'The file could not be inspected reliably.',
    }
  }
  const { scan } = analysis
  const partial = scan.truncated || (scan.totalBytes > 0 && scan.bytesScanned < scan.totalBytes)
  if (partial) {
    return {
      verdict: 'undetermined',
      reason: `Only part of the file could be scanned, so the absence of markers cannot be confirmed.`,
    }
  }
  if (item?.info?.format === 'unknown') {
    return {
      verdict: 'undetermined',
      reason: 'The file contents do not match a recognized format, so its metadata could not be read reliably.',
    }
  }
  return { verdict: 'none-found' }
}

export function statusOf(item: FileItem): { tone: Tone; label: string; busy: boolean } {
  if (item.status === 'error') return { tone: 'danger', label: 'Error', busy: false }
  if (item.status === 'analyzing')
    return { tone: 'primary', label: item.progress > 0 && item.progress < 100 ? `Analyzing ${item.progress}%` : 'Analyzing…', busy: true }
  if (item.status === 'cleaning') return { tone: 'accent', label: 'Cleaning…', busy: true }
  if (item.status === 'ready' && item.analysis) {
    const v = verdictOf(item.analysis, item).verdict
    if (v === 'found') return { tone: 'warn', label: 'Indicators found', busy: false }
    if (v === 'undetermined') return { tone: 'neutral', label: 'Undetermined', busy: false }
    return { tone: 'ok', label: 'No indicators', busy: false }
  }
  if (item.status === 'ready') return { tone: 'ok', label: 'Ready', busy: false }
  return { tone: 'neutral', label: 'Queued', busy: false }
}

/** True when the cleaned copy came from the lossy canvas re-encode path. */
export function isLossyClean(clean: CleanResult): boolean {
  return (
    clean.removed.some((r) => /canvas re-encode/i.test(r.label)) ||
    clean.notes.some((n) => /lossy re-compression|re-encoded through the browser canvas/i.test(n))
  )
}
