import { useEffect, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { FileImage, ScanSearch, Check, Minus, ShieldCheck, TriangleAlert, Cpu } from 'lucide-react'
import { cn } from '../../lib/format'
import { EASE } from '../ui/Motion'

/**
 * Purely illustrative product visual: a mock image being scanned for
 * metadata indicators and then cleaned. No real file, no real numbers —
 * and it always states that pixel-level SynthID cannot be checked locally.
 */

type Phase = 'scan' | 'found' | 'strip' | 'done'

const ROWS = [
  { tag: 'EXIF', label: 'Make · Model · Software', strip: true, indicator: false },
  { tag: 'XMP', label: 'CreatorTool · History', strip: true, indicator: false },
  { tag: 'C2PA', label: 'Content Credentials manifest', strip: true, indicator: true },
  { tag: 'IPTC', label: 'digitalSourceType: trainedAlgorithmicMedia', strip: true, indicator: true },
  { tag: 'ICC', label: 'Color profile', strip: false, indicator: false },
  { tag: 'DATA', label: 'Pixel data — copied byte-for-byte', strip: false, indicator: false },
] as const

const STRIP_ORDER = ROWS.map((r, i) => (r.strip ? i : -1)).filter((i) => i >= 0)

export function ScanDemo() {
  const reduce = useReducedMotion()
  const [phase, setPhase] = useState<Phase>(reduce ? 'done' : 'scan')
  const [stripped, setStripped] = useState(reduce ? STRIP_ORDER.length : 0)

  useEffect(() => {
    if (reduce) {
      setPhase('done')
      setStripped(STRIP_ORDER.length)
      return
    }
    let t: number
    if (phase === 'scan') t = window.setTimeout(() => setPhase('found'), 2600)
    else if (phase === 'found') t = window.setTimeout(() => setPhase('strip'), 1500)
    else if (phase === 'strip') {
      if (stripped < STRIP_ORDER.length) t = window.setTimeout(() => setStripped((n) => n + 1), 420)
      else t = window.setTimeout(() => setPhase('done'), 300)
    } else {
      t = window.setTimeout(() => {
        setStripped(0)
        setPhase('scan')
      }, 3600)
    }
    return () => window.clearTimeout(t)
  }, [phase, stripped, reduce])

  const strippedSet = new Set(STRIP_ORDER.slice(0, stripped))
  const showFound = phase !== 'scan'

  return (
    <div className="relative mx-auto w-full max-w-[460px]" aria-hidden>

      <div className="ring-gradient rounded-[22px] p-px shadow-[0_30px_80px_-30px_color-mix(in_srgb,var(--primary)_55%,transparent)]">
        <div className="overflow-hidden rounded-[21px] bg-card">
          {/* Window chrome */}
          <div className="flex items-center gap-3 border-b border-line px-4 py-3">
            <div className="flex gap-1.5">
              <span className="size-2.5 rounded-full bg-line-strong" />
              <span className="size-2.5 rounded-full bg-line-strong" />
              <span className="size-2.5 rounded-full bg-line-strong" />
            </div>
            <div className="flex min-w-0 flex-1 items-center gap-2 text-xs text-muted">
              <FileImage className="size-3.5 shrink-0 text-primary" />
              <span className="truncate font-medium text-foreground">portrait.jpg</span>
              <span className="hidden text-subtle sm:inline">· JPEG</span>
            </div>
            <PhasePill phase={phase} />
          </div>

          {/* Mock image with scan line */}
          <div className="relative h-36 overflow-hidden border-b border-line sm:h-44">
            <div
              className="absolute inset-0"
              style={{
                background:
                  'radial-gradient(120% 90% at 20% 110%, color-mix(in srgb, var(--accent) 55%, transparent), transparent 60%), radial-gradient(90% 80% at 85% 10%, color-mix(in srgb, var(--cyan) 45%, transparent), transparent 60%), linear-gradient(160deg, color-mix(in srgb, var(--primary) 55%, var(--card)), color-mix(in srgb, var(--primary) 15%, var(--card)))',
              }}
            />
            {/* abstract "subject" */}
            <div className="absolute left-1/2 top-[38%] size-16 -translate-x-1/2 rounded-full bg-white/25 blur-[1px] sm:size-20" />
            <div className="absolute bottom-[-30%] left-1/2 h-28 w-48 -translate-x-1/2 rounded-[50%] bg-white/20 sm:h-32 sm:w-56" />
            {phase === 'scan' && (
              <div className="absolute inset-x-0 top-0 h-[10%] animate-scan">
                <div className="h-full bg-linear-to-b from-transparent via-cyan/50 to-cyan/0" />
                <div className="h-px bg-cyan shadow-[0_0_12px_2px_var(--cyan)]" />
              </div>
            )}
          </div>

          {/* Metadata rows */}
          <ul className="divide-y divide-line/70 px-1.5 py-1.5">
            {ROWS.map((row, i) => {
              const gone = strippedSet.has(i)
              const flagged = showFound && row.indicator && !gone
              return (
                <li key={row.tag} className="flex items-center gap-3 rounded-lg px-2.5 py-2">
                  <span
                    className={cn(
                      'w-12 shrink-0 rounded-md border px-1.5 py-0.5 text-center font-mono text-[10px] font-semibold transition-colors duration-300',
                      gone
                        ? 'border-line bg-elevated text-subtle'
                        : flagged
                          ? 'border-warn/30 bg-warn/10 text-warn'
                          : row.strip
                            ? 'border-primary/25 bg-primary/10 text-primary'
                            : 'border-ok/25 bg-ok/10 text-ok',
                    )}
                  >
                    {row.tag}
                  </span>
                  <span
                    className={cn(
                      'min-w-0 flex-1 truncate text-xs transition-all duration-300',
                      gone ? 'text-subtle line-through decoration-danger/60' : 'text-foreground/90',
                    )}
                  >
                    {row.label}
                  </span>
                  <span className="w-16 shrink-0 text-right text-[10px] font-medium">
                    <AnimatePresence mode="wait" initial={false}>
                      <motion.span
                        key={gone ? 'gone' : flagged ? 'flag' : row.strip ? 'meta' : 'keep'}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.2, ease: EASE }}
                        className={cn(
                          'inline-flex items-center gap-1',
                          gone ? 'text-danger' : flagged ? 'text-warn' : row.strip ? 'text-subtle' : 'text-ok',
                        )}
                      >
                        {gone ? (
                          <>
                            <Minus className="size-3" /> removed
                          </>
                        ) : flagged ? (
                          'indicator'
                        ) : row.strip ? (
                          'metadata'
                        ) : (
                          <>
                            <Check className="size-3" /> kept
                          </>
                        )}
                      </motion.span>
                    </AnimatePresence>
                  </span>
                </li>
              )
            })}
          </ul>

          {/* Honest footer */}
          <div className="space-y-2 border-t border-line bg-elevated/50 px-4 py-3">
            <div className="flex items-center justify-between gap-3 text-xs">
              <span className="text-muted">Status</span>
              <span className={cn('font-medium', phase === 'done' ? 'text-ok' : showFound ? 'text-warn' : 'text-subtle')}>
                {phase === 'done' ? 'Metadata removed · lossless' : showFound ? '2 metadata indicators found' : 'Analyzing…'}
              </span>
            </div>
            <div className="h-1 overflow-hidden rounded-full bg-line">
              <motion.div
                className="h-full rounded-full bg-brand"
                initial={false}
                animate={{
                  width:
                    phase === 'scan' ? '35%' : phase === 'found' ? '55%' : `${55 + (stripped / STRIP_ORDER.length) * 45}%`,
                }}
                transition={{ duration: phase === 'scan' ? 2.4 : 0.4, ease: EASE }}
              />
            </div>
            <div className="flex items-start gap-1.5 text-[11px] leading-snug text-muted">
              <TriangleAlert className="mt-px size-3 shrink-0 text-warn" />
              <span>Pixel-level SynthID: cannot be determined locally</span>
            </div>
          </div>
        </div>
      </div>
      <p className="mt-3 text-center text-[11px] text-subtle">Illustrative preview</p>
    </div>
  )
}

function PhasePill({ phase }: { phase: Phase }) {
  const map: Record<Phase, { label: string; cls: string; icon: typeof ScanSearch }> = {
    scan: { label: 'Analyzing', cls: 'text-cyan border-cyan/30 bg-cyan/10', icon: ScanSearch },
    found: { label: 'Indicators', cls: 'text-warn border-warn/30 bg-warn/10', icon: TriangleAlert },
    strip: { label: 'Cleaning', cls: 'text-primary border-primary/30 bg-primary/10', icon: ScanSearch },
    done: { label: 'Cleaned', cls: 'text-ok border-ok/30 bg-ok/10', icon: Check },
  }
  const { label, cls, icon: Icon } = map[phase]
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.span
        key={phase}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        transition={{ duration: 0.2 }}
        className={cn('inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold', cls)}
      >
        <Icon className={cn('size-3', phase === 'scan' && 'animate-pulse')} />
        {label}
      </motion.span>
    </AnimatePresence>
  )
}
