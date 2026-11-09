import { useCallback, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { FlaskConical, ImagePlus, X, CheckCircle2, AlertTriangle, ArrowLeft } from 'lucide-react'
import { useMediaProcessor } from '../hooks/useMediaProcessor'
import { useAutoClean } from '../hooks/useAutoClean'
import { useObjectUrl } from '../hooks/useObjectUrl'
import { partitionFiles, type Rejection } from '../lib/fileValidation'
import { extensionOf } from '../lib/constants'
import { formatBytes, cn } from '../lib/format'
import { navigate } from '../lib/router'
import type { FileItem } from '../types'
import { ExperimentalTagger } from '../components/workspace/ExperimentalTagger'
import { RejectionNotice } from '../components/workspace/Banners'
import { useFileDrop } from '../components/workspace/useFileDrop'
import { isBusy } from '../components/workspace/utils'
import { Spinner } from '../components/ui/Spinner'
import { PageTransition, EASE } from '../components/ui/Motion'

const LABS_EXT = new Set(['jpg', 'jpeg', 'png'])
const LABS_MIME = new Set(['image/jpeg', 'image/jpg', 'image/png'])

function MiniRow({ item, onRemove }: { item: FileItem; onRemove: () => void }) {
  const reduce = useReducedMotion()
  const url = useObjectUrl(item.file)
  const failed = !isBusy(item) && !item.clean && (item.status === 'error' || !!item.structure?.parseError)
  return (
    <motion.li
      layout={!reduce}
      initial={reduce ? false : { opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.94, transition: { duration: 0.15 } }}
      transition={{ duration: 0.3, ease: EASE }}
      className="relative flex items-center gap-3 rounded-xl border border-line bg-card p-2.5 pr-10"
    >
      <span className="relative size-11 shrink-0 overflow-hidden rounded-lg border border-line bg-elevated">
        {url && <img src={url} alt="" className="size-full object-cover" draggable={false} />}
      </span>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium" title={item.file.name}>{item.file.name}</p>
        <p className={cn('mt-0.5 flex items-center gap-1 text-xs', failed ? 'text-danger' : item.clean ? 'text-ok' : 'text-muted')}>
          {isBusy(item) || (!item.clean && !failed) ? (
            <><Spinner className="size-3" /> Preparing…</>
          ) : failed ? (
            <><AlertTriangle className="size-3" aria-hidden="true" /> Can't be prepared</>
          ) : (
            <><CheckCircle2 className="size-3" aria-hidden="true" /> Ready · {formatBytes(item.clean!.size)}</>
          )}
        </p>
      </div>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${item.file.name}`}
        className="absolute right-2 top-1/2 inline-flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-subtle transition-colors hover:bg-danger/10 hover:text-danger"
      >
        <X className="size-4" />
      </button>
    </motion.li>
  )
}

/**
 * Labs — direct access to experimental tools. Files are cleaned automatically
 * first, so tags are always written onto a metadata-free copy.
 */
export function LabsPage() {
  const reduce = useReducedMotion()
  const processor = useMediaProcessor()
  const { items } = processor
  const [rejections, setRejections] = useState<Rejection[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  useAutoClean(items, processor.clean, true)

  const handleFiles = useCallback(
    (files: File[]) => {
      const images: File[] = []
      const rejected: Rejection[] = []
      for (const f of files) {
        if (LABS_EXT.has(extensionOf(f.name)) || LABS_MIME.has(f.type.toLowerCase())) images.push(f)
        else rejected.push({ name: f.name || 'Unnamed file', reason: 'Labs tools currently support JPEG and PNG images.' })
      }
      const { accepted, rejected: invalid } = partitionFiles(images)
      setRejections([...rejected, ...invalid])
      if (accepted.length) processor.addFiles(accepted)
    },
    [processor],
  )
  const dragActive = useFileDrop(handleFiles)

  const open = () => inputRef.current?.click()
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      open()
    }
  }

  return (
    <PageTransition className="relative isolate overflow-x-clip">
      <div aria-hidden="true" className="glow-blob -top-24 left-1/2 -z-10 h-56 w-[36rem] max-w-full -translate-x-1/2 opacity-25" />
      <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-8 lg:py-10">
        <button
          type="button"
          onClick={() => navigate('/app')}
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden="true" /> Back to the cleaner
        </button>

        <div className="mb-6 flex items-start gap-3">
          <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-2xl bg-accent/10 text-accent">
            <FlaskConical className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h1 className="flex flex-wrap items-center gap-2 text-2xl font-semibold tracking-[-0.02em] sm:text-3xl">
              Labs
              <span className="rounded-md bg-accent/10 px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-accent">
                Experimental
              </span>
            </h1>
            <p className="mt-1 text-sm text-muted text-pretty">
              Try features that are still being refined. Add a photo, and it's cleaned first — then add your own tags.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {/* Drop area */}
          <div
            role="button"
            tabIndex={0}
            onClick={(e) => {
              if (e.target !== inputRef.current) open()
            }}
            onKeyDown={onKey}
            aria-label="Add JPEG or PNG images"
            className={cn(
              'group flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed p-6 text-center transition-all sm:flex-row sm:gap-4 sm:p-5 sm:text-left',
              dragActive ? 'border-primary bg-primary/5' : 'border-line bg-card/60 hover:border-primary/50 hover:bg-primary/5',
            )}
          >
            <input
              ref={inputRef}
              type="file"
              multiple
              accept=".jpg,.jpeg,.png,image/jpeg,image/png"
              className="hidden"
              onChange={(e) => {
                handleFiles(Array.from(e.target.files ?? []))
                e.target.value = ''
              }}
            />
            <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand text-primary-fg transition-transform group-hover:scale-105">
              <ImagePlus className="size-5" aria-hidden="true" />
            </span>
            <div>
              <p className="font-semibold">{items.length ? 'Add more images' : 'Add images'}</p>
              <p className="text-xs text-muted">Tap to browse, or drop / paste · JPEG and PNG · stays on this device</p>
            </div>
          </div>

          <RejectionNotice rejections={rejections} onDismiss={() => setRejections([])} />

          {items.length > 0 && (
            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3" aria-label="Images">
              <AnimatePresence initial={false}>
                {items.map((item) => (
                  <MiniRow key={item.id} item={item} onRemove={() => processor.remove(item.id)} />
                ))}
              </AnimatePresence>
            </ul>
          )}

          <motion.div
            initial={reduce ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: EASE, delay: 0.05 }}
          >
            <ExperimentalTagger items={items} />
          </motion.div>
        </div>
      </div>
    </PageTransition>
  )
}
