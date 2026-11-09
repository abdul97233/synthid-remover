import type { ReactNode } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { TriangleAlert, ShieldCheck, Info, ExternalLink, Binary, CircleHelp, ScanEye, Gauge } from 'lucide-react'
import type { AnalysisResult, FileItem } from '../../types'
import { SYNTHID_DETECTOR_URL, C2PA_VERIFY_URL } from '../../lib/constants'
import { formatBytes, cn } from '../../lib/format'
import { Badge } from '../ui/Badge'
import { EASE } from '../ui/Motion'
import { verdictOf, type Verdict } from './utils'

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 border-b border-line/60 py-3 last:border-0 sm:flex-row sm:items-baseline sm:gap-6">
      <dt className="shrink-0 text-sm text-muted sm:w-52">{label}</dt>
      <dd className="min-w-0 flex-1 text-sm [overflow-wrap:anywhere]">{children}</dd>
    </div>
  )
}

const VERDICT_STYLE: Record<Verdict, { box: string; icon: string; Icon: typeof ShieldCheck; eyebrow: string }> = {
  found: {
    box: 'border-warn/35 bg-gradient-to-br from-warn/12 via-warn/5 to-transparent',
    icon: 'bg-warn/15 text-warn',
    Icon: TriangleAlert,
    eyebrow: 'text-warn',
  },
  'none-found': {
    box: 'border-ok/35 bg-gradient-to-br from-ok/12 via-ok/5 to-transparent',
    icon: 'bg-ok/15 text-ok',
    Icon: ShieldCheck,
    eyebrow: 'text-ok',
  },
  undetermined: {
    box: 'border-line-strong bg-gradient-to-br from-elevated via-elevated/50 to-transparent',
    icon: 'bg-elevated text-muted border border-line',
    Icon: CircleHelp,
    eyebrow: 'text-muted',
  },
}

/** Verdict hero card — one of exactly three honest states. */
export function VerdictHero({ verdict, reason, hintCount }: { verdict: Verdict; reason?: string; hintCount: number }) {
  const reduce = useReducedMotion()
  const s = VERDICT_STYLE[verdict]
  const title =
    verdict === 'found'
      ? 'AI-generation indicators found in metadata'
      : verdict === 'none-found'
        ? 'No metadata indicators found'
        : 'Cannot be determined'
  const body =
    verdict === 'found'
      ? `This file contains ${hintCount} explicit marker${hintCount === 1 ? '' : 's'} commonly written by AI generation tools or provenance systems. This is metadata evidence only — it does not by itself confirm an embedded SynthID watermark.`
      : verdict === 'none-found'
        ? 'No generator tags, C2PA manifests, IPTC AI source-type markers or SynthID references appear in this file. Important: this does NOT prove the file is watermark-free — invisible SynthID watermarks do not live in metadata.'
        : `${reason ?? 'The file could not be inspected reliably.'} No conclusion is drawn either way — an incomplete inspection is never reported as "no indicators".`

  return (
    <motion.div
      role="status"
      initial={reduce ? false : { opacity: 0, y: 10, scale: 0.99 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.45, ease: EASE }}
      className={cn('relative overflow-hidden rounded-2xl border p-5 sm:p-6', s.box)}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <motion.span
          initial={reduce ? false : { scale: 0.6, rotate: -12, opacity: 0 }}
          animate={{ scale: 1, rotate: 0, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 320, damping: 18, delay: 0.08 }}
          className={cn('inline-flex size-12 shrink-0 items-center justify-center rounded-2xl', s.icon)}
        >
          <s.Icon className="size-6" aria-hidden="true" />
        </motion.span>
        <div className="min-w-0">
          <p className={cn('text-[11px] font-semibold uppercase tracking-[0.16em]', s.eyebrow)}>
            Metadata verdict
          </p>
          <h3 className="mt-1 text-lg font-semibold tracking-tight text-balance sm:text-xl">{title}</h3>
          <p className="mt-1.5 text-sm leading-relaxed text-muted text-pretty">{body}</p>
        </div>
      </div>
    </motion.div>
  )
}

/** Always-visible pixel-level honesty note. */
export function PixelLevelNote() {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-4">
      <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <ScanEye className="size-4" aria-hidden="true" />
      </span>
      <p className="text-sm leading-relaxed text-muted">
        <strong className="font-semibold text-foreground">Pixel-level SynthID: cannot be determined on this device.</strong>{' '}
        SynthID is embedded directly in pixels or audio samples by generative models and is imperceptible;
        it never appears as readable metadata. The only authoritative detector is Google's official{' '}
        <a
          href={SYNTHID_DETECTOR_URL}
          target="_blank"
          rel="noreferrer noopener"
          className="font-medium text-primary underline decoration-primary/40 underline-offset-2 hover:decoration-primary"
        >
          SynthID Detector portal
        </a>{' '}
        (opens in a new tab — this app never sends anything anywhere).
      </p>
    </div>
  )
}

