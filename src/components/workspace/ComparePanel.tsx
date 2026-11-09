import { useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { Download, Scale, Eraser, Columns2, ImageOff, ArrowRight } from 'lucide-react'
import type { FileItem, MediaKind } from '../../types'
import { useObjectUrl } from '../../hooks/useObjectUrl'
import { downloadBlob } from '../../lib/download'
import { formatBytes, cn } from '../../lib/format'
import { Button } from '../ui/Button'
import { Badge } from '../ui/Badge'
import { EASE } from '../ui/Motion'
import { isBusy, isLossyClean, kindOf } from './utils'

function Preview({ url, kind, label }: { url: string | null; kind: MediaKind; label: string }) {
  const [failed, setFailed] = useState<string | null>(null)
  if (url === null) return <span className="p-4 text-center text-xs text-muted">Preparing preview…</span>
  if (failed === url) {
    return (
      <span className="flex flex-col items-center gap-1.5 p-6 text-center text-xs text-muted">
        <ImageOff className="size-5 text-subtle" aria-hidden="true" />
        This browser cannot preview this file.
      </span>
    )
  }
  if (kind === 'image') {
    return (
      <img
        src={url}
        alt={`${label} preview`}
        onError={() => setFailed(url)}
        className="max-h-80 w-auto max-w-full object-contain"
      />
    )
  }
  if (kind === 'audio') {
    return <audio src={url} controls preload="metadata" aria-label={`${label} audio`} onError={() => setFailed(url)} className="w-full p-3" />
  }
  return (
    <video
      src={url}
      controls
      playsInline
      preload="metadata"
      aria-label={`${label} video`}
      onError={() => setFailed(url)}
      className="max-h-80 w-full bg-black"
    />
  )
}

function Pane({
  label,
  size,
  url,
  kind,
  accent,
}: {
  label: string
  size: number
  url: string | null
  kind: MediaKind
  accent?: boolean
}) {
  return (
    <figure
      className={cn(
        'flex min-w-0 flex-col gap-2 rounded-2xl border p-3',
        accent ? 'border-primary/30 bg-primary/[0.04]' : 'border-line bg-elevated/40',
      )}
    >
      <figcaption className="flex items-center justify-between gap-2">
        <span className={cn('text-xs font-semibold uppercase tracking-wider', accent ? 'text-primary' : 'text-muted')}>{label}</span>
        <Badge tone={accent ? 'primary' : 'neutral'}>{formatBytes(size)}</Badge>
      </figcaption>
      <div
        className={cn(
          'flex min-h-32 items-center justify-center overflow-hidden rounded-xl',
          kind === 'image' ? 'bg-elevated' : 'bg-background',
        )}
      >
        <Preview url={url} kind={kind} label={label} />
      </div>
    </figure>
  )
}

/**
 * Original vs. cleaned comparison. For audio/video the cleaned copy uses the
 * original bytes minus metadata, so it must behave exactly like the original.
 */
export function ComparePanel({ item, onClean }: { item: FileItem; onClean: () => void }) {
  const reduce = useReducedMotion()
  const originalUrl = useObjectUrl(item.file)
  const cleanedUrl = useObjectUrl(item.clean?.blob ?? null)
  const kind = kindOf(item)

  if (!item.clean) {
    return (
      <div className="flex flex-col items-center rounded-2xl border border-dashed border-line px-6 py-12 text-center">
        <span className="inline-flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Columns2 className="size-6" aria-hidden="true" />
        </span>
        <p className="mt-3 font-medium">Nothing to compare yet</p>
        <p className="mt-1 max-w-sm text-sm text-muted">
          Create a cleaned copy first — then the original and the cleaned copy appear side by side with the size
          difference and every removed item.
        </p>
        <Button className="mt-4" onClick={onClean} disabled={isBusy(item)}>
          <Eraser className="size-4" aria-hidden="true" /> {item.status === 'cleaning' ? 'Cleaning…' : 'Clean metadata locally'}
        </Button>
      </div>
    )
  }

  const clean = item.clean
  const saved = clean.originalSize - clean.size
  const lossy = isLossyClean(clean)
  const ratio = clean.originalSize > 0 ? Math.min(1, clean.size / clean.originalSize) : 1
  const pct = clean.originalSize > 0 ? (Math.abs(saved) / clean.originalSize) * 100 : 0

  return (
    <div className="space-y-4">
      <div className="grid items-start gap-3 md:grid-cols-2">
        <Pane label="Original" size={clean.originalSize} url={originalUrl} kind={kind} />
        <Pane label={lossy ? 'Re-encoded copy' : 'Cleaned copy'} size={clean.size} url={cleanedUrl} kind={kind} accent />
      </div>

      <div className="rounded-2xl border border-line bg-card p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3 text-sm">
            <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary/15 to-accent/15 text-primary">
              <Scale className="size-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="font-semibold">
                {saved > 0
                  ? `${formatBytes(saved)} ${lossy ? 'smaller' : 'of metadata removed'}`
                  : saved === 0
                    ? 'No removable metadata found'
                    : `Size changed by ${formatBytes(Math.abs(saved))}`}
                {saved !== 0 && <span className="ml-1.5 text-xs font-medium text-muted">({saved > 0 ? '−' : '+'}{pct < 0.1 ? '<0.1' : pct.toFixed(1)}%)</span>}
              </p>
              <p className="text-xs text-muted">
                {clean.removed.length} metadata item(s) removed ·{' '}
                {lossy ? 'pixels were re-compressed (lossy)' : `${kind === 'image' ? 'pixels' : 'media data'} copied byte-for-byte`}
              </p>
            </div>
          </div>
          <Button onClick={() => downloadBlob(clean.blob, clean.filename)} disabled={item.status === 'cleaning'} className="w-full sm:w-auto">
            <Download className="size-4" aria-hidden="true" /> Download cleaned copy
          </Button>
        </div>

        {/* Size delta bar */}
        <div className="mt-4 space-y-1.5" aria-hidden="true">
          <div className="flex items-center justify-between text-[11px] text-muted tabular-nums">
            <span>{formatBytes(clean.originalSize)}</span>
            <ArrowRight className="size-3" />
            <span className="text-foreground">{formatBytes(clean.size)}</span>
          </div>
          <div className="relative h-2 overflow-hidden rounded-full bg-warn/25">
            <motion.div
              className="absolute inset-y-0 left-0 rounded-full bg-brand"
              initial={reduce ? false : { width: '100%' }}
              animate={{ width: `${Math.max(2, ratio * 100)}%` }}
              transition={{ duration: 0.9, ease: EASE, delay: 0.15 }}
            />
          </div>
          <p className="flex flex-wrap gap-x-4 text-[11px] text-muted">
            <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full bg-brand" /> kept</span>
            <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full bg-warn/50" /> removed</span>
          </p>
        </div>
      </div>

      {clean.removed.length > 0 && (
        <div className="rounded-2xl border border-line bg-card p-4 shadow-sm">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Removed items</p>
          <ul className="thin-scroll max-h-56 space-y-0 overflow-y-auto overscroll-contain pr-1 font-mono text-xs text-muted">
            {clean.removed.map((r, i) => (
              <li key={`${r.label}-${i}`} className="flex items-start justify-between gap-3 border-b border-line/40 py-1.5 last:border-0">
                <span className="min-w-0 [overflow-wrap:anywhere]">{r.label}</span>
                <span className="shrink-0 text-right tabular-nums">{formatBytes(r.size)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {clean.notes.length > 0 && (
        <ul className="space-y-1.5 rounded-2xl border border-line bg-elevated/40 p-4 text-xs leading-relaxed text-muted">
          {clean.notes.map((n, i) => (
            <li key={i} className="flex gap-2 [overflow-wrap:anywhere]">
              <span className="text-primary" aria-hidden="true">·</span> {n}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
