import { Lock, Database, ServerOff, EyeOff, KeyRound, CloudOff, HardDrive, Cpu, Download, ChevronRight } from 'lucide-react'
import { PRIVACY_STATEMENT } from '../../lib/constants'
import { SectionHeading } from '../ui/Card'
import { Reveal, Stagger, StaggerItem } from '../ui/Motion'
import { CONTAINER } from './GlowCard'

const NEVER = [
  { icon: CloudOff, text: 'No uploads — there is no server to upload to' },
  { icon: KeyRound, text: 'No accounts, no login, no registration' },
  { icon: Database, text: 'No database and no file storage' },
  { icon: ServerOff, text: 'No cloud processing and no external APIs' },
  { icon: EyeOff, text: 'No analytics, tracking or advertising of any kind' },
  { icon: Lock, text: 'No cookies — only a local theme preference in localStorage' },
]

const FLOW = [
  { icon: HardDrive, label: 'Your disk', sub: 'file is read' },
  { icon: Cpu, label: 'Web Worker', sub: 'in browser memory' },
  { icon: Download, label: 'Cleaned copy', sub: 'saved locally' },
]

export function PrivacySection() {
  return (
    <section id="privacy" className="relative scroll-mt-20 overflow-hidden border-t border-line/70 bg-card/40 py-20 lg:py-28">
      <div aria-hidden className="glow-blob left-1/2 top-24 h-72 w-[min(640px,90vw)] -translate-x-1/2 opacity-20" />
      <div className={`${CONTAINER} relative`}>
        <SectionHeading
          eyebrow="Privacy"
          title="Engineered so nothing can leave"
          description="Privacy here is not a policy — it is an architecture. The application is a static page with no backend, so there is no destination your files could travel to."
        />

        <div className="mx-auto grid max-w-5xl gap-4 lg:grid-cols-[1.15fr_1fr]">
          <Reveal className="h-full">
            <div className="ring-gradient h-full rounded-3xl p-px">
              <div className="relative flex h-full flex-col justify-between overflow-hidden rounded-[23px] bg-card p-7 sm:p-10">
                <div aria-hidden className="pointer-events-none absolute inset-0 bg-linear-to-br from-primary/[0.07] via-transparent to-accent/[0.06]" />
                <span className="relative inline-flex size-11 items-center justify-center rounded-xl bg-brand shadow-glow">
                  <Lock className="size-5 text-white" />
                </span>
                <blockquote className="relative mt-6 text-xl font-medium leading-snug tracking-[-0.015em] text-balance sm:text-2xl">
                  “{PRIVACY_STATEMENT}”
                </blockquote>

                {/* Local data flow */}
                <div className="relative mt-8">
                  <ol className="flex flex-col gap-2 sm:flex-row sm:items-stretch" aria-label="Where your file goes">
                    {FLOW.map((f, i) => (
                      <li key={f.label} className="flex flex-1 items-center gap-2 sm:flex-col sm:items-stretch">
                        <div className="flex flex-1 items-center gap-3 rounded-xl border border-line bg-elevated/60 px-3 py-2.5">
                          <f.icon className="size-4 shrink-0 text-primary" aria-hidden />
                          <div className="min-w-0">
                            <p className="text-xs font-semibold">{f.label}</p>
                            <p className="text-[11px] text-subtle">{f.sub}</p>
                          </div>
                          {i < FLOW.length - 1 && (
                            <ChevronRight className="ml-auto hidden size-4 text-subtle sm:block" aria-hidden />
                          )}
                        </div>
                      </li>
                    ))}
                  </ol>
                  <p className="mt-3 flex items-center gap-2 text-xs text-muted">
                    <span className="relative flex size-2">
                      <span className="absolute inline-flex size-full animate-ping rounded-full bg-ok opacity-60" />
                      <span className="relative inline-flex size-2 rounded-full bg-ok" />
                    </span>
                    Network: not involved — works fully offline after first load
                  </p>
                </div>
              </div>
            </div>
          </Reveal>

          <Stagger className="grid content-start gap-2.5 sm:grid-cols-2 lg:grid-cols-1">
            {NEVER.map((n) => (
              <StaggerItem key={n.text}>
                <div className="flex h-full items-start gap-3 rounded-xl border border-line bg-card px-4 py-3.5 shadow-card transition-colors hover:border-ok/30">
                  <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-lg bg-ok/10 text-ok">
                    <n.icon className="size-3.5" aria-hidden />
                  </span>
                  <span className="pt-1 text-sm leading-snug text-muted">{n.text}</span>
                </div>
              </StaggerItem>
            ))}
          </Stagger>
        </div>

        <p className="mx-auto mt-10 max-w-2xl text-center text-xs leading-relaxed text-muted text-pretty">
          Temporary browser memory (object URLs and data buffers) is released as soon as each file
          finishes processing or is removed from the list. Closing the tab discards everything.
        </p>
      </div>
    </section>
  )
}
