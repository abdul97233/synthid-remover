import { useEffect, useState } from 'react'
import type { ComponentType } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import {
  House,
  LayoutGrid,
  ShieldAlert,
  CircleHelp,
  ScanLine,
  Plus,
  FlaskConical,
  Ellipsis,
  Lock,
  ListOrdered,
  Sun,
  Moon,
  ChevronRight,
  ExternalLink,
} from 'lucide-react'
import { useHashRoute, navigate, normalize } from '../../lib/router'
import { cn } from '../../lib/format'
import { GITHUB_URL } from '../../lib/constants'
import { useTheme } from '../../hooks/useTheme'
import { GithubIcon } from '../ui/GithubIcon'
import { EASE } from '../ui/Motion'
import { goToSection } from './nav'
import { useScrollState } from './Header'

type Tab = {
  key: string
  label: string
  Icon: ComponentType<{ className?: string; strokeWidth?: number }>
  go: () => void
}

/** Landing sections → the tab that lights up while they're in view. */
const SECTION_TAB: Record<string, string> = {
  features: 'features',
  'how-it-works': 'features',
  honesty: 'more',
  privacy: 'more',
  faq: 'more',
}

/** Menu sheet: everything that doesn't fit in the bar. */
const MORE_LINKS = [
  { id: 'honesty', label: 'About SynthID', hint: 'What this app can and cannot do', Icon: ShieldAlert },
  { id: 'how-it-works', label: 'How it works', hint: 'Four steps, all on your device', Icon: ListOrdered },
  { id: 'privacy', label: 'Privacy', hint: 'Nothing is uploaded, ever', Icon: Lock },
  { id: 'faq', label: 'FAQ', hint: 'Common questions', Icon: CircleHelp },
]

function MoreSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const reduce = useReducedMotion()
  const { theme, toggle } = useTheme()

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  const go = (fn: () => void) => () => {
    onClose()
    fn()
  }

  const rowCls =
    'flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition-colors hover:bg-elevated active:bg-elevated'

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="backdrop"
            aria-hidden
            onClick={onClose}
            className="fixed inset-0 z-[45] bg-black/40 backdrop-blur-[2px] md:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          />
          <motion.div
            key="sheet"
            role="dialog"
            aria-modal="true"
            aria-label="More"
            className="fixed inset-x-0 bottom-0 z-[46] max-h-[85dvh] overflow-y-auto rounded-t-[28px] border-t border-line bg-card px-3 pb-[calc(6.5rem+env(safe-area-inset-bottom))] pt-2 shadow-[0_-20px_60px_-20px_rgb(0_0_0/0.45)] md:hidden"
            initial={reduce ? { opacity: 0 } : { y: '100%' }}
            animate={reduce ? { opacity: 1 } : { y: 0 }}
            exit={reduce ? { opacity: 0 } : { y: '100%' }}
            transition={reduce ? { duration: 0.15 } : { duration: 0.35, ease: EASE }}
            drag={reduce ? false : 'y'}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 90 || info.velocity.y > 500) onClose()
            }}
          >
            <div className="mx-auto mb-3 mt-1 h-1.5 w-10 rounded-full bg-line-strong" aria-hidden />

            {/* Labs highlight */}
            <button type="button" onClick={go(() => navigate('/labs'))} className="mb-2 w-full rounded-2xl text-left">
              <span className="flex items-center gap-3 rounded-2xl border border-accent/30 bg-accent/5 p-3">
                <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent/15 text-accent">
                  <FlaskConical className="size-5" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2 text-[15px] font-semibold">
                    Labs
                    <span className="rounded bg-accent/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-accent">
                      Experimental
                    </span>
                  </span>
                  <span className="block text-xs text-muted">Add your own tags with device presets</span>
                </span>
                <ChevronRight className="size-4 text-subtle" aria-hidden="true" />
              </span>
            </button>

            <ul>
              {MORE_LINKS.map((l) => (
                <li key={l.id}>
                  <button type="button" onClick={go(() => goToSection(l.id))} className={rowCls}>
                    <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-elevated text-muted">
                      <l.Icon className="size-[18px]" aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[15px] font-medium">{l.label}</span>
                      <span className="block text-xs text-muted">{l.hint}</span>
                    </span>
                    <ChevronRight className="size-4 text-subtle" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>

            <div className="mt-2 border-t border-line pt-2">
              <button type="button" onClick={toggle} className={rowCls} role="switch" aria-checked={theme === 'dark'}>
                <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-elevated text-muted">
                  {theme === 'dark' ? <Moon className="size-[18px]" /> : <Sun className="size-[18px]" />}
                </span>
                <span className="flex-1 text-[15px] font-medium">Dark mode</span>
                <span
                  className={cn(
                    'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors',
                    theme === 'dark' ? 'bg-primary' : 'bg-line-strong',
                  )}
                >
                  <span
                    className={cn(
                      'inline-block size-5 rounded-full bg-white shadow transition-transform',
                      theme === 'dark' ? 'translate-x-[22px]' : 'translate-x-[2px]',
                    )}
                  />
                </span>
              </button>
              <a href={GITHUB_URL} target="_blank" rel="noreferrer noopener" onClick={onClose} className={rowCls}>
                <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-elevated text-muted">
                  <GithubIcon className="size-[18px]" />
                </span>
                <span className="flex-1 text-[15px] font-medium">Source on GitHub</span>
                <ExternalLink className="size-4 text-subtle" aria-label="opens in a new tab" />
              </a>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

/**
 * App-style bottom navigation for phones (< md). Four tabs around a raised
 * centre action: "Clean" opens the workspace, and inside the workspace it
 * becomes "Add" and opens the file picker directly. "More" opens a menu sheet.
 */
export function MobileTabBar() {
  const route = useHashRoute()
  const reduce = useReducedMotion()
  const { active } = useScrollState(route)
  const [moreOpen, setMoreOpen] = useState(false)
  const inApp = route === '/app'
  // On pages with their own file picker, the centre button adds files directly.
  const addMode = inApp || route === '/labs'

  useEffect(() => setMoreOpen(false), [route])

  const LEFT: Tab[] = [
    {
      key: 'home',
      label: 'Home',
      Icon: House,
      go: () => {
        if (normalize(window.location.hash) !== '/') navigate('/')
        else window.scrollTo({ top: 0, behavior: 'smooth' })
      },
    },
    { key: 'features', label: 'Features', Icon: LayoutGrid, go: () => goToSection('features') },
  ]
  const RIGHT: Tab[] = [
    { key: 'labs', label: 'Labs', Icon: FlaskConical, go: () => navigate('/labs') },
    { key: 'more', label: 'More', Icon: Ellipsis, go: () => setMoreOpen((v) => !v) },
  ]

  const activeKey = moreOpen
    ? 'more'
    : route === '/labs'
      ? 'labs'
      : inApp
        ? null
        : ((active && SECTION_TAB[active]) ?? 'home')

  const onCenter = () => {
    if (addMode) document.querySelector<HTMLInputElement>('input[type=file]')?.click()
    else navigate('/app')
  }

  const renderTab = (t: Tab) => {
    const on = activeKey === t.key
    return (
      <li key={t.key} className="flex">
        <motion.button
          type="button"
          onClick={t.go}
          whileTap={reduce ? undefined : { scale: 0.9 }}
          aria-current={on && t.key !== 'more' ? 'page' : undefined}
          aria-expanded={t.key === 'more' ? moreOpen : undefined}
          aria-haspopup={t.key === 'more' ? 'dialog' : undefined}
          className={cn(
            'relative flex flex-1 flex-col items-center justify-center gap-1 pt-1 text-[10.5px] font-medium tracking-tight transition-colors',
            on ? 'text-foreground' : 'text-subtle',
          )}
        >
          <span className="relative flex h-7 w-12 items-center justify-center">
            {on && (
              <motion.span
                layoutId="tab-active"
                aria-hidden
                className="absolute inset-0 rounded-full bg-primary/15"
                transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 500, damping: 36 }}
              />
            )}
            <t.Icon className={cn('relative size-[19px] transition-colors', on && 'text-primary')} strokeWidth={on ? 2.3 : 1.9} />
          </span>
          {t.label}
        </motion.button>
      </li>
    )
  }

  return (
    <>
    <MoreSheet open={moreOpen} onClose={() => setMoreOpen(false)} />
    {/* Always pinned to the bottom of the screen (never hides on scroll). */}
    <nav
      aria-label="Bottom navigation"
      className="fixed inset-x-0 bottom-0 z-[47] px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:hidden"
    >
      <div className="relative mx-auto max-w-md">
        {/* Bar surface */}
        <div className="glass absolute inset-0 rounded-[24px] border border-line shadow-[0_-4px_24px_-8px_rgb(0_0_0/0.12),0_18px_40px_-12px_rgb(0_0_0/0.45)]" />

        <ul className="relative grid h-[66px] grid-cols-5">
          {LEFT.map(renderTab)}

          {/* Raised centre action */}
          <li className="relative flex justify-center">
            <motion.button
              type="button"
              onClick={onCenter}
              whileTap={reduce ? undefined : { scale: 0.92 }}
              aria-label={addMode ? 'Add files' : 'Open the workspace and clean files'}
              aria-current={inApp ? 'page' : undefined}
              className="group absolute -top-6 flex flex-col items-center gap-1"
            >
              <span className="relative grid size-[64px] place-items-center rounded-full p-[3px] shadow-[0_10px_30px_-8px_color-mix(in_srgb,var(--primary)_75%,transparent)] ring-4 ring-background">
                {/* Rotating gradient ring */}
                <span
                  aria-hidden
                  className="absolute inset-0 animate-spin-slow rounded-full bg-[conic-gradient(from_0deg,var(--primary),var(--accent),var(--cyan),#ff6bd5,var(--primary))]"
                />
                <span className="relative grid size-full place-items-center rounded-full bg-background p-[3px]">
                <span className="relative grid size-full place-items-center rounded-full bg-brand">
                  <span aria-hidden className="absolute inset-0 rounded-full bg-linear-to-b from-white/30 to-transparent" />
                  <motion.span
                    key={addMode ? 'add' : 'scan'}
                    initial={reduce ? false : { rotate: -90, scale: 0.5, opacity: 0 }}
                    animate={{ rotate: 0, scale: 1, opacity: 1 }}
                    transition={{ type: 'spring', stiffness: 420, damping: 24 }}
                    className="relative"
                  >
                    {addMode ? (
                      <Plus className="size-6 text-white" strokeWidth={2.6} />
                    ) : (
                      <ScanLine className="size-6 text-white" strokeWidth={2.3} />
                    )}
                  </motion.span>
                </span>
                </span>
              </span>
              <span className={cn('text-[10.5px] font-semibold tracking-tight', addMode ? 'text-primary' : 'text-foreground')}>
                {addMode ? 'Add' : 'Clean'}
              </span>
            </motion.button>
          </li>

          {RIGHT.map(renderTab)}
        </ul>
      </div>
    </nav>
    </>
  )
}
