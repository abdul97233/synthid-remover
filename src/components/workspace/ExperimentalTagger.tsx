import { useId, useMemo, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { FlaskConical, Download, Info, RotateCcw, Glasses, Smartphone, Camera, Plane, Wand2, Share2, CheckCircle2, Crop } from 'lucide-react'
import type { FileItem } from '../../types'
import { TAG_PRESETS, applyTags, buildExif, hasAnyTag, insertExifJpeg, toExifDate, type TagFields } from '../../lib/exifWriter'
import { renderFrame } from '../../lib/reencode'
import { outputName, canShareFiles } from '../../lib/output'
import { downloadBlob } from '../../lib/download'
import { createZip } from '../../lib/zip'
import { cn, formatBytes } from '../../lib/format'
import { Button } from '../ui/Button'
import { Spinner } from '../ui/Spinner'
import { EASE } from '../ui/Motion'

const PRESET_ICON: Record<string, typeof Camera> = {
  'rayban-meta-2': Glasses,
  'rayban-meta': Glasses,
  'iphone-15-pro': Smartphone,
  'iphone-16': Smartphone,
  'pixel-9-pro': Smartphone,
  'galaxy-s24-ultra': Smartphone,
  'dji-mini-4': Plane,
}

type FormState = {
  make: string
  model: string
  lensMake: string
  lensModel: string
  software: string
  artist: string
  copyright: string
  description: string
  date: string
}

const EMPTY: FormState = {
  make: '',
  model: '',
  lensMake: '',
  lensModel: '',
  software: '',
  artist: '',
  copyright: '',
  description: '',
  date: '',
}

interface Output {
  name: string
  blob: Blob
}

function nowLocal(): string {
  const d = new Date()
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 16)
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  className,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
  className?: string
}) {
  const id = useId()
  return (
    <div className={cn('min-w-0', className)}>
      <label htmlFor={id} className="mb-1 block text-xs font-medium text-muted">
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        placeholder={placeholder}
        maxLength={200}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-full min-w-0 rounded-lg border border-line bg-background px-3 text-sm outline-none transition-colors placeholder:text-subtle focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
      />
    </div>
  )
}

/**
 * EXPERIMENTAL, opt-in: write chosen EXIF tags into cleaned images. Device
 * presets can also re-frame the photo to that device's output format.
 * The tags are labels chosen by the user; they are not provenance.
 */
