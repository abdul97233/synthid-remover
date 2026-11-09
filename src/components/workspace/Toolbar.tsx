import { ScanSearch, Eraser, Download, Trash2, Files } from 'lucide-react'
import type { FileItem } from '../../types'
import { Button } from '../ui/Button'
import { Spinner } from '../ui/Spinner'
import { isBusy, verdictOf } from './utils'

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted">
      <span className={`size-1.5 rounded-full ${tone}`} aria-hidden="true" />
      <span className="font-semibold text-foreground tabular-nums">{value}</span> {label}
    </span>
  )
}

/** Compact batch toolbar: counts + batch actions. */
export function WorkspaceToolbar({
  items,
  batchRunning,
  onAnalyzeAll,
  onCleanAll,
  onDownloadAll,
  onClear,
}: {
  items: FileItem[]
  batchRunning: boolean
  onAnalyzeAll: () => void
  onCleanAll: () => void
  onDownloadAll: () => void
  onClear: () => void
}) {
  const working = items.filter(isBusy).length
  const found = items.filter((i) => i.analysis && verdictOf(i.analysis, i).verdict === 'found').length
  const cleaned = items.filter((i) => i.clean).length
  const uncleaned = items.filter((i) => !i.clean).length
  const errors = items.filter((i) => i.status === 'error').length
  const locked = batchRunning || working > 0

  return (
    <div className="glass flex flex-col gap-3 rounded-2xl border border-line p-3 shadow-card sm:p-3.5 md:flex-row md:items-center">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand text-primary-fg">
          <Files className="size-4" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold">
            {items.length} file{items.length === 1 ? '' : 's'}
            {working > 0 && (
              <span className="ml-2 inline-flex items-center gap-1 text-xs font-medium text-primary">
                <Spinner className="size-3" /> {working} working
              </span>
            )}
          </p>
          <p className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5" aria-live="polite">
            <Stat label="with indicators" value={found} tone="bg-warn" />
            <Stat label="cleaned" value={cleaned} tone="bg-ok" />
            {errors > 0 && <Stat label="failed" value={errors} tone="bg-danger" />}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-end">
        <Button variant="secondary" size="sm" onClick={onAnalyzeAll} disabled={locked} title="Re-run the analysis on every file">
          <ScanSearch className="size-3.5" aria-hidden="true" /> Analyze all
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={onCleanAll}
          disabled={locked || uncleaned === 0}
          title="Create a lossless cleaned copy of every file that does not have one yet"
        >
          <Eraser className="size-3.5" aria-hidden="true" /> Clean all{uncleaned > 0 ? ` (${uncleaned})` : ''}
        </Button>
        <Button size="sm" onClick={onDownloadAll} disabled={cleaned === 0} title="Download every cleaned copy">
          <Download className="size-3.5" aria-hidden="true" /> Download{cleaned > 0 ? ` (${cleaned})` : ''}
        </Button>
        <Button variant="danger" size="sm" onClick={onClear} title="Remove every file from the workspace">
          <Trash2 className="size-3.5" aria-hidden="true" /> Clear
        </Button>
      </div>
    </div>
  )
}
