import { useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import {
  ScanSearch,
  Eraser,
  Columns2,
  Info,
  Layers,
  ArrowLeft,
  RotateCw,
  Download,
  Trash2,
  FileAudio2,
  FileVideo2,
  FileImage,
  CircleAlert,
} from 'lucide-react'
import type { FileItem } from '../../types'
import type { CanvasFormat } from '../../lib/reencode'
import { FORMAT_LABEL, extensionOf } from '../../lib/constants'
import { downloadBlob } from '../../lib/download'
import { outputName } from '../../lib/output'
import { formatBytes, cn } from '../../lib/format'
import { useObjectUrl } from '../../hooks/useObjectUrl'
import { Tabs, type TabItem } from '../ui/Tabs'
import { ProgressBar, Skeleton, Spinner } from '../ui/Spinner'
import { Badge, StatusDot } from '../ui/Badge'
import { Button } from '../ui/Button'
import { EASE } from '../ui/Motion'
import { OverviewPanel } from './OverviewPanel'
import { MetadataPanel } from './MetadataPanel'
import { AnalysisPanel, PixelLevelNote, VerdictHero } from './AnalysisPanel'
import { CleanPanel } from './CleanPanel'
import { ComparePanel } from './ComparePanel'
import { isBusy, kindOf, statusOf } from './utils'

const TABS: TabItem[] = [
  { id: 'analysis', label: 'Analysis', icon: ScanSearch },
  { id: 'metadata', label: 'Metadata', icon: Layers },
  { id: 'clean', label: 'Clean', icon: Eraser },
  { id: 'compare', label: 'Compare', icon: Columns2 },
  { id: 'overview', label: 'Info', icon: Info },
]

const KIND_ICON = { image: FileImage, audio: FileAudio2, video: FileVideo2 }

function AnalyzingSkeleton({ progress }: { progress: number }) {
  return (
    <div className="space-y-4" aria-busy="true">
      <div className="relative overflow-hidden rounded-2xl border border-primary/25 bg-primary/5 p-5 sm:p-6">
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-8 animate-scan bg-gradient-to-b from-transparent via-primary/15 to-transparent" />
        <div className="flex items-center gap-4">
          <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10">
            <Spinner className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold">Scanning file bytes locally…</p>
            <p className="mt-0.5 text-sm text-muted">
              Looking for C2PA manifests, IPTC source types and generator tags. Results will appear here.
            </p>
          </div>
          <span className="hidden text-sm font-semibold text-primary tabular-nums sm:block">{Math.round(progress)}%</span>
        </div>
      </div>
      <Skeleton className="h-20" />
      <div className="space-y-2 rounded-2xl border border-line p-4">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/3" />
      </div>
    </div>
  )
}

export function FileDetail({
  item,
  onAnalyze,
  onClean,
  onReencode,
  onRemove,
  onBack,
}: {
  item: FileItem
  onAnalyze: () => void
  onClean: () => void
  onReencode: (target: CanvasFormat) => void
  onRemove: () => void
  /** Mobile only: return to the file list. */
  onBack: () => void
}) {
  const reduce = useReducedMotion()
  const [tab, setTab] = useState('analysis')
  const kind = kindOf(item)
  const thumbUrl = useObjectUrl(kind === 'image' ? item.file : null)
  const KindIcon = KIND_ICON[kind]
  const busy = isBusy(item)
  const status = statusOf(item)
  const formatLabel = item.info ? FORMAT_LABEL[item.info.format] : extensionOf(item.file.name).toUpperCase()

  let content
  if (tab === 'analysis') {
    if (item.status === 'analyzing') content = <AnalyzingSkeleton progress={item.progress} />
    else if (item.analysis) content = <AnalysisPanel analysis={item.analysis} item={item} />
    else if (item.status === 'error')
      content = (
        <div className="space-y-4">
          <VerdictHero
            verdict="undetermined"
            reason={item.error ? `The analysis could not finish: ${item.error}` : 'The analysis could not finish.'}
            hintCount={0}
          />
          <PixelLevelNote />
          <Button onClick={onAnalyze}>
            <RotateCw className="size-4" aria-hidden="true" /> Try the analysis again
          </Button>
        </div>
      )
    else
      content = (
        <div className="flex flex-col items-center rounded-2xl border border-dashed border-line px-6 py-12 text-center">
          <ScanSearch className="size-7 text-subtle" aria-hidden="true" />
          <p className="mt-2 font-medium">No analysis yet</p>
          <Button className="mt-4" onClick={onAnalyze} disabled={busy}>
            <ScanSearch className="size-4" aria-hidden="true" /> Analyze this file now
          </Button>
        </div>
      )
  } else if (tab === 'metadata') content = <MetadataPanel item={item} />
  else if (tab === 'clean')
    content = <CleanPanel item={item} onClean={onClean} onReencode={onReencode} onViewCompare={() => setTab('compare')} />
  else if (tab === 'compare') content = <ComparePanel item={item} onClean={onClean} />
  else content = <OverviewPanel item={item} />

  return (
    <section aria-label={`Details for ${item.file.name}`} className="min-w-0 rounded-3xl border border-line bg-card/80 shadow-card">
      {/* Header */}
      <div className="border-b border-line/70 p-4 sm:p-5">
        <button
          type="button"
          onClick={onBack}
          className="mb-3 inline-flex items-center gap-1.5 rounded-lg px-1.5 py-1 -ml-1.5 text-sm font-medium text-muted transition-colors hover:text-foreground lg:hidden"
        >
          <ArrowLeft className="size-4" aria-hidden="true" /> All files
        </button>

        <div className="flex items-start gap-3 sm:gap-4">
          <span className="relative inline-flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-line bg-elevated sm:size-16">
            {thumbUrl ? (
              <img src={thumbUrl} alt="" className="size-full object-cover" />
            ) : (
              <KindIcon className={cn('size-6', kind === 'audio' ? 'text-cyan' : kind === 'video' ? 'text-accent' : 'text-primary')} aria-hidden="true" />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold tracking-tight [overflow-wrap:anywhere] sm:text-lg">{item.file.name}</h2>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <Badge tone={status.tone}>
                {status.busy ? <Spinner className="size-3" /> : <StatusDot tone={status.tone} />}
                {status.label}
              </Badge>
              <Badge tone="neutral" className="capitalize">{kind}</Badge>
              <Badge tone="neutral">{formatLabel}</Badge>
              <Badge tone="neutral">{formatBytes(item.file.size)}</Badge>
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={onAnalyze} disabled={busy}>
            <RotateCw className={cn('size-3.5', item.status === 'analyzing' && 'animate-spin')} aria-hidden="true" />
            {item.analysis ? 'Re-analyze' : 'Analyze'}
          </Button>
          <Button variant="secondary" size="sm" onClick={() => { onClean(); setTab('clean') }} disabled={busy}>
            <Eraser className="size-3.5" aria-hidden="true" /> {item.clean ? 'Re-clean' : 'Clean'}
          </Button>
          {item.clean && (
            <Button size="sm" onClick={() => downloadBlob(item.clean!.blob, outputName(item.clean!.filename))} disabled={item.status === 'cleaning'}>
              <Download className="size-3.5" aria-hidden="true" /> Download
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={onRemove} className="ml-auto hover:text-danger">
            <Trash2 className="size-3.5" aria-hidden="true" /> Remove
          </Button>
        </div>

        <AnimatePresence initial={false}>
          {busy && (
            <motion.div
              key="progress"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="pt-4">
                <div className="mb-1.5 flex justify-between text-xs text-muted">
                  <span>{item.status === 'analyzing' ? 'Analyzing locally…' : 'Cleaning locally…'}</span>
                  {item.status === 'analyzing' && <span className="tabular-nums">{Math.round(item.progress)}%</span>}
                </div>
                <ProgressBar value={item.status === 'analyzing' ? item.progress : Math.max(item.progress, 35)} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {item.status === 'error' && item.error && item.analysis && (
          <div role="alert" className="mt-4 flex items-start gap-2.5 rounded-xl border border-danger/25 bg-danger/5 px-3.5 py-3 text-sm text-danger">
            <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span className="min-w-0 [overflow-wrap:anywhere]">{item.error}</span>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="p-4 sm:p-5">
        <Tabs items={TABS} active={tab} onChange={setTab} className="mb-4" />
        <div role="tabpanel" aria-label={TABS.find((t) => t.id === tab)?.label} className="min-h-48 min-w-0">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={tab}
              initial={reduce ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6 }}
              transition={{ duration: 0.22, ease: EASE }}
            >
              {content}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </section>
  )
}
