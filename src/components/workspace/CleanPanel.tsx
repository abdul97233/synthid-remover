import { useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { Eraser, TriangleAlert, RefreshCw, Recycle, Download, Columns2, ShieldCheck, CircleCheck, Sparkles } from 'lucide-react'
import type { FileItem } from '../../types'
import type { CanvasFormat } from '../../lib/reencode'
import { isSupportedExtension, extensionOf } from '../../lib/constants'
import { downloadBlob } from '../../lib/download'
import { outputName } from '../../lib/output'
import { formatBytes, cn } from '../../lib/format'
import { Button } from '../ui/Button'
import { Badge } from '../ui/Badge'
import { EASE } from '../ui/Motion'
import { isBusy, isLossyClean } from './utils'

const CANVAS_FORMATS: { id: CanvasFormat; label: string }[] = [
  { id: 'jpeg', label: 'JPEG' },
  { id: 'png', label: 'PNG' },
  { id: 'webp', label: 'WebP' },
]

function defaultTarget(ext: string): CanvasFormat {
  if (ext === 'png') return 'png'
  if (ext === 'webp') return 'webp'
  return 'jpeg'
}

/**
 * Cleaning control + permanent honesty boundary:
 * metadata removal is real and lossless; it never claims watermark removal.
 */
export function CleanPanel({
  item,
  onClean,
  onReencode,
  onViewCompare,
}: {
  item: FileItem
  onClean: () => void
  onReencode: (target: CanvasFormat) => void
  onViewCompare: () => void
}) {
  const reduce = useReducedMotion()
  const supported = isSupportedExtension(item.file.name)
  const ext = extensionOf(item.file.name)
  const isImage = ['jpg', 'jpeg', 'png', 'webp'].includes(ext)
  const [target, setTarget] = useState<CanvasFormat>(() => defaultTarget(ext))
  const orientationEntry = item.metadata?.find((e) => e.key === 'Orientation')
  const orientationWarn =
    !!orientationEntry && orientationEntry.value !== '1' && !/^horizontal \(normal\)$/i.test(orientationEntry.value)
  const busy = isBusy(item)
  const cleaning = item.status === 'cleaning'
  const clean = item.clean
  const lossy = clean ? isLossyClean(clean) : false

  if (!supported) {
    return (
      <div role="alert" className="flex items-start gap-3 rounded-2xl border border-danger/25 bg-danger/5 p-5 text-sm text-muted">
        <TriangleAlert className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden="true" />
        This format cannot be cleaned. Supported: JPG, PNG, WebP, MP3, WAV, MP4, MOV.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div role="note" className="flex items-start gap-3 rounded-2xl border border-warn/25 bg-warn/5 p-4 text-xs leading-relaxed text-muted">
        <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warn" aria-hidden="true" />
        <p>
          <strong className="font-semibold text-warn">Honest boundary:</strong> this removes <em>metadata</em>.
          Invisible watermarks such as SynthID are embedded in pixels or audio and are <em>not</em> touched,
          reported as removed, or claimed otherwise. Inspection conclusions are unchanged for watermarked files.
        </p>
      </div>

      {orientationWarn && (
        <div className="flex items-start gap-3 rounded-2xl border border-line bg-elevated/50 p-4 text-xs leading-relaxed text-muted">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warn" aria-hidden="true" />
          <p>
            The EXIF Orientation tag is <span className="font-medium text-foreground">{orientationEntry!.value}</span> —
            some viewers display this image rotated using that tag. After stripping, those viewers will show it as
            stored. If it appears rotated afterwards, use the re-encode option, which bakes orientation into the pixels.
          </p>
        </div>
      )}

      <div className={cn('grid gap-3', isImage && 'md:grid-cols-2')}>
        {/* Lossless */}
        <div className="relative flex flex-col rounded-2xl p-px ring-gradient shadow-card">
          <div className="flex h-full flex-col rounded-[calc(1rem-1px)] bg-card p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <span className="inline-flex size-10 items-center justify-center rounded-xl bg-brand text-primary-fg">
                <Eraser className="size-5" aria-hidden="true" />
              </span>
              <Badge tone="ok">
                <Sparkles className="size-3" aria-hidden="true" /> Recommended · lossless
              </Badge>
            </div>
            <h3 className="mt-3 font-semibold tracking-tight">Lossless metadata clean</h3>
            <p className="mt-1 flex-1 text-sm leading-relaxed text-muted">
              Losslessly rebuilds the container (JPEG segments · PNG chunks · RIFF chunks · ID3 tags · MP4 boxes)
              and drops every metadata record from it. Media data is copied byte-for-byte. The original file is
              never modified — you download a cleaned copy.
            </p>
            <Button onClick={onClean} disabled={busy} className="mt-4 w-full sm:w-auto sm:self-start">
              {cleaning ? <RefreshCw className="size-4 animate-spin" aria-hidden="true" /> : <Eraser className="size-4" aria-hidden="true" />}
              {cleaning ? 'Cleaning…' : clean && !lossy ? 'Re-run metadata clean' : 'Clean metadata locally'}
            </Button>
          </div>
        </div>

        {/* Lossy (images only) */}
        {isImage && (
          <div className="flex flex-col rounded-2xl border border-line bg-card p-4 shadow-sm sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <span className="inline-flex size-10 items-center justify-center rounded-xl bg-elevated text-muted">
                <Recycle className="size-5" aria-hidden="true" />
              </span>
              <Badge tone="warn">Fallback · lossy</Badge>
            </div>
            <h3 className="mt-3 font-semibold tracking-tight">Re-encode via canvas</h3>
            <p className="mt-1 flex-1 text-sm leading-relaxed text-muted">
              A fallback for unusual files (or orientation baking): metadata is discarded by construction, but
              pixels are recompressed — use the lossless clean when you can.
            </p>
            <fieldset className="mt-3">
              <legend className="mb-1.5 text-xs font-medium text-muted">Output format</legend>
              <div className="inline-flex rounded-lg border border-line bg-elevated/60 p-0.5">
                {CANVAS_FORMATS.map((f) => (
                  <label
                    key={f.id}
                    className={cn(
                      'relative cursor-pointer rounded-md px-3 py-1 text-xs font-medium transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-primary/70',
                      target === f.id ? 'bg-card text-foreground shadow-sm' : 'text-muted hover:text-foreground',
                    )}
                  >
                    <input
                      type="radio"
                      name={`reencode-${item.id}`}
                      value={f.id}
                      checked={target === f.id}
                      onChange={() => setTarget(f.id)}
                      className="sr-only"
                    />
                    {f.label}
                  </label>
                ))}
              </div>
              {target === 'jpeg' && ext === 'png' && (
                <p className="mt-1.5 text-[11px] text-muted">JPEG has no transparency — transparent areas become black.</p>
              )}
            </fieldset>
            <Button variant="outline" onClick={() => onReencode(target)} disabled={busy} className="mt-4 w-full sm:w-auto sm:self-start">
              <Recycle className="size-4" aria-hidden="true" /> Re-encode as {CANVAS_FORMATS.find((f) => f.id === target)!.label} (lossy)
            </Button>
          </div>
        )}
      </div>

      {clean && (
        <motion.div
          key={`${clean.filename}-${clean.size}`}
          initial={reduce ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: EASE }}
          className={cn('rounded-2xl border p-4 sm:p-5', lossy ? 'border-warn/30 bg-warn/5' : 'border-ok/30 bg-ok/5')}
          role="status"
        >
          <div className="flex items-start gap-3">
            <span className={cn('inline-flex size-10 shrink-0 items-center justify-center rounded-xl', lossy ? 'bg-warn/15 text-warn' : 'bg-ok/15 text-ok')}>
              {lossy ? <Recycle className="size-5" aria-hidden="true" /> : <CircleCheck className="size-5" aria-hidden="true" />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold tracking-tight">
                {lossy ? 'Re-encoded copy ready (lossy)' : 'Cleaned copy ready (lossless)'}
              </p>
              <p className="mt-0.5 text-sm text-muted [overflow-wrap:anywhere]">
                <span className="font-mono text-foreground">{outputName(clean.filename)}</span> · {formatBytes(clean.size)} ·{' '}
                {clean.removed.length} metadata item(s) removed
              </p>
              <p className="mt-1.5 inline-flex items-center gap-1.5 text-xs text-muted">
                <ShieldCheck className="size-3.5 text-subtle" aria-hidden="true" /> Metadata removed only — watermark
                status unchanged.
              </p>
            </div>
          </div>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <Button onClick={() => downloadBlob(clean.blob, outputName(clean.filename))} disabled={cleaning}>
              <Download className="size-4" aria-hidden="true" /> Download cleaned copy
            </Button>
            <Button variant="secondary" onClick={onViewCompare}>
              <Columns2 className="size-4" aria-hidden="true" /> Compare with original
            </Button>
          </div>
        </motion.div>
      )}
    </div>
  )
}
