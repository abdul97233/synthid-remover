import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { CloudUpload, Lock, ScanSearch, Eraser, Download, MousePointerClick } from 'lucide-react'
import { useMediaProcessor } from '../hooks/useMediaProcessor'
import { partitionFiles, type Rejection } from '../lib/fileValidation'
import { downloadBlob } from '../lib/download'
import type { CanvasFormat } from '../lib/reencode'
import { Dropzone } from '../components/workspace/Dropzone'
import { FileList } from '../components/workspace/FileList'
import { FileDetail } from '../components/workspace/FileDetail'
import { WorkspaceToolbar } from '../components/workspace/Toolbar'
import { ConfirmDialog } from '../components/workspace/ConfirmDialog'
import { PrivacyBanner, HonestyNote, RejectionNotice } from '../components/workspace/Banners'
import { useFileDrop } from '../components/workspace/useFileDrop'
import { isBusy } from '../components/workspace/utils'
import { PageTransition, Stagger, StaggerItem, EASE } from '../components/ui/Motion'

const STEPS = [
  { icon: CloudUpload, title: 'Add files', text: 'Drop, browse or paste. They are read into this tab only.' },
  { icon: ScanSearch, title: 'Inspect', text: 'See metadata indicators, the byte structure and decoded tags.' },
  { icon: Eraser, title: 'Clean', text: 'Strip metadata losslessly and compare against the original.' },
  { icon: Download, title: 'Download', text: 'Save the cleaned copy. The original is never modified.' },
]

