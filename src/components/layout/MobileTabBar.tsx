import { useEffect, useRef, useState } from 'react'
import type { ComponentType } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { House, LayoutGrid, ShieldAlert, CircleHelp, ScanLine, Plus } from 'lucide-react'
import { useHashRoute, navigate } from '../../lib/router'
import { cn } from '../../lib/format'
import { goToSection } from './nav'
import { useScrollState } from './Header'

type Tab = {
  key: string
  label: string
  Icon: ComponentType<{ className?: string; strokeWidth?: number }>
  /** Landing sections that light this tab up. */
  sections: string[]
  go: () => void
}

const LEFT: Tab[] = [
  {
    key: 'home',
    label: 'Home',
    Icon: House,
    sections: [],
    go: () => {
      if (window.location.hash.replace(/^#/, '').startsWith('/app')) navigate('/')
      else window.scrollTo({ top: 0, behavior: 'smooth' })
    },
  },
  { key: 'features', label: 'Features', Icon: LayoutGrid, sections: ['features', 'how-it-works'], go: () => goToSection('features') },
]
const RIGHT: Tab[] = [
  { key: 'honesty', label: 'SynthID', Icon: ShieldAlert, sections: ['honesty', 'privacy'], go: () => goToSection('honesty') },
  { key: 'faq', label: 'FAQ', Icon: CircleHelp, sections: ['faq'], go: () => goToSection('faq') },
]

/** Hides the bar while scrolling down, brings it back on any upward scroll. */
function useAutoHide() {
  const [hidden, setHidden] = useState(false)
  const last = useRef(0)
  useEffect(() => {
    last.current = window.scrollY
    const onScroll = () => {
      const y = window.scrollY
      const dy = y - last.current
      if (Math.abs(dy) < 6) return
      setHidden(dy > 0 && y > 160)
      last.current = y
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  return hidden
}

/**
 * App-style bottom navigation for phones (< md). Four tabs around a raised
 * centre action: "Scan" opens the workspace, and inside the workspace it
 * becomes "Add" and opens the file picker directly.
 */
export function MobileTabBar() {
  const route = useHashRoute()
  const reduce = useReducedMotion()
  const { active } = useScrollState(route)
  const hidden = useAutoHide()
  const inApp = route === '/app'

  const activeKey = inApp
    ? null
    : ([...LEFT, ...RIGHT].find((t) => active && t.sections.includes(active))?.key ?? 'home')

  const onCenter = () => {
    if (inApp) document.querySelector<HTMLInputElement>('input[type=file]')?.click()
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
          aria-current={on ? 'page' : undefined}
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
    <motion.nav
      aria-label="Bottom navigation"
      className="fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:hidden"
      initial={false}
      animate={{ y: hidden ? '120%' : '0%' }}
      transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 380, damping: 36 }}
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
              aria-label={inApp ? 'Add files' : 'Open the workspace and clean files'}
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
                    key={inApp ? 'add' : 'scan'}
                    initial={reduce ? false : { rotate: -90, scale: 0.5, opacity: 0 }}
                    animate={{ rotate: 0, scale: 1, opacity: 1 }}
                    transition={{ type: 'spring', stiffness: 420, damping: 24 }}
                    className="relative"
                  >
                    {inApp ? (
                      <Plus className="size-6 text-white" strokeWidth={2.6} />
                    ) : (
                      <ScanLine className="size-6 text-white" strokeWidth={2.3} />
                    )}
                  </motion.span>
                </span>
                </span>
              </span>
              <span className={cn('text-[10.5px] font-semibold tracking-tight', inApp ? 'text-primary' : 'text-foreground')}>
                {inApp ? 'Add' : 'Clean'}
              </span>
            </motion.button>
          </li>

          {RIGHT.map(renderTab)}
        </ul>
      </div>
    </motion.nav>
  )
}
