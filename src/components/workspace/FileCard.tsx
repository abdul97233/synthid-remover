import { forwardRef, type KeyboardEvent } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { FileImage, FileAudio2, FileVideo2, FileText, Trash2, CircleCheck, CircleAlert } from 'lucide-react'
import type { FileItem, MediaKind } from '../../types'
import { useObjectUrl } from '../../hooks/useObjectUrl'
import { formatBytes, cn } from '../../lib/format'
import { extensionOf } from '../../lib/constants'
import { Badge, StatusDot } from '../ui/Badge'
import { Spinner } from '../ui/Spinner'
import { kindOf, statusOf } from './utils'

const KIND_ICON: Record<MediaKind, typeof FileImage> = {
  image: FileImage,
  audio: FileAudio2,
  video: FileVideo2,
  document: FileText,
}

const KIND_TONE: Record<MediaKind, string> = {
  image: 'text-primary bg-primary/10',
  audio: 'text-cyan bg-cyan/10',
  video: 'text-accent bg-accent/10',
  document: 'text-warn bg-warn/10',
}

/**
 * One file in the queue. The selection target is a real <button>; the remove
 * control is a sibling button (no nested interactive elements).
 */
export const FileCard = forwardRef<
  HTMLButtonElement,
  {
    item: FileItem
    selected: boolean
    onSelect: () => void
    onRemove: () => void
    onKeyDown?: (e: KeyboardEvent<HTMLButtonElement>) => void
  }
>(function FileCard({ item, selected, onSelect, onRemove, onKeyDown }, ref) {
  const reduce = useReducedMotion()
  const kind = kindOf(item)
  const thumb = useObjectUrl(kind === 'image' ? item.file : null)
  const Icon = KIND_ICON[kind]
  const status = statusOf(item)
  const ext = extensionOf(item.file.name).toUpperCase()
  const busy = status.busy

  return (
    <div
      className={cn(
        'group relative overflow-hidden rounded-xl border bg-card transition-all duration-200',
        selected
          ? 'border-primary/50 shadow-glow'
          : 'border-line shadow-sm hover:-translate-y-px hover:border-line-strong hover:shadow-card',
      )}
    >
      {selected && (
        <motion.span
          layoutId={reduce ? undefined : 'file-card-selected'}
          aria-hidden="true"
          className="absolute inset-y-2 left-0 w-1 rounded-r-full bg-brand"
          transition={{ type: 'spring', stiffness: 500, damping: 40 }}
        />
      )}

      <button
        ref={ref}
        type="button"
        onClick={onSelect}
        onKeyDown={onKeyDown}
        aria-current={selected ? 'true' : undefined}
        aria-label={`${item.file.name}, ${kind}, ${formatBytes(item.file.size)}, ${status.label}`}
        className="flex w-full min-w-0 items-center gap-3 rounded-xl p-3 pr-12 text-left focus-visible:outline-offset-[-2px]"
      >
        <span
          className={cn(
            'relative inline-flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-lg',
            thumb ? 'bg-elevated' : KIND_TONE[kind],
          )}
        >
          {thumb ? (
            <img src={thumb} alt="" className="size-full object-cover" draggable={false} />
          ) : (
            <Icon className="size-5" aria-hidden="true" />
          )}
          {busy && (
            <span className="absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-[2px]">
              <Spinner className="size-4" />
            </span>
          )}
        </span>

        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium" title={item.file.name}>
            {item.file.name}
          </span>
          <span className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
            <span className="font-mono text-[11px] font-semibold text-muted">{ext}</span>
            <span aria-hidden="true" className="text-subtle">·</span>
            <span>{formatBytes(item.file.size)}</span>
            {item.clean && !busy && (
              <span className="inline-flex items-center gap-1 text-ok">
                <CircleCheck className="size-3" aria-hidden="true" /> Cleaned
              </span>
            )}
          </span>
          <span className="mt-1.5 flex">
            <Badge tone={status.tone} className="max-w-full">
              {busy ? <Spinner className="size-3" /> : status.tone === 'danger' ? <CircleAlert className="size-3" aria-hidden="true" /> : <StatusDot tone={status.tone} />}
              <span className="truncate">{status.label}</span>
            </Badge>
          </span>
        </span>
      </button>

      <button
        type="button"
        aria-label={`Remove ${item.file.name}${busy ? ' (stops using its result)' : ''}`}
        title="Remove from list"
        onClick={onRemove}
        className="absolute top-2.5 right-2.5 inline-flex size-8 items-center justify-center rounded-lg text-muted opacity-100 transition-all hover:bg-danger/10 hover:text-danger focus-visible:opacity-100 sm:opacity-60 sm:group-hover:opacity-100"
      >
        <Trash2 className="size-4" aria-hidden="true" />
      </button>

      {busy && (
        <div className="absolute inset-x-0 bottom-0 h-0.5 overflow-hidden bg-line/50" aria-hidden="true">
          {item.status === 'analyzing' && item.progress > 0 ? (
            <div className="h-full bg-brand transition-[width] duration-300" style={{ width: `${Math.min(100, item.progress)}%` }} />
          ) : (
            <motion.div
              className="h-full w-1/3 bg-brand"
              initial={{ x: '-100%' }}
              animate={reduce ? { x: '100%' } : { x: ['-100%', '300%'] }}
              transition={reduce ? { duration: 0 } : { duration: 1.3, repeat: Infinity, ease: 'easeInOut' }}
            />
          )}
        </div>
      )}
    </div>
  )
})
