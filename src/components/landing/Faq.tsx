import { useId, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Plus } from 'lucide-react'
import { GITHUB_URL } from '../../lib/constants'
import { SectionHeading } from '../ui/Card'
import { EASE, Reveal } from '../ui/Motion'
import { GithubIcon } from '../ui/GithubIcon'
import { cn } from '../../lib/format'
import { CONTAINER } from './GlowCard'

const FAQS = [
  {
    q: 'Does this tool actually remove SynthID watermarks?',
    a: 'No. No verified local method exists for removing the imperceptible pixel-level or audio-level SynthID watermark, and fabricating a "removed" status would be misleading. What this tool does remove is metadata: EXIF, XMP, IPTC, ID3 tags and container-level records. It always tells you exactly which of those two very different things happened.',
  },
  {
    q: 'Then why is it called SynthID Remover?',
    a: 'The name reflects the workflow: analyze SynthID-related indicators first, remove metadata second. The app itself is blunt about the limits — if a file has no detectable indicator, it says so plainly instead of inventing a success state.',
  },
  {
    q: 'How can an analyzer work if there is no offline SynthID detector?',
    a: 'By inspecting documented, on-disk evidence: C2PA Content Credentials manifests, IPTC digitalSourceType values, and generator tags embedded by popular tools. These prove nothing about invisible watermarks — and the app never overclaims. When metadata evidence is inconclusive, it says "cannot be determined locally".',
  },
  {
    q: 'What happens to my files?',
    a: 'They are read from your disk into browser memory, processed locally in a Web Worker, and released. Files are never uploaded, and the page even keeps working fully offline. Temporary object URLs are revoked the moment a preview is no longer needed.',
  },
  {
    q: 'Why is metadata stripping better than a screenshot or canvas re-encode?',
    a: 'Because it is lossless. The app rebuilds the container (JPEG segments, PNG chunks, RIFF chunks, MP4 boxes, ID3 tags) and copies pixels/audio data byte-for-byte — no recompression, no quality loss. A canvas re-encode is offered only as a fallback for images and is clearly labeled as lossy.',
  },
  {
    q: 'Which formats are supported?',
    a: 'Images: JPG, PNG and WebP. Audio: MP3 and WAV. Video: MP4 and MOV. The MP4 cleaner refuses files it cannot prove safe — fragmented (moof) MP4s and any output that fails full re-parse validation are never produced.',
  },
  {
    q: 'Is it really free? Where is the catch?',
    a: 'It is genuinely free and open source under the MIT license: no ads, no premium tier, no usage limits beyond what your browser memory can handle. The code is small and auditable — that is the point of local-first software.',
  },
]

function FaqItem({
  q,
  a,
  open,
  onToggle,
}: {
  q: string
  a: string
  open: boolean
  onToggle: () => void
}) {
  const reduce = useReducedMotion()
  const id = useId()
  const btnId = `${id}-q`
  const panelId = `${id}-a`
  return (
    <div
      className={cn(
        'rounded-2xl border bg-card transition-[border-color,box-shadow] duration-300',
        open ? 'border-primary/30 shadow-[0_12px_40px_-20px_color-mix(in_srgb,var(--primary)_45%,transparent)]' : 'border-line',
      )}
    >
      <h3>
        <button
          id={btnId}
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={onToggle}
          className="flex w-full items-center justify-between gap-4 rounded-2xl px-5 py-4 text-left text-[15px] font-medium tracking-tight sm:px-6 sm:py-5"
        >
          <span className="text-pretty">{q}</span>
          <span
            aria-hidden
            className={cn(
              'inline-flex size-7 shrink-0 items-center justify-center rounded-full border transition-all duration-300',
              open ? 'rotate-45 border-primary/40 bg-primary/10 text-primary' : 'border-line text-muted',
            )}
          >
            <Plus className="size-3.5" />
          </span>
        </button>
      </h3>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={panelId}
            role="region"
            aria-labelledby={btnId}
            key="panel"
            initial={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
            animate={reduce ? { opacity: 1 } : { height: 'auto', opacity: 1 }}
            exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={{ duration: 0.32, ease: EASE }}
            className="overflow-hidden"
          >
            <p className="px-5 pb-5 text-sm leading-relaxed text-muted text-pretty sm:px-6 sm:pb-6">{a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export function Faq() {
  const [open, setOpen] = useState<number | null>(0)
  return (
    <section id="faq" className="relative scroll-mt-20 py-20 lg:py-28">
      <div className={`${CONTAINER} grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16`}>
        <div className="lg:sticky lg:top-28 lg:self-start">
          <SectionHeading
            align="left"
            eyebrow="FAQ"
            title="Frequently asked questions"
            description="Because trust in a privacy tool has to be earned with clarity."
          />
          <Reveal className="-mt-4 hidden lg:block">
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noreferrer noopener"
              className="group flex items-center gap-4 rounded-2xl border border-line bg-card p-5 transition-colors hover:border-primary/35"
            >
              <span className="inline-flex size-10 items-center justify-center rounded-xl bg-elevated">
                <GithubIcon className="size-5" />
              </span>
              <span>
                <span className="block text-sm font-medium">Don't take our word for it</span>
                <span className="block text-xs text-muted">Read the source — it is small and auditable.</span>
              </span>
              <span className="sr-only">(opens in a new tab)</span>
            </a>
          </Reveal>
        </div>

        <Reveal className="space-y-3">
          {FAQS.map((f, i) => (
            <FaqItem key={f.q} q={f.q} a={f.a} open={open === i} onToggle={() => setOpen(open === i ? null : i)} />
          ))}
        </Reveal>
      </div>
    </section>
  )
}
