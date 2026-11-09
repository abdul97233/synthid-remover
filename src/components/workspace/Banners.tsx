import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Lock, TriangleAlert, ExternalLink, X, FileX2 } from 'lucide-react'
import { PRIVACY_STATEMENT, SYNTHID_DETECTOR_URL } from '../../lib/constants'
import type { Rejection } from '../../lib/fileValidation'
import { EASE } from '../ui/Motion'

export function PrivacyBanner() {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-ok/25 bg-ok/5 p-3.5 sm:items-center sm:p-4">
      <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-ok/15 text-ok">
        <Lock className="size-4" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-medium text-pretty">{PRIVACY_STATEMENT}</p>
        <p className="mt-0.5 text-xs text-muted">
          No uploads, no accounts, no database, no cloud — the app has no backend to send anything to.
        </p>
      </div>
    </div>
  )
}

export function HonestyNote() {
  return (
    <div role="note" className="flex items-start gap-3 rounded-2xl border border-warn/25 bg-warn/5 p-4">
      <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warn" aria-hidden="true" />
      <p className="text-xs leading-relaxed text-muted">
        <strong className="font-semibold text-warn">Honesty first:</strong> this workspace reports
        metadata evidence only. Invisible, pixel-level SynthID watermarks cannot be detected or
        removed with any local tool — the app will never claim otherwise. For an authoritative
        watermark check, use{' '}
        <a
          href={SYNTHID_DETECTOR_URL}
          target="_blank"
          rel="noreferrer noopener"
          className="inline-flex items-center gap-1 font-medium text-primary underline decoration-primary/40 underline-offset-2 hover:decoration-primary"
        >
          Google's official detector <ExternalLink className="size-3" aria-hidden="true" />
          <span className="sr-only">(opens in a new tab)</span>
        </a>
        .
      </p>
    </div>
  )
}

/** Dismissable list of files that were not accepted, with the reason for each. */
export function RejectionNotice({ rejections, onDismiss }: { rejections: Rejection[]; onDismiss: () => void }) {
  const reduce = useReducedMotion()
  const shown = rejections.slice(0, 8)
  return (
    <AnimatePresence initial={false}>
      {rejections.length > 0 && (
        <motion.div
          key="rejections"
          role="alert"
          initial={reduce ? false : { opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.3, ease: EASE }}
          className="overflow-hidden"
        >
          <div className="rounded-2xl border border-danger/25 bg-danger/5 p-4">
            <div className="flex items-start gap-3">
              <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-danger/10 text-danger">
                <FileX2 className="size-4" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-danger">
                  {rejections.length} file{rejections.length === 1 ? ' was' : 's were'} not added
                </p>
                <ul className="mt-2 space-y-1.5 text-xs text-muted">
                  {shown.map((r, i) => (
                    <li key={`${r.name}-${i}`} className="min-w-0 break-words">
                      <span className="font-mono font-medium text-foreground [overflow-wrap:anywhere]">{r.name}</span>
                      <span aria-hidden="true"> — </span>
                      <span className="sr-only">: </span>
                      {r.reason}
                    </li>
                  ))}
                  {rejections.length > shown.length && (
                    <li className="text-subtle">…and {rejections.length - shown.length} more</li>
                  )}
                </ul>
              </div>
              <button
                type="button"
                onClick={onDismiss}
                aria-label="Dismiss rejected files message"
                className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:bg-danger/10 hover:text-danger"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
