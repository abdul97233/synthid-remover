import { useMemo, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import {
  Download,
  Share2,
  X,
  CheckCircle2,
  AlertTriangle,
  MapPin,
  Sparkles,
  Camera,
  BadgeCheck,
  FileAudio,
  FileVideo,
  Trash2,
  SlidersHorizontal,
  Lock,
  CloudUpload,
  Wand2,
} from 'lucide-react'
import type { FileItem } from '../../types'
import type { Rejection } from '../../lib/fileValidation'
import { formatBytes, cn } from '../../lib/format'
import { useObjectUrl } from '../../hooks/useObjectUrl'
import { downloadCleaned, downloadAllCleaned, canShareFiles, shareCleaned, insightsOf, outputName } from '../../lib/output'
import { usePreferences } from '../../lib/preferences'
import { Button } from '../ui/Button'
import { Spinner, ProgressBar } from '../ui/Spinner'
import { EASE } from '../ui/Motion'
import { Dropzone } from './Dropzone'
import { RejectionNotice } from './Banners'
import { isBusy, kindOf } from './utils'
import { SYNTHID_DETECTOR_URL } from '../../lib/constants'

type RowState = 'working' | 'done' | 'clean-already' | 'failed' | 'waiting'

function rowState(item: FileItem): RowState {
  if (isBusy(item)) return 'working'
  if (item.clean) return item.clean.removed.length === 0 ? 'clean-already' : 'done'
  if (item.status === 'error' || item.structure?.parseError) return 'failed'
  return 'waiting'
}

function Thumb({ item }: { item: FileItem }) {
  const kind = kindOf(item)
  const url = useObjectUrl(kind === 'image' ? item.file : null)
  return (
    <span className="relative inline-flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-line bg-elevated sm:size-14">
      {kind === 'image' && url ? (
        <img src={url} alt="" className="size-full object-cover" draggable={false} />
      ) : kind === 'audio' ? (
        <FileAudio className="size-6 text-accent" aria-hidden="true" />
      ) : (
        <FileVideo className="size-6 text-cyan" aria-hidden="true" />
      )}
    </span>
  )
}

function Chip({ tone, icon: Icon, children, title }: { tone: 'warn' | 'danger' | 'accent' | 'neutral'; icon: typeof MapPin; children: string; title?: string }) {
  const tones = {
    warn: 'bg-warn/10 text-warn',
    danger: 'bg-danger/10 text-danger',
    accent: 'bg-accent/10 text-accent',
    neutral: 'bg-elevated text-muted',
  }
  return (
    <span title={title} className={cn('inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium', tones[tone])}>
      <Icon className="size-3" aria-hidden="true" />
      {children}
    </span>
  )
}

function Row({ item, onRemove, shareable }: { item: FileItem; onRemove: () => void; shareable: boolean }) {
  usePreferences() // re-render when the naming preference changes
  const reduce = useReducedMotion()
  const state = rowState(item)
  const ins = insightsOf(item)
  const [shareError, setShareError] = useState<string | null>(null)
  const removedVerb = item.clean ? 'removed' : 'found'

  const status = (() => {
    switch (state) {
      case 'working':
        return item.status === 'analyzing' ? 'Checking metadata…' : 'Removing metadata…'
      case 'done':
        return `${item.clean!.removed.length} metadata item${item.clean!.removed.length === 1 ? '' : 's'} removed · ${formatBytes(ins.removedBytes)} lighter`
      case 'clean-already':
        return 'No metadata found — the copy is identical'
      case 'failed':
        return item.error ?? `This file can't be cleaned safely: ${item.structure?.parseError ?? 'unrecognized structure'}`
      default:
        return 'Waiting…'
    }
  })()

  return (
    <motion.li
      layout={!reduce}
      initial={reduce ? false : { opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={reduce ? { opacity: 0 } : { opacity: 0, x: -24, transition: { duration: 0.2 } }}
      transition={{ duration: 0.35, ease: EASE }}
      className="group relative flex flex-col gap-3 rounded-2xl border border-line bg-card p-3 shadow-card sm:flex-row sm:items-center sm:gap-4 sm:p-4"
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className="relative">
          <Thumb item={item} />
          <AnimatePresence>
            {(state === 'done' || state === 'clean-already') && (
              <motion.span
                initial={reduce ? false : { scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 500, damping: 22 }}
                className="absolute -bottom-1 -right-1 inline-flex size-5 items-center justify-center rounded-full bg-ok text-white ring-2 ring-card"
              >
                <CheckCircle2 className="size-3.5" aria-hidden="true" />
              </motion.span>
            )}
          </AnimatePresence>
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold" title={item.file.name}>
            {item.clean ? outputName(item.clean.filename) : item.file.name}
          </p>
          <p
            className={cn(
              'mt-0.5 flex items-center gap-1.5 text-xs',
              state === 'failed' ? 'text-danger' : state === 'working' || state === 'waiting' ? 'text-muted' : 'text-ok',
            )}
            aria-live="polite"
          >
            {state === 'working' && <Spinner className="size-3" />}
            {state === 'failed' && <AlertTriangle className="size-3 shrink-0" aria-hidden="true" />}
            <span className="line-clamp-2">{status}</span>
          </p>
          {state === 'working' && <ProgressBar value={item.progress} className="mt-2 max-w-xs" />}
          {(ins.aiFound || ins.c2pa || ins.location || ins.device) && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {ins.aiFound && <Chip tone="warn" icon={Sparkles} title="AI-generation metadata indicators">{`AI tags ${removedVerb}`}</Chip>}
              {ins.c2pa && <Chip tone="accent" icon={BadgeCheck} title="C2PA / Content Credentials manifest">{`Content Credentials ${removedVerb}`}</Chip>}
              {ins.location && <Chip tone="danger" icon={MapPin} title="GPS / location metadata">{`Location ${removedVerb}`}</Chip>}
              {ins.device && <Chip tone="neutral" icon={Camera} title="Camera, device, software or author details">{`Device info ${removedVerb}`}</Chip>}
            </div>
          )}
          {shareError && <p className="mt-1 text-xs text-danger">{shareError}</p>}
        </div>
      </div>

      <div className="flex items-center gap-2 sm:shrink-0">
        {item.clean && (
          <>
            <Button size="sm" onClick={() => downloadCleaned(item)} className="flex-1 sm:flex-none" aria-label={`Download ${outputName(item.clean.filename)}`}>
              <Download className="size-3.5" /> Download
            </Button>
            {shareable && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setShareError(null)
                  shareCleaned(item).catch((e: unknown) => setShareError(e instanceof Error ? e.message : 'Sharing failed.'))
                }}
                aria-label="Share cleaned file"
              >
                <Share2 className="size-3.5" /> <span className="sm:hidden">Share</span>
              </Button>
            )}
          </>
        )}
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${item.file.name}`}
          className="ml-auto inline-flex size-8 items-center justify-center rounded-lg text-subtle transition-colors hover:bg-danger/10 hover:text-danger sm:ml-0"
        >
          <X className="size-4" />
        </button>
      </div>
    </motion.li>
  )
}

export function SimpleWorkspace({
  items,
  onFiles,
  dragActive,
  rejections,
  onDismissRejections,
  onRemove,
  onClear,
  onAdvanced,
}: {
  items: FileItem[]
  onFiles: (files: File[]) => void
  dragActive: boolean
  rejections: Rejection[]
  onDismissRejections: () => void
  onRemove: (id: string) => void
  onClear: () => void
  onAdvanced: () => void
}) {
  const reduce = useReducedMotion()
  const shareable = useMemo(canShareFiles, [])
  const [zipping, setZipping] = useState(false)
  const [zipError, setZipError] = useState<string | null>(null)

  const total = items.length
  const working = items.filter((i) => rowState(i) === 'working' || rowState(i) === 'waiting').length
  const cleaned = items.filter((i) => i.clean)
  const failed = items.filter((i) => rowState(i) === 'failed').length
  const done = total - working
  const all = items.map(insightsOf)
  const removedBytes = all.reduce((s, x) => s + x.removedBytes, 0)
  const aiCount = all.filter((x) => x.aiFound || x.c2pa).length
  const locCount = all.filter((x) => x.location).length
  const progress = total ? (done / total) * 100 : 0

  const downloadAll = async () => {
    setZipError(null)
    setZipping(true)
    try {
      await downloadAllCleaned(items)
    } catch (e) {
      setZipError(e instanceof Error ? e.message : 'Could not build the ZIP.')
    } finally {
      setZipping(false)
    }
  }

  if (total === 0) {
    return (
      <div className="space-y-4">
        <Dropzone onFiles={onFiles} dragActive={dragActive} />
        <RejectionNotice rejections={rejections} onDismiss={onDismissRejections} />
        <ol className="grid gap-3 sm:grid-cols-3">
          {[
            { icon: CloudUpload, t: 'Drop your files', d: 'Photos, audio or video. Add as many as you like.' },
            { icon: Wand2, t: 'Cleaned automatically', d: 'Hidden metadata like GPS, camera and AI tags is stripped.' },
            { icon: Download, t: 'Download', d: 'One file, or all of them as a single ZIP.' },
          ].map((s, i) => (
            <li key={s.t} className="flex items-start gap-3 rounded-2xl border border-line bg-card p-4">
              <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <s.icon className="size-4" aria-hidden="true" />
              </span>
              <div>
                <p className="text-sm font-semibold">
                  <span className="mr-1 text-subtle tabular-nums">{i + 1}.</span>
                  {s.t}
                </p>
                <p className="mt-0.5 text-xs leading-relaxed text-muted">{s.d}</p>
              </div>
            </li>
          ))}
        </ol>
        <p className="flex items-start justify-center gap-1.5 text-center text-xs text-muted">
          <Lock className="mt-0.5 size-3 shrink-0 text-ok" aria-hidden="true" />
          Files are processed on this device and never uploaded.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Summary + main actions */}
      <motion.section
        initial={reduce ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: EASE }}
        className="ring-gradient rounded-3xl p-px"
        aria-label="Summary"
      >
        <div className="rounded-[calc(1.5rem-1px)] bg-card p-4 sm:p-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-lg font-semibold tracking-tight sm:text-xl" aria-live="polite">
                {working > 0
                  ? `Cleaning ${Math.min(done + 1, total)} of ${total}…`
                  : failed === total
                    ? 'Nothing could be cleaned'
                    : `All done — ${cleaned.length} file${cleaned.length === 1 ? '' : 's'} ready`}
              </p>
              <p className="mt-1 text-sm text-muted">
                {formatBytes(removedBytes)} of metadata removed
                {aiCount > 0 && <> · <span className="text-warn">{aiCount} with AI tags</span></>}
                {locCount > 0 && <> · <span className="text-danger">{locCount} with location</span></>}
                {failed > 0 && <> · {failed} skipped</>}
              </p>
              {working > 0 && <ProgressBar value={progress} className="mt-3 max-w-sm" />}
            </div>
            <div className="flex flex-col gap-2 sm:items-end">
              <Button size="lg" onClick={() => void downloadAll()} disabled={cleaned.length === 0 || zipping} className="w-full sm:w-auto">
                {zipping ? <Spinner className="size-4 text-white" /> : <Download className="size-4" />}
                {cleaned.length > 1 ? `Download all (${cleaned.length}) · ZIP` : 'Download'}
              </Button>
              {zipError && <p className="text-xs text-danger">{zipError}</p>}
            </div>
          </div>
        </div>
      </motion.section>

      <RejectionNotice rejections={rejections} onDismiss={onDismissRejections} />

      <ul className="space-y-2.5" aria-label="Files">
        <AnimatePresence initial={false}>
          {items.map((item) => (
            <Row key={item.id} item={item} onRemove={() => onRemove(item.id)} shareable={shareable} />
          ))}
        </AnimatePresence>
      </ul>

      <Dropzone onFiles={onFiles} dragActive={dragActive} compact />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button variant="ghost" size="sm" onClick={onAdvanced}>
          <SlidersHorizontal className="size-3.5" /> See full details in Advanced mode
        </Button>
        <Button variant="ghost" size="sm" onClick={onClear} className="hover:text-danger">
          <Trash2 className="size-3.5" /> Clear all
        </Button>
      </div>

      <p className="rounded-xl border border-line bg-elevated/50 px-3 py-2.5 text-xs leading-relaxed text-muted">
        <strong className="font-medium text-foreground">Good to know:</strong> this removes metadata stored in your files.
        Invisible watermarks woven into pixels or sound (like Google's SynthID) can't be removed or detected by any
        local tool —{' '}
        <a href={SYNTHID_DETECTOR_URL} target="_blank" rel="noreferrer noopener" className="text-primary underline-offset-2 hover:underline">
          use Google's official detector
        </a>{' '}
        for that.
      </p>
    </div>
  )
}