export function ExperimentalTagger({ items }: { items: FileItem[] }) {
  const reduce = useReducedMotion()
  const shareable = useMemo(canShareFiles, [])
  const [form, setForm] = useState<FormState>(EMPTY)
  const [presetId, setPresetId] = useState<string | null>(null)
  const [frameOn, setFrameOn] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [outputs, setOutputs] = useState<Output[] | null>(null)
  const [shared, setShared] = useState(false)

  const preset = TAG_PRESETS.find((p) => p.id === presetId) ?? null
  const frame = preset?.frame && frameOn ? preset.frame : null

  // Re-framing decodes the original, so any cleaned image works; the lossless
  // path can only insert EXIF into JPEG / PNG containers.
  const targets = items.filter(
    (i) => i.clean && (frame ? i.info?.kind === 'image' || /^(jpeg|png|webp)$/.test(i.clean.format) : /^(jpeg|png)$/.test(i.clean.format)),
  )
  const skipped = items.filter((i) => i.clean && !targets.includes(i)).length

  const invalidate = () => {
    setOutputs(null)
    setShared(false)
    setError(null)
  }
  const set = (k: keyof FormState) => (v: string) => {
    setForm((f) => ({ ...f, [k]: v }))
    invalidate()
  }

  const choosePreset = (id: string) => {
    const p = TAG_PRESETS.find((x) => x.id === id)
    if (!p) return
    setPresetId(id)
    setFrameOn(!!p.frame)
    invalidate()
    setForm((f) => ({ ...f, make: '', model: '', lensMake: '', lensModel: '', software: '', ...p.fields }))
  }

  const fields: TagFields = {
    make: form.make,
    model: form.model,
    lensMake: form.lensMake,
    lensModel: form.lensModel,
    software: form.software,
    artist: form.artist,
    copyright: form.copyright,
    description: form.description,
    dateTimeOriginal: form.date ? toExifDate(form.date) : '',
  }
  const ready = hasAnyTag(fields) && targets.length > 0

  const create = async () => {
    invalidate()
    setBusy(true)
    try {
      const out: Output[] = []
      // One at a time: full-size canvases are memory-heavy on phones.
      for (const i of targets) {
        if (frame) {
          const jpeg = await renderFrame(i.file, frame.width, frame.height, frame.quality)
          const tiff = buildExif({ ...fields, orientation: 1, colorSpace: 1, pixelWidth: frame.width, pixelHeight: frame.height })
          const bytes = insertExifJpeg(new Uint8Array(await jpeg.arrayBuffer()), tiff)
          const name = outputName(i.clean!.filename).replace(/\.[^.]+$/, '') + '.jpg'
          out.push({ name, blob: new Blob([bytes.buffer as ArrayBuffer], { type: 'image/jpeg' }) })
        } else {
          out.push({ name: outputName(i.clean!.filename), blob: await applyTags(i.clean!.blob, i.clean!.format, fields) })
        }
      }
      setOutputs(out)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Tagging failed.')
    } finally {
      setBusy(false)
    }
  }

  const download = async () => {
    if (!outputs?.length) return
    if (outputs.length === 1) downloadBlob(outputs[0].blob, outputs[0].name)
    else downloadBlob(await createZip(outputs), `tagged-files-${new Date().toISOString().slice(0, 10)}.zip`)
  }

  // Must run directly from a tap (no awaits before navigator.share) — iOS requires it.
  const share = () => {
    if (!outputs?.length) return
    const files = outputs.map((o) => new File([o.blob], o.name, { type: o.blob.type || 'image/jpeg' }))
    if (!navigator.canShare?.({ files })) {
      setError('This browser cannot share these files — use Download instead.')
      return
    }
    navigator
      .share({ files })
      .then(() => setShared(true))
      .catch((e: unknown) => {
        if (!(e instanceof DOMException && e.name === 'AbortError')) setError('Sharing failed — use Download instead.')
      })
  }

  const totalSize = outputs?.reduce((s, o) => s + o.blob.size, 0) ?? 0

  return (
    <motion.section
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: EASE }}
      aria-labelledby="tagger-title"
      className="rounded-2xl border border-dashed border-accent/40 bg-card p-4 sm:p-5"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex size-8 items-center justify-center rounded-lg bg-accent/10 text-accent">
          <FlaskConical className="size-4" aria-hidden="true" />
        </span>
        <h2 id="tagger-title" className="font-semibold tracking-tight">
          Add metadata
        </h2>
        <span className="rounded-md bg-accent/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-accent">
          Experimental
        </span>
      </div>
      <p className="mt-2 flex gap-1.5 text-xs leading-relaxed text-muted">
        <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
        <span>
          Writes your chosen tags (camera, author, copyright, date) into the <strong className="font-medium text-foreground">cleaned</strong>{' '}
          copies. These are labels you choose, not proof of origin: they don't add Content Credentials (C2PA) and don't change
          invisible watermarks. Whether an app such as Instagram reacts to them is up to that app.
        </span>
      </p>

      {/* Presets */}
      <p className="mb-2 mt-4 text-xs font-medium text-muted">Device presets</p>
      <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1 sm:flex-wrap sm:overflow-visible">
        {TAG_PRESETS.map((p) => {
          const Icon = PRESET_ICON[p.id] ?? Camera
          const on = presetId === p.id
          return (
            <button
              key={p.id}
              type="button"
              aria-pressed={on}
              onClick={() => choosePreset(p.id)}
              className={cn(
                'inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all',
                on ? 'border-primary bg-primary/10 text-primary' : 'border-line bg-background text-muted hover:border-line-strong hover:text-foreground',
              )}
            >
              <Icon className="size-3.5" aria-hidden="true" />
              {p.label}
            </button>
          )
        })}
      </div>

      {/* Device format (only for presets that define one) */}
      <AnimatePresence initial={false}>
        {preset?.frame && (
          <motion.div
            initial={reduce ? false : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: EASE }}
            className="overflow-hidden"
          >
            <button
              type="button"
              role="switch"
              aria-checked={frameOn}
              onClick={() => {
                setFrameOn((v) => !v)
                invalidate()
              }}
              className="mt-3 flex w-full items-start gap-3 rounded-xl border border-line bg-elevated/50 p-3 text-left"
            >
              <span
                className={cn(
                  'relative mt-0.5 inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition-colors',
                  frameOn ? 'border-primary bg-primary' : 'border-line-strong bg-elevated',
                )}
              >
                <span className={cn('inline-block size-3.5 rounded-full bg-white shadow transition-transform', frameOn ? 'translate-x-[18px]' : 'translate-x-[2px]')} />
              </span>
              <span className="min-w-0">
                <span className="flex items-center gap-1.5 text-sm font-medium">
                  <Crop className="size-3.5 text-subtle" aria-hidden="true" /> Match {preset.label} photo format
                </span>
                <span className="mt-0.5 block text-xs text-muted">
                  {preset.frame.width} × {preset.frame.height} px · 3:4 portrait, centre crop · JPEG {Math.round(preset.frame.quality * 100)}%.
                  Re-encodes the pixels (like a new photo), so it isn't lossless.
                </span>
              </span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Fields */}
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Make" value={form.make} onChange={set('make')} placeholder="e.g. Meta AI" />
        <Field label="Model" value={form.model} onChange={set('model')} placeholder="e.g. Ray-Ban Meta Smart Glasses 2" />
        <Field label="Lens" value={form.lensModel} onChange={set('lensModel')} placeholder="optional" />
        <Field label="Software" value={form.software} onChange={set('software')} placeholder="optional" />
        <Field label="Artist / author" value={form.artist} onChange={set('artist')} placeholder="Your name" />
        <Field label="Copyright" value={form.copyright} onChange={set('copyright')} placeholder="(c) 2026 Your name" />
        <Field label="Description" value={form.description} onChange={set('description')} placeholder="optional" />
        <div className="min-w-0">
          <Field label="Date taken" type="datetime-local" value={form.date} onChange={set('date')} />
          <button type="button" onClick={() => set('date')(nowLocal())} className="mt-1 text-[11px] font-medium text-primary hover:underline">
            Use current time
          </button>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-3 border-t border-line pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted" aria-live="polite">
          {targets.length === 0
            ? 'Add an image first — it is cleaned automatically, then tagged.'
            : `Applies to ${targets.length} cleaned image${targets.length === 1 ? '' : 's'}${skipped ? ` (${skipped} other file${skipped === 1 ? '' : 's'} skipped)` : ''}.`}
          {error && <span className="mt-1 block text-danger">{error}</span>}
        </p>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setForm(EMPTY)
              setPresetId(null)
              setFrameOn(false)
              invalidate()
            }}
          >
            <RotateCcw className="size-3.5" /> Reset
          </Button>
          <Button size="sm" onClick={() => void create()} disabled={!ready || busy} className="flex-1 sm:flex-none">
            {busy ? <Spinner className="size-3.5 text-white" /> : <Wand2 className="size-3.5" />}
            {busy ? 'Creating…' : `Create tagged ${targets.length > 1 ? `copies (${targets.length})` : 'copy'}`}
          </Button>
        </div>
      </div>

      {/* Result */}
      <AnimatePresence>
        {outputs && (
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: EASE }}
            className="mt-4 rounded-xl border border-ok/30 bg-ok/5 p-3 sm:p-4"
          >
            <p className="flex items-center gap-1.5 text-sm font-semibold text-ok">
              <CheckCircle2 className="size-4" aria-hidden="true" />
              {outputs.length} tagged {outputs.length === 1 ? 'copy' : 'copies'} ready · {formatBytes(totalSize)}
              {frame ? ` · ${frame.width}×${frame.height}` : ''}
            </p>
            <p className="mt-1 text-xs text-muted">
              {shareable
                ? 'On a phone, use Save / Share and pick “Save Image” so it lands in your Photos.'
                : 'Download the file to keep it.'}
              {shared ? ' Shared ✓' : ''}
            </p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              {shareable && (
                <Button onClick={share} className="sm:flex-none">
                  <Share2 className="size-4" /> Save / Share
                </Button>
              )}
              <Button variant={shareable ? 'outline' : 'primary'} onClick={() => void download()}>
                <Download className="size-4" /> {outputs.length > 1 ? 'Download ZIP' : 'Download'}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.section>
  )
}
