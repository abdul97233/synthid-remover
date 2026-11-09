import { useEffect, useRef, useState } from 'react'
import type { MouseEvent } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Sun, Moon, Menu, X, ArrowRight, Lock, FlaskConical, House } from 'lucide-react'
import { GithubIcon } from '../ui/GithubIcon'
import { GITHUB_URL } from '../../lib/constants'
import { useHashRoute } from '../../lib/router'
import { useTheme } from '../../hooks/useTheme'
import { cn } from '../../lib/format'
import { EASE } from '../ui/Motion'
import { Logo } from './Logo'
import { NAV_SECTIONS, goToSection } from './nav'

const iconBtn =
  'inline-flex size-9 items-center justify-center rounded-lg border border-line bg-card/60 text-muted transition-colors hover:border-line-strong hover:bg-elevated hover:text-foreground'

function ThemeToggle() {
  const { theme, toggle } = useTheme()
  const reduce = useReducedMotion()
  const dark = theme === 'dark'
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
      title={dark ? 'Light theme' : 'Dark theme'}
      className={cn(iconBtn, 'relative overflow-hidden')}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={theme}
          className="inline-flex"
          initial={reduce ? false : { rotate: -90, scale: 0.4, opacity: 0 }}
          animate={{ rotate: 0, scale: 1, opacity: 1 }}
          exit={reduce ? { opacity: 0 } : { rotate: 90, scale: 0.4, opacity: 0 }}
          transition={{ duration: 0.25, ease: EASE }}
        >
          {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
        </motion.span>
      </AnimatePresence>
    </button>
  )
}

/** Tracks scroll state + which landing section is currently in view. */
export function useScrollState(route: string) {
  const [scrolled, setScrolled] = useState(false)
  const [active, setActive] = useState<string | null>(null)

  useEffect(() => {
    let frame = 0
    const compute = () => {
      frame = 0
      setScrolled(window.scrollY > 8)
      if (route !== '/') {
        setActive(null)
        return
      }
      let current: string | null = null
      for (const { id } of NAV_SECTIONS) {
        const el = document.getElementById(id)
        if (el && el.getBoundingClientRect().top <= 140) current = id
      }
      const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4
      if (atBottom && window.scrollY > 0) current = NAV_SECTIONS[NAV_SECTIONS.length - 1].id
      setActive(current)
    }
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(compute)
    }
    compute()
    // Re-check once the incoming page has mounted after a route transition.
    const settle = window.setTimeout(compute, 500)
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      window.clearTimeout(settle)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [route])

  return { scrolled, active }
}

