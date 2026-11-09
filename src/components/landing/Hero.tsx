import { motion, useReducedMotion } from 'framer-motion'
import { ArrowRight, Sparkles, Lock, CookieIcon, WifiOff, Scale, UploadCloud, Info } from 'lucide-react'
import { navigate, scrollToSection } from '../../lib/router'
import { Button } from '../ui/Button'
import { EASE } from '../ui/Motion'
import { CONTAINER } from './GlowCard'
import { ScanDemo } from './ScanDemo'

const TRUST = [
  { icon: Lock, label: 'Files never leave your device' },
  { icon: CookieIcon, label: 'No accounts, no cookies' },
  { icon: WifiOff, label: 'Works offline' },
  { icon: Scale, label: 'Open source · MIT' },
]

const FORMATS = ['JPG', 'PNG', 'WebP', 'MP3', 'WAV', 'MP4', 'MOV', 'PDF']

export function Hero() {
  const reduce = useReducedMotion()
  const rise = (delay: number) =>
    reduce
      ? {}
      : {
          initial: { opacity: 0, y: 18 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.65, ease: EASE, delay },
        }

  return (
    <section className="relative isolate overflow-hidden" aria-labelledby="hero-title">
      {/* Background: grid + aurora glow */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-[-220px] h-[560px] w-[min(980px,140vw)] -translate-x-1/2 animate-aurora">
          <div className="glow-blob left-[8%] top-[18%] h-[340px] w-[46%] opacity-50" />
          <div
            className="glow-blob right-[6%] top-[30%] h-[300px] w-[42%] opacity-40"
            style={{ background: 'radial-gradient(circle, color-mix(in srgb, var(--accent) 70%, transparent), transparent 70%)' }}
          />
          <div
            className="glow-blob left-[38%] top-[48%] h-[220px] w-[30%] opacity-25"
            style={{ background: 'radial-gradient(circle, color-mix(in srgb, var(--cyan) 70%, transparent), transparent 70%)' }}
          />
        </div>
        <div className="absolute inset-x-0 bottom-0 h-40 bg-linear-to-b from-transparent to-background" />
      </div>

      <div className={`${CONTAINER} grid grid-cols-1 items-center gap-14 pb-20 pt-14 [&>*]:min-w-0 sm:pt-20 lg:grid-cols-[1.08fr_1fr] lg:gap-10 lg:pb-28 lg:pt-24`}>
        <div className="text-center lg:text-left">

          <motion.h1
            id="hero-title"
            {...rise(0.07)}
            className="mx-auto max-w-[16ch] text-balance text-[2.6rem] font-semibold leading-[1.04] tracking-[-0.035em] sm:text-6xl lg:mx-0 lg:text-[4.25rem]"
          >
            Your Media. Your Privacy. <span className="text-gradient">Your Control.</span>
          </motion.h1>

          <motion.p
            {...rise(0.14)}
            className="mx-auto mt-6 max-w-xl text-pretty text-base leading-relaxed text-muted sm:text-lg lg:mx-0"
          >
            Inspect images, audio, video and PDFs for AI-generation metadata indicators, then strip EXIF,
            XMP, IPTC, ID3, PDF info and AI link tracking (utm_source=chatgpt.com) losslessly. A free, privacy-first tool where
            everything happens on your device.
          </motion.p>

          <motion.div
            {...rise(0.21)}
            className="mt-9 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center lg:justify-start"
          >
            <Button size="lg" onClick={() => navigate('/app')} className="group">
              <UploadCloud className="size-4" /> Clean my files
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </Button>
            <Button size="lg" variant="glass" onClick={() => scrollToSection('how-it-works')}>
              See how it works
            </Button>
          </motion.div>

          <motion.ul
            {...rise(0.28)}
            aria-label="Privacy guarantees"
            className="mx-auto mt-8 flex max-w-xl flex-wrap justify-center gap-x-5 gap-y-2 lg:mx-0 lg:justify-start"
          >
            {TRUST.map(({ icon: Icon, label }) => (
              <li
                key={label}
                className="inline-flex items-center gap-1.5 text-sm text-muted"
              >
                <Icon className="size-3.5 text-ok" /> {label}
              </li>
            ))}
          </motion.ul>

          <motion.p
            {...rise(0.34)}
            className="mx-auto mt-6 flex max-w-xl items-start justify-center gap-2 text-left text-xs leading-relaxed text-subtle lg:mx-0 lg:justify-start"
          >
            <Info className="mt-0.5 size-3.5 shrink-0 text-warn" />
            <span>
              Honest by design: pixel-level SynthID watermarks cannot be detected or removed locally,
              and this app never pretends otherwise.{' '}
              <a
                href="#honesty"
                onClick={(e) => {
                  e.preventDefault()
                  scrollToSection('honesty')
                }}
                className="font-medium text-muted underline decoration-line-strong underline-offset-2 hover:text-foreground"
              >
                Read why
              </a>
            </span>
          </motion.p>
        </div>

        <motion.div
          initial={reduce ? false : { opacity: 0, y: 30, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.9, ease: EASE, delay: 0.2 }}
          className="relative"
        >
          <p className="sr-only">
            Illustration: a JPEG file is scanned, two metadata indicators are found, and EXIF, XMP,
            C2PA and IPTC records are removed while the color profile and pixel data are kept.
            Pixel-level SynthID cannot be determined locally.
          </p>
          <ScanDemo />
        </motion.div>
      </div>

      {/* Supported formats strip */}
      <div className={`${CONTAINER} pb-14 lg:pb-20`}>
        <div className="flex flex-col items-center gap-3 border-t border-line/70 pt-8 sm:flex-row sm:justify-center sm:gap-6">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-subtle">Supported formats</p>
          <ul className="flex flex-wrap justify-center gap-1.5">
            {FORMATS.map((f) => (
              <li key={f} className="rounded-md border border-line bg-card px-2.5 py-1 font-mono text-[11px] font-medium text-muted">
                {f}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}
