import { motion, useReducedMotion } from 'framer-motion'
import { Globe, UploadCloud, ScanSearch, Download } from 'lucide-react'
import { SectionHeading } from '../ui/Card'
import { EASE } from '../ui/Motion'
import { CONTAINER } from './GlowCard'

const STEPS = [
  {
    icon: Globe,
    title: 'Open the website',
    body: 'No install, no account, no setup. The app is a static page — you can even go offline after it loads and it keeps working.',
  },
  {
    icon: UploadCloud,
    title: 'Add your files',
    body: 'Drag & drop images (JPG, PNG, WebP), audio (MP3, WAV), video (MP4, MOV) or PDF documents. Files are read from disk straight into browser memory.',
  },
  {
    icon: ScanSearch,
    title: 'Analyze & clean',
    body: 'Review AI-generation indicators in the metadata, inspect the full structure report, then strip unwanted metadata losslessly.',
  },
  {
    icon: Download,
    title: 'Download a cleaned copy',
    body: 'Compare original vs. cleaned, then download. The original file on your disk is never modified.',
  },
]

export function HowItWorks() {
  const reduce = useReducedMotion()
  return (
    <section
      id="how-it-works"
      className="relative scroll-mt-20 overflow-hidden border-y border-line/70 bg-card/40 py-20 lg:py-28"
    >
      <div className={`${CONTAINER} relative`}>
        <SectionHeading
          eyebrow="How it works"
          title="Four steps, zero accounts"
          description="From open to download without any technical knowledge — and without your file ever touching a network."
        />

        <div className="relative">
          {/* Connector line: vertical on mobile, horizontal on desktop */}
          <div aria-hidden className="absolute bottom-6 left-[23px] top-6 w-px bg-line lg:hidden">
            <motion.div
              className="absolute inset-x-0 top-0 h-full origin-top bg-linear-to-b from-primary via-accent to-cyan"
              initial={reduce ? false : { scaleY: 0 }}
              whileInView={{ scaleY: 1 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ duration: 1.4, ease: EASE }}
            />
          </div>
          <div aria-hidden className="absolute left-[12%] right-[12%] top-6 hidden h-px bg-line lg:block">
            <motion.div
              className="absolute inset-0 origin-left bg-linear-to-r from-primary via-accent to-cyan"
              initial={reduce ? false : { scaleX: 0 }}
              whileInView={{ scaleX: 1 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ duration: 1.4, ease: EASE, delay: 0.15 }}
            />
          </div>

          <ol className="relative grid gap-10 lg:grid-cols-4 lg:gap-6">
          {STEPS.map((s, i) => (
            <motion.li
              key={s.title}
              className="relative flex gap-5 lg:flex-col lg:items-center lg:gap-0 lg:text-center"
              initial={reduce ? false : { opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.6, ease: EASE, delay: 0.15 + i * 0.12 }}
            >
              <div className="relative z-10 shrink-0">
                <span className="relative inline-flex size-12 items-center justify-center rounded-2xl border border-line bg-card text-primary shadow-card">
                  <s.icon className="size-5" />
                </span>
              </div>
              <div className="min-w-0 pt-1 lg:mt-6 lg:max-w-[260px] lg:pt-0">
                <p className="font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-subtle">
                  Step {String(i + 1).padStart(2, '0')}
                </p>
                <h3 className="mt-1.5 text-lg font-semibold tracking-tight text-balance">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted text-pretty">{s.body}</p>
              </div>
            </motion.li>
          ))}
          </ol>
        </div>
      </div>
    </section>
  )
}