export function Header() {
  const route = useHashRoute()
  const reduce = useReducedMotion()
  const [menuOpen, setMenuOpen] = useState(false)
  const { scrolled, active } = useScrollState(route)
  const menuButtonRef = useRef<HTMLButtonElement>(null)

  // Close the menu whenever the route changes.
  useEffect(() => setMenuOpen(false), [route])

  // Escape closes, desktop breakpoint closes, body scroll is locked while open.
  useEffect(() => {
    if (!menuOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMenuOpen(false)
        menuButtonRef.current?.focus()
      }
    }
    const mq = window.matchMedia('(min-width: 1024px)')
    const onMq = () => mq.matches && setMenuOpen(false)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    mq.addEventListener('change', onMq)
    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener('keydown', onKey)
      mq.removeEventListener('change', onMq)
    }
  }, [menuOpen])

  // A mouse/touch click (detail > 0) shouldn't leave a focus ring behind, or the
  // clicked item and the scroll-tracked active item both look selected.
  // Keyboard activation (detail === 0) keeps focus for accessibility.
  const releaseFocus = (e: MouseEvent<HTMLElement>) => {
    if (e.detail > 0) e.currentTarget.blur()
  }

  const onSection = (id: string) => (e: MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault()
    releaseFocus(e)
    setMenuOpen(false)
    goToSection(id)
  }

  const goHome = (e: MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault()
    releaseFocus(e)
    setMenuOpen(false)
    if (route === '/') window.scrollTo({ top: 0, behavior: 'smooth' })
    else window.location.hash = '/'
  }

  const elevated = scrolled || menuOpen
  // Home is highlighted on the landing page until a section scrolls into view.
  const homeActive = route === '/' && !active

  return (
    <header
      className={cn(
        'sticky top-0 z-50 w-full border-b transition-[background-color,border-color,box-shadow] duration-300',
        elevated
          ? 'glass border-line/80 shadow-[0_1px_0_0_color-mix(in_srgb,var(--fg)_3%,transparent),0_8px_30px_-12px_rgb(0_0_0/0.18)]'
          : 'border-transparent bg-background/40 backdrop-blur-md',
      )}
    >
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <a href="#/" onClick={goHome} aria-label="SynthID Remover — home" className="-m-1 rounded-lg p-1">
          <Logo />
        </a>

        <nav aria-label="Primary" className="hidden lg:block">
          <ul className="flex items-center gap-0.5 rounded-full border border-line/70 bg-card/50 p-1">
            <li className="relative">
              {homeActive && (
                <motion.span
                  layoutId="nav-active"
                  aria-hidden
                  className="absolute inset-0 rounded-full border border-line bg-elevated shadow-sm"
                  transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 34 }}
                />
              )}
              <a
                href="#/"
                onClick={goHome}
                aria-current={homeActive ? 'page' : undefined}
                className={cn(
                  'relative flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors',
                  homeActive ? 'text-foreground' : 'text-muted hover:text-foreground',
                )}
              >
                <House className="size-3.5" aria-hidden="true" />
                Home
              </a>
            </li>
            {NAV_SECTIONS.map((item) => {
              const isActive = active === item.id
              return (
                <li key={item.id} className="relative">
                  {isActive && (
                    <motion.span
                      layoutId="nav-active"
                      aria-hidden
                      className="absolute inset-0 rounded-full border border-line bg-elevated shadow-sm"
                      transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 34 }}
                    />
                  )}
                  <a
                    href={`#${item.id}`}
                    onClick={onSection(item.id)}
                    aria-current={isActive ? 'location' : undefined}
                    className={cn(
                      'relative block rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors',
                      isActive ? 'text-foreground' : 'text-muted hover:text-foreground',
                    )}
                  >
                    {item.label}
                  </a>
                </li>
              )
            })}
            <li className="relative">
              {route === '/labs' && (
                <motion.span
                  layoutId="nav-active"
                  aria-hidden
                  className="absolute inset-0 rounded-full border border-line bg-elevated shadow-sm"
                  transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 34 }}
                />
              )}
              <a
                href="#/labs"
                onClick={releaseFocus}
                aria-current={route === '/labs' ? 'page' : undefined}
                className={cn(
                  'relative flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors',
                  route === '/labs' ? 'text-foreground' : 'text-muted hover:text-foreground',
                )}
              >
                <FlaskConical className="size-3.5 text-accent" aria-hidden="true" />
                Labs
              </a>
            </li>
          </ul>
        </nav>

        <div className="flex items-center gap-2">
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noreferrer noopener"
            aria-label="View source on GitHub (opens in a new tab)"
            className={cn(iconBtn, 'max-sm:hidden')}
          >
            <GithubIcon className="size-4" />
          </a>
          <ThemeToggle />
          <a
            href="#/app"
            aria-current={route === '/app' ? 'page' : undefined}
            className="group hidden h-9 items-center gap-1.5 rounded-lg bg-brand px-3.5 text-[13px] font-medium text-primary-fg shadow-[0_6px_20px_-8px_color-mix(in_srgb,var(--primary)_70%,transparent)] transition-all hover:-translate-y-px hover:shadow-[0_10px_28px_-8px_color-mix(in_srgb,var(--primary)_80%,transparent)] sm:inline-flex"
          >
            {route === '/app' ? 'Workspace' : 'Open app'}
            <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
          </a>
          <button
            ref={menuButtonRef}
            type="button"
            className={cn(iconBtn, 'max-md:hidden lg:hidden')}
            onClick={() => setMenuOpen((v) => !v)}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={menuOpen ? 'x' : 'menu'}
                className="inline-flex"
                initial={reduce ? false : { rotate: -45, opacity: 0 }}
                animate={{ rotate: 0, opacity: 1 }}
                exit={reduce ? { opacity: 0 } : { rotate: 45, opacity: 0 }}
                transition={{ duration: 0.18 }}
              >
                {menuOpen ? <X className="size-4" /> : <Menu className="size-4" />}
              </motion.span>
            </AnimatePresence>
          </button>
        </div>
      </div>

      <AnimatePresence>
        {menuOpen && (
          <>
            <motion.div
              key="backdrop"
              aria-hidden
              onClick={() => setMenuOpen(false)}
              className="absolute inset-x-0 top-full h-[100dvh] bg-background/60 backdrop-blur-sm lg:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            />
            <motion.nav
              key="panel"
              id="mobile-menu"
              aria-label="Mobile"
              className="absolute inset-x-0 top-full max-h-[calc(100dvh-4rem)] overflow-y-auto border-b border-line bg-background shadow-[0_24px_48px_-24px_rgb(0_0_0/0.35)] lg:hidden"
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, y: -8 }}
              transition={{ duration: 0.25, ease: EASE }}
            >
              <motion.ul
                className="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-4 sm:px-6"
                initial="hidden"
                animate="show"
                variants={{ hidden: {}, show: { transition: { staggerChildren: reduce ? 0 : 0.04 } } }}
              >
                <motion.li variants={{ hidden: { opacity: 0, x: reduce ? 0 : -8 }, show: { opacity: 1, x: 0 } }}>
                  <a
                    href="#/"
                    onClick={goHome}
                    className={cn(
                      'flex items-center justify-between rounded-xl px-3 py-3 text-[15px] font-medium transition-colors hover:bg-elevated',
                      homeActive ? 'bg-elevated text-foreground' : 'text-muted hover:text-foreground',
                    )}
                  >
                    <span className="inline-flex items-center gap-2">
                      <House className="size-4" aria-hidden="true" /> Home
                    </span>
                    <ArrowRight className="size-4 text-subtle" />
                  </a>
                </motion.li>
                {NAV_SECTIONS.map((item) => (
                  <motion.li
                    key={item.id}
                    variants={{ hidden: { opacity: 0, x: reduce ? 0 : -8 }, show: { opacity: 1, x: 0 } }}
                  >
                    <a
                      href={`#${item.id}`}
                      onClick={onSection(item.id)}
                      className={cn(
                        'flex items-center justify-between rounded-xl px-3 py-3 text-[15px] font-medium transition-colors hover:bg-elevated',
                        active === item.id ? 'bg-elevated text-foreground' : 'text-muted hover:text-foreground',
                      )}
                    >
                      {item.label}
                      <ArrowRight className="size-4 text-subtle" />
                    </a>
                  </motion.li>
                ))}
                <motion.li variants={{ hidden: { opacity: 0, x: reduce ? 0 : -8 }, show: { opacity: 1, x: 0 } }}>
                  <a
                    href="#/labs"
                    onClick={() => setMenuOpen(false)}
                    className={cn(
                      'flex items-center justify-between rounded-xl px-3 py-3 text-[15px] font-medium transition-colors hover:bg-elevated',
                      route === '/labs' ? 'bg-elevated text-foreground' : 'text-muted hover:text-foreground',
                    )}
                  >
                    <span className="inline-flex items-center gap-2">
                      <FlaskConical className="size-4 text-accent" aria-hidden="true" /> Labs
                      <span className="rounded bg-accent/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-accent">Experimental</span>
                    </span>
                    <ArrowRight className="size-4 text-subtle" />
                  </a>
                </motion.li>
                <motion.li variants={{ hidden: { opacity: 0 }, show: { opacity: 1 } }} className="mt-3 grid gap-2 border-t border-line pt-4 sm:grid-cols-2">
                  <a
                    href="#/app"
                    onClick={() => setMenuOpen(false)}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-brand text-sm font-medium text-primary-fg"
                  >
                    Open the app <ArrowRight className="size-4" />
                  </a>
                  <a
                    href={GITHUB_URL}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-line bg-card text-sm font-medium"
                  >
                    <GithubIcon className="size-4" /> Source on GitHub
                  </a>
                </motion.li>
                <motion.li variants={{ hidden: { opacity: 0 }, show: { opacity: 1 } }}>
                  <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-muted">
                    <Lock className="size-3 text-ok" /> Files never leave your device
                  </p>
                </motion.li>
              </motion.ul>
            </motion.nav>
          </>
        )}
      </AnimatePresence>
    </header>
  )
}
