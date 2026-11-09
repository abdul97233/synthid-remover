import { Check, X, ExternalLink, ScanSearch, TriangleAlert, Equal } from 'lucide-react'
import type { ReactNode } from 'react'
import { SYNTHID_DETECTOR_URL, C2PA_VERIFY_URL } from '../../lib/constants'
import { SectionHeading } from '../ui/Card'
import { Reveal, Stagger, StaggerItem } from '../ui/Motion'
import { CONTAINER } from './GlowCard'

/**
 * The honesty section. This application is named "SynthID Remover" but it
 * will never claim to remove SynthID: no verified local removal (or even
 * local detection) method for pixel-level SynthID watermarks exists, and
 * pretending otherwise would be dishonest and dangerous.
 */

const CAN: ReactNode[] = [
  <>Scans the actual file bytes for documented markers: generator tags, C2PA / Content Credentials manifests, IPTC <em>digitalSourceType</em> values.</>,
  <>Reports three states only: <strong>indicators found</strong>, <strong>no indicators found</strong>, or <strong>cannot be determined — and why</strong>.</>,
  <>Shows a confidence score only when a detection method actually provides one. Metadata inspection does not — so none is invented.</>,
  <>Removes metadata (EXIF, XMP, IPTC, ID3, container boxes) losslessly, and lists every item it removed.</>,
]

const CANNOT: ReactNode[] = [
  <><strong>Detect pixel-level or audio-level SynthID.</strong> SynthID is an imperceptible watermark embedded in pixels or audio by generative models. It is not stored in metadata, so no metadata tool can read it, and no public offline detector exists.</>,
  <><strong>Remove SynthID watermarks.</strong> No verified method exists to remove a pixel-level watermark locally, and this app will never claim a watermark was removed just because metadata was cleaned.</>,
]

function ToolLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      className="group inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-line bg-card px-4 text-sm font-medium transition-colors hover:border-primary/50 hover:text-primary"
    >
      {children}
      <ExternalLink className="size-3.5 transition-transform group-hover:-translate-y-px group-hover:translate-x-px" aria-hidden />
      <span className="sr-only">(opens in a new tab)</span>
    </a>
  )
}

export function HonestySection() {
  return (
    <section id="honesty" className="relative scroll-mt-20 py-20 lg:py-28">
      <div className={CONTAINER}>
        <SectionHeading
          eyebrow="About SynthID"
          title="What this app can and cannot do"
          description="Straight answers, because an AI watermark tool that misleads you is worse than no tool."
        />

        {/* Core equation */}
        <Reveal className="mx-auto mb-8 flex max-w-3xl flex-wrap items-center justify-center gap-3 text-center text-sm font-medium sm:text-base">
          <span className="rounded-full border border-line bg-card px-4 py-2 shadow-sm">Metadata cleaning</span>
          <span className="relative inline-flex size-8 items-center justify-center rounded-full border border-danger/30 bg-danger/10 text-danger" role="img" aria-label="is not equal to">
            <Equal className="size-4" aria-hidden />
            <span aria-hidden className="absolute h-5 w-px rotate-45 bg-danger" />
          </span>
          <span className="rounded-full border border-line bg-card px-4 py-2 shadow-sm">Watermark removal</span>
        </Reveal>

        <Stagger className="mx-auto grid max-w-5xl gap-4 lg:grid-cols-2">
          <StaggerItem>
            <div className="relative h-full overflow-hidden rounded-2xl border border-ok/25 bg-card p-6 shadow-card sm:p-8">
              <div aria-hidden className="pointer-events-none absolute -right-20 -top-20 size-56 rounded-full bg-ok/10 blur-3xl" />
              <div className="relative flex items-center gap-3">
                <span className="inline-flex size-10 items-center justify-center rounded-xl bg-ok/15 text-ok">
                  <ScanSearch className="size-5" />
                </span>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ok">Can do</p>
                  <h3 className="font-semibold tracking-tight">Done locally, honestly, with real evidence</h3>
                </div>
              </div>
              <ul className="relative mt-6 space-y-3.5">
                {CAN.map((c, i) => (
                  <li key={i} className="flex gap-3 text-sm leading-relaxed text-muted [&_strong]:font-medium [&_strong]:text-foreground">
                    <span className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-ok/15 text-ok">
                      <Check className="size-3" strokeWidth={3} />
                    </span>
                    <span>{c}</span>
                  </li>
                ))}
              </ul>
            </div>
          </StaggerItem>

          <StaggerItem>
            <div className="relative h-full overflow-hidden rounded-2xl border border-warn/30 bg-card p-6 shadow-card sm:p-8">
              <div aria-hidden className="pointer-events-none absolute -right-20 -top-20 size-56 rounded-full bg-warn/10 blur-3xl" />
              <div className="relative flex items-center gap-3">
                <span className="inline-flex size-10 items-center justify-center rounded-xl bg-warn/15 text-warn">
                  <TriangleAlert className="size-5" />
                </span>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-warn">Cannot do</p>
                  <h3 className="font-semibold tracking-tight">Not possible locally — and never simulated</h3>
                </div>
              </div>
              <ul className="relative mt-6 space-y-3.5">
                {CANNOT.map((c, i) => (
                  <li key={i} className="flex gap-3 text-sm leading-relaxed text-muted [&_strong]:font-medium [&_strong]:text-foreground">
                    <span className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-warn/15 text-warn">
                      <X className="size-3" strokeWidth={3} />
                    </span>
                    <span>{c}</span>
                  </li>
                ))}
              </ul>
              <p className="relative mt-6 rounded-xl border border-warn/20 bg-warn/5 px-4 py-3 text-xs leading-relaxed text-muted">
                The app is <em>named</em> SynthID Remover, but every screen reinforces the boundary: cleaning
                metadata does not remove an invisible watermark.
              </p>
            </div>
          </StaggerItem>
        </Stagger>

        <Reveal className="mx-auto mt-4 max-w-5xl">
          <div className="flex flex-col gap-5 rounded-2xl border border-line bg-elevated/50 p-6 sm:p-8 md:flex-row md:items-center md:justify-between">
            <div className="max-w-xl">
              <h3 className="font-semibold tracking-tight">Need the authoritative answer?</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                Use Google's official SynthID Detector portal or Content Credentials Verify. These open in
                a new tab and are operated by third parties — this app never sends your file anywhere; you
                choose whether to learn more there.
              </p>
            </div>
            <div className="flex flex-col gap-2.5 sm:flex-row md:flex-col lg:flex-row">
              <ToolLink href={SYNTHID_DETECTOR_URL}>Google SynthID Detector</ToolLink>
              <ToolLink href={C2PA_VERIFY_URL}>Content Credentials Verify</ToolLink>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