export function WorkspacePage() {
  const processor = useMediaProcessor()
  const { items } = processor
  const reduce = useReducedMotion()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [rejections, setRejections] = useState<Rejection[]>([])
  const [mobileView, setMobileView] = useState<'list' | 'detail'>('list')
  const [confirmClear, setConfirmClear] = useState(false)
  const [batchRunning, setBatchRunning] = useState(false)

  const knownIds = useRef(new Set<string>())
  const openNewOnMobile = useRef(false)
  const detailRef = useRef<HTMLDivElement>(null)

  const selected = items.find((i) => i.id === selectedId) ?? null

  // Auto-select newly added files and keep the selection valid.
  useEffect(() => {
    const fresh = items.filter((i) => !knownIds.current.has(i.id))
    knownIds.current = new Set(items.map((i) => i.id))
    if (fresh.length > 0) {
      if (!selectedId || !items.some((i) => i.id === selectedId) || fresh.length === 1) {
        setSelectedId(fresh[0].id)
      }
      if (openNewOnMobile.current) setMobileView('detail')
      openNewOnMobile.current = false
      return
    }
    if (selectedId && !items.some((i) => i.id === selectedId)) {
      setSelectedId(items[0]?.id ?? null)
    }
    if (items.length === 0) setMobileView('list')
  }, [items, selectedId])

  const handleFiles = useCallback(
    (files: File[]) => {
      const { accepted, rejected } = partitionFiles(files)
      setRejections(rejected)
      if (accepted.length > 0) {
        // A single first file opens straight into its details on small screens.
        openNewOnMobile.current = accepted.length === 1 && knownIds.current.size === 0
        processor.addFiles(accepted)
      }
    },
    [processor],
  )

  const dragActive = useFileDrop(handleFiles)

  const selectItem = (id: string) => {
    setSelectedId(id)
    setMobileView('detail')
    if (window.matchMedia('(max-width: 1023px)').matches) {
      requestAnimationFrame(() => detailRef.current?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' }))
    }
  }

  const removeItem = (id: string) => {
    if (id === selectedId) {
      const index = items.findIndex((i) => i.id === id)
      const next = items[index + 1] ?? items[index - 1]
      setSelectedId(next?.id ?? null)
      if (!next) setMobileView('list')
    }
    processor.remove(id)
  }

  const runBatch = async (fn: () => Promise<void>) => {
    setBatchRunning(true)
    try {
      await fn()
    } finally {
      setBatchRunning(false)
    }
  }

  const downloadAll = () => {
    const cleaned = items.filter((i) => i.clean)
    // Stagger so browsers don't collapse multiple programmatic downloads into one.
    cleaned.forEach((i, n) => window.setTimeout(() => downloadBlob(i.clean!.blob, i.clean!.filename), n * 400))
  }

  const clearAll = () => {
    processor.clearAll()
    setSelectedId(null)
    setRejections([])
    setMobileView('list')
    setConfirmClear(false)
  }

  const workingCount = items.filter(isBusy).length
  const hasItems = items.length > 0

  return (
    <PageTransition className="relative isolate overflow-x-clip">
      <div aria-hidden="true" className="glow-blob -top-24 left-1/2 -z-10 h-56 w-[36rem] max-w-full -translate-x-1/2 opacity-25" />

      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:py-10">
        {/* Page heading */}
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-[-0.02em] sm:text-3xl">
              Media <span className="text-gradient">workspace</span>
            </h1>
            <p className="mt-1 text-sm text-muted text-pretty">
              Analyze AI-generation indicators, inspect metadata, and clean files — all locally.
            </p>
          </div>
        </div>

        <AnimatePresence mode="wait" initial={false}>
          {!hasItems ? (
            <motion.div
              key="empty"
              initial={reduce ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, y: -8 }}
              transition={{ duration: 0.35, ease: EASE }}
              className="space-y-4"
            >
              <Dropzone onFiles={handleFiles} dragActive={dragActive} />
              <RejectionNotice rejections={rejections} onDismiss={() => setRejections([])} />
              <PrivacyBanner />
              <Stagger className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {STEPS.map((s, i) => (
                  <StaggerItem key={s.title}>
                    <div className="flex h-full items-start gap-3 rounded-2xl border border-line bg-card p-4 shadow-sm">
                      <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <s.icon className="size-4" aria-hidden="true" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold">
                          <span className="mr-1.5 text-subtle tabular-nums">{i + 1}.</span>
                          {s.title}
                        </p>
                        <p className="mt-0.5 text-xs leading-relaxed text-muted">{s.text}</p>
                      </div>
                    </div>
                  </StaggerItem>
                ))}
              </Stagger>
              <HonestyNote />
            </motion.div>
          ) : (
            <motion.div
              key="workspace"
              initial={reduce ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, y: -8 }}
              transition={{ duration: 0.35, ease: EASE }}
              className="space-y-4"
            >
              <WorkspaceToolbar
                items={items}
                batchRunning={batchRunning}
                onAnalyzeAll={() => void runBatch(processor.analyzeAll)}
                onCleanAll={() => void runBatch(processor.cleanAll)}
                onDownloadAll={downloadAll}
                onClear={() => setConfirmClear(true)}
              />

              <RejectionNotice rejections={rejections} onDismiss={() => setRejections([])} />

              <div className="grid items-start gap-4 lg:grid-cols-[minmax(300px,380px)_minmax(0,1fr)] lg:gap-6">
                {/* File list (sidebar on desktop, own view on mobile) */}
                <aside
                  aria-label="File queue"
                  className={`min-w-0 space-y-3 lg:sticky lg:top-20 lg:block lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto lg:p-1 lg:-m-1 thin-scroll ${mobileView === 'detail' ? 'hidden' : 'block'}`}
                >
                  <Dropzone onFiles={handleFiles} dragActive={dragActive} compact />
                  <FileList items={items} selectedId={selectedId} onSelect={selectItem} onRemove={removeItem} />
                  <p className="hidden px-1 text-[11px] text-muted lg:block">
                    Tip: use <kbd className="rounded border border-line px-1 font-mono">↑</kbd>{' '}
                    <kbd className="rounded border border-line px-1 font-mono">↓</kbd> to move between files.
                  </p>
                </aside>

                {/* Detail */}
                <div
                  ref={detailRef}
                  className={`min-w-0 scroll-mt-20 lg:block ${mobileView === 'list' ? 'hidden' : 'block'}`}
                >
                  <AnimatePresence mode="wait" initial={false}>
                    {selected ? (
                      <motion.div
                        key={selected.id}
                        initial={reduce ? false : { opacity: 0, x: 12 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={reduce ? { opacity: 0 } : { opacity: 0, x: -12 }}
                        transition={{ duration: 0.25, ease: EASE }}
                      >
                        <FileDetail
                          item={selected}
                          onAnalyze={() => void processor.analyze(selected)}
                          onClean={() => void processor.clean(selected.id)}
                          onReencode={(target: CanvasFormat) => void processor.reencode(selected.id, target)}
                          onRemove={() => removeItem(selected.id)}
                          onBack={() => setMobileView('list')}
                        />
                      </motion.div>
                    ) : (
                      <motion.div
                        key="none"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex min-h-72 flex-col items-center justify-center rounded-3xl border border-dashed border-line bg-card/40 p-8 text-center"
                      >
                        <MousePointerClick className="size-7 text-subtle" aria-hidden="true" />
                        <p className="mt-2 font-medium">Select a file</p>
                        <p className="mt-1 text-sm text-muted">
                          Select a file to view its analysis, metadata and cleaning options.
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              <HonestyNote />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Full-page drop overlay while dragging files over a populated workspace */}
      <AnimatePresence>
        {dragActive && hasItems && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="pointer-events-none fixed inset-0 z-[90] flex items-center justify-center bg-background/70 p-6 backdrop-blur-sm"
            aria-hidden="true"
          >
            <motion.div
              initial={reduce ? false : { scale: 0.94, y: 8 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 320, damping: 24 }}
              className="flex w-full max-w-md flex-col items-center gap-3 rounded-3xl border-2 border-dashed border-primary bg-card/90 p-10 text-center shadow-glow"
            >
              <span className="inline-flex size-14 items-center justify-center rounded-2xl bg-brand text-primary-fg">
                <CloudUpload className="size-7" />
              </span>
              <p className="text-lg font-semibold">Drop to add files</p>
              <p className="text-sm text-muted">Processed locally — nothing is uploaded.</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <ConfirmDialog
        open={confirmClear}
        title={`Remove all ${items.length} file${items.length === 1 ? '' : 's'}?`}
        confirmLabel="Remove all"
        onConfirm={clearAll}
        onCancel={() => setConfirmClear(false)}
      >
        Analyses and cleaned copies held in memory will be discarded
        {items.some((i) => i.clean) ? ' — download any cleaned copies you want to keep first' : ''}.
        {workingCount > 0 ? ` ${workingCount} file${workingCount === 1 ? ' is' : 's are'} still being processed; their results will be dropped.` : ''}{' '}
        Your original files on disk are not affected.
      </ConfirmDialog>
    </PageTransition>
  )
}