function OfficialTools() {
  const link =
    'inline-flex items-center gap-1.5 rounded-lg border border-line bg-card px-2.5 py-1.5 font-medium text-foreground transition-colors hover:border-primary/50 hover:text-primary'
  return (
    <div className="flex flex-col gap-2 text-xs text-muted sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
      <span>Need an authoritative verdict on the watermark itself?</span>
      <div className="flex flex-wrap gap-2">
        <a href={SYNTHID_DETECTOR_URL} target="_blank" rel="noreferrer noopener" className={link}>
          Google SynthID Detector <ExternalLink className="size-3" aria-hidden="true" />
          <span className="sr-only">(opens in a new tab)</span>
        </a>
        <a href={C2PA_VERIFY_URL} target="_blank" rel="noreferrer noopener" className={link}>
          Content Credentials Verify <ExternalLink className="size-3" aria-hidden="true" />
          <span className="sr-only">(opens in a new tab)</span>
        </a>
      </div>
    </div>
  )
}

/**
 * The analysis report. Three honest presentation rules:
 *  1. Metadata evidence is labeled as metadata evidence.
 *  2. Pixel-level SynthID is always reported as "cannot be determined locally".
 *  3. No confidence number is shown, because no local method produces one.
 */
export function AnalysisPanel({ analysis, item }: { analysis: AnalysisResult; item?: FileItem }) {
  const { verdict, reason } = verdictOf(analysis, item)
  const snippets = analysis.hints.filter((h) => h.snippet).slice(0, 6)
  const { scan } = analysis
  const partial = scan.truncated || (scan.totalBytes > 0 && scan.bytesScanned < scan.totalBytes)

  return (
    <div className="space-y-4">
      <VerdictHero verdict={verdict} reason={reason} hintCount={analysis.hints.length} />
      <PixelLevelNote />

      <section aria-labelledby="evidence-heading" className="rounded-2xl border border-line bg-card px-4 pt-3 pb-1 shadow-sm sm:px-5">
        <h4 id="evidence-heading" className="flex items-center gap-2 pb-1 text-xs font-semibold uppercase tracking-wider text-muted">
          <Info className="size-3.5 text-primary" aria-hidden="true" /> Evidence
        </h4>
        <dl>
          <Row label="SynthID reference in metadata">
            {analysis.synthIdMentioned ? (
              <span className="text-warn">Found — the file itself mentions SynthID</span>
            ) : (
              <span className="text-muted">Not found</span>
            )}
          </Row>
          <Row label="Content Credentials (C2PA)">
            {analysis.c2paPresent ? (
              <span className="text-warn">Manifest markers present (presence detected — full verification is not performed locally)</span>
            ) : (
              <span className="text-muted">Not found</span>
            )}
          </Row>
          <Row label="IPTC DigitalSourceType">
            {analysis.digitalSourceType ? <span className="text-warn">{analysis.digitalSourceType}</span> : <span className="text-muted">Not found</span>}
          </Row>
          <Row label="Generator tags & hints">
            {analysis.hints.length === 0 ? (
              <span className="text-muted">None found</span>
            ) : (
              <ul className="flex flex-wrap gap-1.5">
                {analysis.hints.map((h) => (
                  <li key={`${h.source}-${h.term}`} className="max-w-full">
                    <Badge tone={h.strength === 'strong' ? 'warn' : 'neutral'} className="max-w-full whitespace-normal text-left">
                      {h.strength === 'strong' ? 'Strong' : 'Possible'} · {h.label}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </Row>
          {snippets.length > 0 && (
            <Row label="Evidence snippets">
              <ul className="space-y-1.5">
                {snippets.map((h) => (
                  <li
                    key={`${h.source}-${h.term}`}
                    className="rounded-lg border border-line/70 bg-elevated/60 px-2.5 py-1.5 font-mono text-xs leading-relaxed text-muted break-all"
                  >
                    <span className="text-primary">[{h.source}]</span> …{h.snippet}…
                  </li>
                ))}
              </ul>
            </Row>
          )}
          <Row label="Confidence score">
            <span className="inline-flex items-start gap-2 text-muted">
              <Gauge className="mt-0.5 size-3.5 shrink-0 text-subtle" aria-hidden="true" />
              <span>
                Not available — and not invented. Metadata inspection produces no valid confidence metric;
                here, absence of a score means exactly that.
              </span>
            </span>
          </Row>
          <Row label="Scan coverage">
            <span className="inline-flex items-start gap-2 text-muted">
              <Binary className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden="true" />
              <span>
                {formatBytes(scan.bytesScanned)}
                {scan.totalBytes > 0 ? ` of ${formatBytes(scan.totalBytes)}` : ''} of file bytes scanned{' '}
                {scan.hits.length > 0 ? `· ${scan.hits.length} match(es)` : '· no matches'}
                {partial && <span className="text-warn"> · partial scan</span>}
              </span>
            </span>
          </Row>
        </dl>
      </section>

      <OfficialTools />
    </div>
  )
}
