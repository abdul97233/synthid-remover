import { useEffect, useState } from 'react'
import type { ReactNode, MouseEvent } from 'react'

/**
 * Minimal hash-based router (zero dependencies). Hash routing keeps the app
 * working on GitHub Pages / any static host without rewrite rules.
 * Routes: "/" (landing), "/app" (workspace) and "/labs" (experimental tools).
 */

export function normalize(hash: string): string {
  const h = hash.replace(/^#/, '')
  if (h.startsWith('/app')) return '/app'
  if (h.startsWith('/labs')) return '/labs'
  return '/'
}

export function useHashRoute(): string {
  const [route, setRoute] = useState(() => normalize(window.location.hash))
  useEffect(() => {
    const onChange = () => setRoute(normalize(window.location.hash))
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return route
}

export function navigate(to: string): void {
  window.location.hash = to
}

/** In-page anchor that never fights the hash router. */
export function scrollToSection(id: string): void {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

export function SectionLink({
  section,
  children,
  className,
}: {
  section: string
  children: ReactNode
  className?: string
}) {
  const handle = (e: MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault()
    if (normalize(window.location.hash) !== '/') {
      window.location.hash = '/'
      window.setTimeout(() => scrollToSection(section), 80)
    } else {
      scrollToSection(section)
    }
  }
  return (
    <a href={`#${section}`} onClick={handle} className={className}>
      {children}
    </a>
  )
}
