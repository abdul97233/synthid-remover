import type { ReactNode } from 'react'
import { ScanSearch, Eraser, FileSearch, Columns2, Layers, ShieldCheck, ServerOff } from 'lucide-react'
import { SectionHeading } from '../ui/Card'
import { Stagger, StaggerItem } from '../ui/Motion'
import { cn } from '../../lib/format'
import { CONTAINER, GlowCard, IconTile } from './GlowCard'

function Feature({
  icon,
  title,
  body,
  visual,
  className,
  horizontal = false,
}: {
  icon: ReactNode
  title: string
  body: ReactNode
  visual?: ReactNode
  className?: string
  horizontal?: boolean
}) {
  return (
    <StaggerItem className={className}>
      <GlowCard className="h-full">
        <div className={cn('flex h-full flex-col gap-6 p-6 sm:p-7', horizontal && 'md:flex-row md:items-center md:gap-8')}>
          <div className={cn(horizontal && 'md:max-w-sm md:flex-1')}>
            <IconTile>{icon}</IconTile>
            <h3 className="mt-5 text-lg font-semibold tracking-tight">{title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted">{body}</p>
          </div>
          {visual && <div className={cn('mt-auto', horizontal && 'md:mt-0 md:flex-1')}>{visual}</div>}
        </div>
      </GlowCard>
    </StaggerItem>
  )
}

/* ---------- Mini visuals (decorative) ---------- */

function VerdictVisual() {
  const states = [
    { label: 'Indicators found', cls: 'border-warn/30 bg-warn/10 text-warn' },
    { label: 'No indicators found', cls: 'border-ok/30 bg-ok/10 text-ok' },
    { label: 'Cannot be determined — why', cls: 'border-line-strong bg-elevated text-muted' },
  ]
  return (
    <div aria-hidden className="rounded-xl border border-line bg-elevated/60 p-4">
      <div className="flex flex-wrap gap-2">
        {states.map((s) => (
          <span key={s.label} className={cn('rounded-full border px-2.5 py-1 text-[11px] font-medium', s.cls)}>
            {s.label}
          </span>
        ))}
      </div>
      <div className="mt-4 space-y-1.5 overflow-hidden rounded-lg border border-line bg-card p-3 font-mono text-[11px] leading-relaxed">
        <p className="truncate text-muted">
          <span className="text-primary">c2pa</span> · JUMBF manifest store <span className="text-warn">· match</span>
        </p>
        <p className="truncate text-muted">
          <span className="text-primary">iptc</span> · digitalSourceType → trainedAlgorithmicMedia
        </p>
        <p className="truncate text-subtle">confidence · not provided by metadata inspection</p>
      </div>
    </div>
  )
}

function TagsVisual() {
  const tags = ['EXIF', 'XMP', 'IPTC', 'ID3', 'APEv2', 'udta', 'tEXt', 'COM']
  return (
    <div aria-hidden className="flex flex-wrap gap-1.5">
      {tags.map((t, i) => (
        <span
          key={t}
          className="rounded-md border border-line bg-elevated px-2 py-1 font-mono text-[11px] text-muted transition-all duration-300 group-hover/glow:border-danger/25 group-hover/glow:text-subtle group-hover/glow:line-through"
          style={{ transitionDelay: `${i * 40}ms` }}
        >
          {t}
        </span>
      ))}
    </div>
  )
}

function TreeVisual() {
  const rows = [
    { d: 0, n: 'ftyp' },
    { d: 0, n: 'moov' },
    { d: 1, n: 'trak' },
    { d: 2, n: 'mdia' },
    { d: 1, n: 'udta', x: true },
    { d: 0, n: 'mdat' },
  ]
  return (
    <div aria-hidden className="rounded-xl border border-line bg-elevated/60 p-3 font-mono text-[11px]">
      {rows.map((r, i) => (
        <div key={i} className="flex items-center gap-1.5 py-0.5" style={{ paddingLeft: r.d * 14 }}>
          <span className="text-subtle">{r.d ? '└' : '▸'}</span>
          <span className={r.x ? 'text-danger line-through' : 'text-foreground/85'}>{r.n}</span>
          {r.x && <span className="text-[10px] text-subtle">metadata</span>}
        </div>
      ))}
    </div>
  )
}

function CompareVisual() {
  return (
    <div aria-hidden className="grid grid-cols-2 gap-2">
      {['Original', 'Cleaned'].map((l, i) => (
        <div key={l} className="overflow-hidden rounded-lg border border-line bg-elevated">
          <div
            className="h-14"
            style={{
              background:
                'linear-gradient(135deg, color-mix(in srgb, var(--primary) 35%, var(--card)), color-mix(in srgb, var(--accent) 30%, var(--card)))',
            }}
          />
          <div className="flex items-center justify-between px-2 py-1.5 text-[10px]">
            <span className="font-medium text-muted">{l}</span>
            <span className={i ? 'text-ok' : 'text-subtle'}>{i ? '− metadata' : 'as-is'}</span>
          </div>
        </div>
      ))}
    </div>
  )
}

function BatchVisual() {
  const bars = [
    { w: '100%', name: 'clip.mp4' },
    { w: '72%', name: 'voice.wav' },
    { w: '38%', name: 'scan.png' },
  ]
  return (
    <div aria-hidden className="space-y-2.5">
      {bars.map((b) => (
        <div key={b.name}>
          <div className="mb-1 flex justify-between font-mono text-[10px] text-subtle">
            <span>{b.name}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-elevated">
            <div className="relative h-full rounded-full bg-brand" style={{ width: b.w }}>
              <div className="shimmer absolute inset-0 rounded-full" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

const FORMAT_DETAILS = [
  { f: 'JPEG', d: 'APP1–APP15 & COM segments; ICC kept' },
  { f: 'PNG', d: 'tEXt / zTXt / iTXt / eXIf chunks' },
  { f: 'WebP', d: 'EXIF / XMP chunks, incl. inside ANMF' },
  { f: 'MP3', d: 'ID3v2 / ID3v1 / APEv2 tags' },
  { f: 'WAV', d: 'LIST/INFO, bext, iXML, ID3, junk' },
  { f: 'MP4 / MOV', d: 'udta / meta / uuid boxes, re-validated' },
  { f: 'PDF', d: 'Info dict, XMP, PieceInfo, utm_ link tags' },
]

export function Features() {
  return (
    <section id="features" className="relative scroll-mt-20 py-20 lg:py-28">
      <div className={CONTAINER}>
        <SectionHeading
          eyebrow="Features"
          title={
            <>
              Everything you need. <span className="text-muted">Nothing watching you.</span>
            </>
          }
          description="Focused tools for inspecting and cleaning your media — all local, all free."
        />

        <Stagger className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-6">
          <Feature
            className="md:col-span-2 lg:col-span-4"
            horizontal
            icon={<ScanSearch className="size-5" />}
            title="Honest SynthID analysis"
            body="Inspects metadata for generator tags, C2PA Content Credentials and IPTC AI source-type markers. Pixel-level SynthID detection is clearly marked as impossible locally — no fake results, no invented confidence scores."
            visual={<VerdictVisual />}
          />
          <Feature
            className="lg:col-span-2"
            icon={<Eraser className="size-5" />}
            title="Lossless metadata cleaner"
            body="Strips EXIF, XMP, IPTC, PNG text chunks, ID3/APE tags and MP4 metadata boxes. Pixels and audio bitstreams are copied byte-for-byte."
            visual={<TagsVisual />}
          />
          <Feature
            className="lg:col-span-2"
            icon={<FileSearch className="size-5" />}
            title="Media information"
            body="Size, format, resolution, duration and a full byte-level structure report — segments, chunks, boxes and frames."
            visual={<TreeVisual />}
          />
          <Feature
            className="lg:col-span-2"
            icon={<Columns2 className="size-5" />}
            title="Preview & compare"
            body="Original vs. cleaned side-by-side for images, audio and video, with exact size deltas and an itemized removal list."
            visual={<CompareVisual />}
          />
          <Feature
            className="lg:col-span-2"
            icon={<Layers className="size-5" />}
            title="Batch processing"
            body="Drop many files at once. Each is analyzed and cleaned independently with its own progress, results and download."
            visual={<BatchVisual />}
          />

          <StaggerItem className="md:col-span-2 lg:col-span-3">
            <GlowCard className="h-full" glow="var(--ok)">
              <div className="flex h-full flex-col p-6 sm:p-7">
                <IconTile className="border-ok/25 from-ok/15 to-cyan/10 text-ok">
                  <ShieldCheck className="size-5" />
                </IconTile>
                <h3 className="mt-5 text-lg font-semibold tracking-tight">Privacy by architecture</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">
                  Nowhere to upload to, because there is no backend. No accounts, no database, no
                  analytics, no cookies — the app has no destination to send your files to.
                </p>
                <div aria-hidden className="mt-6 flex items-center gap-3 rounded-xl border border-dashed border-line-strong bg-elevated/50 px-4 py-3 text-xs text-muted">
                  <ServerOff className="size-4 text-ok" />
                  <span className="font-mono">upload endpoint: none · network requests for files: 0</span>
                </div>
              </div>
            </GlowCard>
          </StaggerItem>

          <StaggerItem className="md:col-span-2 lg:col-span-3">
            <GlowCard className="h-full" glow="var(--cyan)">
              <div className="p-6 sm:p-7">
                <h3 className="text-lg font-semibold tracking-tight">What “cleaning” removes, per format</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">
                  Hand-written container parsers rebuild each file — no ffmpeg, no re-encoding.
                </p>
                <dl className="mt-5 grid gap-x-6 gap-y-2.5 sm:grid-cols-2">
                  {FORMAT_DETAILS.map((x) => (
                    <div key={x.f} className="flex min-w-0 items-baseline gap-2.5 text-xs">
                      <dt className="w-16 shrink-0 font-mono font-semibold text-foreground">{x.f}</dt>
                      <dd className="min-w-0 text-muted">{x.d}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </GlowCard>
          </StaggerItem>
        </Stagger>
      </div>
    </section>
  )
}
