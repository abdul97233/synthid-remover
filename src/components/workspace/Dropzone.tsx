import { useRef, type KeyboardEvent } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { CloudUpload, FileImage, FileAudio2, FileVideo2, Lock, Plus, ClipboardPaste } from 'lucide-react'
import { ACCEPT_ATTR } from '../../lib/constants'
import { cn } from '../../lib/format'
import { EASE } from '../ui/Motion'

const FORMAT_GROUPS = [
  { label: 'Images', icon: FileImage, formats: ['JPG', 'PNG', 'WebP'], tone: 'text-primary' },
  { label: 'Audio', icon: FileAudio2, formats: ['MP3', 'WAV'], tone: 'text-cyan' },
  { label: 'Video', icon: FileVideo2, formats: ['MP4', 'MOV'], tone: 'text-accent' },
] as const

/**
 * Drag-and-drop / click / keyboard / paste target. Drops are captured at the
 * window level (see useFileDrop) so `dragActive` comes from the page. Everything
 * it receives is handled locally — there is no upload endpoint anywhere.
 */
export function Dropzone({
  onFiles,
  dragActive,
  compact = false,
}: {
  onFiles: (files: File[]) => void
  dragActive: boolean
  compact?: boolean
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const reduce = useReducedMotion()
  const open = () => inputRef.current?.click()

  const input = (
    <input
      ref={inputRef}
      type="file"
      multiple
      accept={ACCEPT_ATTR}
      className="sr-only"
      tabIndex={-1}
      aria-hidden="true"
      onChange={(e) => {
        const files = e.target.files ? Array.from(e.target.files) : []
        if (files.length) onFiles(files)
        e.currentTarget.value = ''
      }}
    />
  )

  const keyHandler = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      open()
    }
  }

  if (compact) {
    return (
      <div
        role="button"
        tabIndex={0}
        aria-label="Add more files: browse, drop or paste. Files stay on this device."
        onClick={(e) => {
          if (e.target !== inputRef.current) open()
        }}
        onKeyDown={keyHandler}
        className={cn(
          'group flex items-center gap-3 rounded-2xl border border-dashed px-4 py-3 transition-all duration-300',
          dragActive
            ? 'border-primary bg-primary/10 shadow-glow'
            : 'border-line-strong bg-card/60 hover:border-primary/50 hover:bg-primary/5',
        )}
      >
        {input}
        <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary transition-transform duration-300 group-hover:scale-105">
          {dragActive ? <CloudUpload className="size-4" /> : <Plus className="size-4" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{dragActive ? 'Drop to add files' : 'Add more files'}</p>
          <p className="truncate text-xs text-muted">Browse, drop, or paste · JPG PNG WebP MP3 WAV MP4 MOV</p>
        </div>
      </div>
    )
  }

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Choose files to analyze: browse, drag and drop, or paste. Files stay on this device."
      aria-describedby="dropzone-formats"
      onClick={(e) => {
        if (e.target !== inputRef.current) open()
      }}
      onKeyDown={keyHandler}
      className={cn(
        'group relative isolate overflow-hidden rounded-3xl p-px transition-all duration-500',
        dragActive ? 'ring-gradient shadow-glow' : 'bg-line hover:ring-gradient',
      )}
    >
      {input}
      <div
        className={cn(
          'relative flex min-h-64 flex-col items-center justify-center gap-5 rounded-[calc(1.5rem-1px)] px-5 py-10 text-center transition-colors duration-300 sm:min-h-72 sm:px-10',
          dragActive ? 'bg-primary/[0.07]' : 'bg-card',
        )}
      >
        <div aria-hidden="true" className={cn('glow-blob left-1/2 top-1/2 -z-10 size-72 -translate-x-1/2 -translate-y-1/2 transition-opacity duration-500', dragActive ? 'opacity-60' : 'opacity-0 group-hover:opacity-30')} />

        {/* Scanning line during drag */}
        <AnimatePresence>
          {dragActive && !reduce && (
            <motion.div
              aria-hidden="true"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="pointer-events-none absolute inset-x-6 top-0 h-10 animate-scan bg-gradient-to-b from-transparent via-primary/20 to-transparent"
            />
          )}
        </AnimatePresence>

        <motion.span
          animate={dragActive && !reduce ? { y: -6, scale: 1.08 } : { y: 0, scale: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          className="relative inline-flex size-16 items-center justify-center rounded-2xl bg-brand text-primary-fg shadow-glow"
        >
          <CloudUpload className="size-7" aria-hidden="true" />
          {!reduce && (
            <span aria-hidden="true" className="absolute inset-0 animate-ping rounded-2xl bg-primary/25 [animation-duration:2.6s]" />
          )}
        </motion.span>

        <div className="max-w-md">
          <AnimatePresence mode="wait" initial={false}>
            <motion.p
              key={dragActive ? 'drop' : 'idle'}
              initial={reduce ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2, ease: EASE }}
              className="text-lg font-semibold tracking-tight sm:text-xl"
            >
              {dragActive ? 'Release to analyze locally' : 'Drop files here, or click to browse'}
            </motion.p>
          </AnimatePresence>
          <p className="mt-1.5 text-sm text-muted">
            Up to 500 MB each · multiple files supported ·{' '}
            <span className="inline-flex items-center gap-1 whitespace-nowrap">
              <ClipboardPaste className="size-3.5" aria-hidden="true" /> paste with{' '}
              <kbd className="rounded border border-line bg-elevated px-1 font-mono text-[11px]">Ctrl/⌘ V</kbd>
            </span>
          </p>
        </div>

        <ul id="dropzone-formats" aria-label="Accepted formats" className="flex flex-wrap items-center justify-center gap-2">
          {FORMAT_GROUPS.map((g) => (
            <li
              key={g.label}
              className="inline-flex items-center gap-1.5 rounded-full border border-line bg-elevated/70 px-3 py-1 text-xs"
            >
              <g.icon className={cn('size-3.5', g.tone)} aria-hidden="true" />
              <span className="font-medium text-foreground">{g.label}</span>
              <span className="text-muted">{g.formats.join(' · ')}</span>
            </li>
          ))}
        </ul>

        <p className="inline-flex items-center gap-1.5 text-xs font-medium text-ok">
          <Lock className="size-3.5" aria-hidden="true" /> Processed on this device — nothing is uploaded
        </p>
      </div>
    </div>
  )
}
