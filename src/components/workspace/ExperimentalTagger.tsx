import { useId, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { FlaskConical, Download, Info, RotateCcw, Glasses, Smartphone, Camera, Plane } from 'lucide-react'
import type { FileItem } from '../../types'
import { TAG_PRESETS, applyTags, hasAnyTag, toExifDate, type TagFields } from '../../lib/exifWriter'
import { outputName } from '../../lib/output'
import { downloadBlob } from '../../lib/download'
import { createZip } from '../../lib/zip'
import { cn } from '../../lib/format'
import { Button } from '../ui/Button'
import { Spinner } from '../ui/Spinner'
import { EASE } from '../ui/Motion'

const PRESET_ICON: Record<string, typeof Camera> = {
  'rayban-meta': Glasses,
  'iphone-15-pro': Smartphone,
  'iphone-16': Smartphone,
  'pixel-9-pro': Smartphone,
  'galaxy-s24-ultra': Smartphone,
  'dji-mini-4': Plane,
}

type FormState = Required<Omit<TagFields, 'dateTimeOriginal'>> & { date: string }

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
 * EXPERIMENTAL, opt-in: write chosen EXIF tags into cleaned JPEG/PNG copies.
 * The tags are claims chosen by the user; they are not provenance.
 */
export function ExperimentalTagger({ items }: { items: FileItem[] }) {
  const reduce = useReducedMotion()
  const [form, setForm] = useState<FormState>(EMPTY)
  const [preset, setPreset] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)

  const targets = items.filter((i) => i.clean && (i.clean.format === 'jpeg' || i.clean.format === 'png'))
  const skipped = items.filter((i) => i.clean && !targets.includes(i)).length
  const set = (k: keyof FormState) => (v: string) => {
    setForm((f) => ({ ...f, [k]: v }))
    setDone(null)
  }

  const choosePreset = (id: string) => {
    const p = TAG_PRESETS.find((x) => x.id === id)
    if (!p) return
    setPreset(id)
    setDone(null)
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

  const run = async () => {
    setError(null)
    setDone(null)
    setBusy(true)
    try {
      const tagged = await Promise.all(
        targets.map(async (i) => ({ name: outputName(i.clean!.filename), blob: await applyTags(i.clean!.blob, i.clean!.format, fields) })),
      )
      if (tagged.length === 1) downloadBlob(tagged[0].blob, tagged[0].name)
      else downloadBlob(await createZip(tagged), `tagged-files-${new Date().toISOString().slice(0, 10)}.zip`)
      setDone(`Tagged ${tagged.length} file${tagged.length === 1 ? '' : 's'}.`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Tagging failed.')
    } finally {
      setBusy(false)
    }
  }

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
          JPEG and PNG copies, losslessly. These are labels you choose, not proof of origin: they don't add Content
          Credentials (C2PA) and don't change pixels or invisible watermarks.
        </span>
      </p>

      {/* Presets */}
      <p className="mb-2 mt-4 text-xs font-medium text-muted">Device presets</p>
      <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1 sm:flex-wrap sm:overflow-visible">
        {TAG_PRESETS.map((p) => {
          const Icon = PRESET_ICON[p.id] ?? Camera
          const on = preset === p.id
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

      {/* Fields */}
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Make" value={form.make} onChange={set('make')} placeholder="e.g. Meta" />
        <Field label="Model" value={form.model} onChange={set('model')} placeholder="e.g. Ray-Ban Meta Smart Glasses" />
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
            ? 'Clean at least one JPEG or PNG first — tags are added to the cleaned copy.'
            : `Applies to ${targets.length} cleaned JPEG/PNG file${targets.length === 1 ? '' : 's'}${skipped ? ` (${skipped} other format${skipped === 1 ? '' : 's'} skipped)` : ''}.`}
          {error && <span className="mt-1 block text-danger">{error}</span>}
          {done && <span className="mt-1 block text-ok">{done}</span>}
        </p>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setForm(EMPTY)
              setPreset(null)
              setDone(null)
              setError(null)
            }}
          >
            <RotateCcw className="size-3.5" /> Reset
          </Button>
          <Button size="sm" onClick={() => void run()} disabled={!ready || busy}>
            {busy ? <Spinner className="size-3.5 text-white" /> : <Download className="size-3.5" />}
            {targets.length > 1 ? `Download tagged (${targets.length}) · ZIP` : 'Download tagged copy'}
          </Button>
        </div>
      </div>
    </motion.section>
  )
}
