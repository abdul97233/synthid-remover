import { navigate, scrollToSection, normalize } from '../../lib/router'

/** Landing-page sections linked from the header, footer and mobile menu. */
export const NAV_SECTIONS = [
  { id: 'features', label: 'Features' },
  { id: 'how-it-works', label: 'How it works' },
  { id: 'honesty', label: 'About SynthID' },
  { id: 'privacy', label: 'Privacy' },
  { id: 'faq', label: 'FAQ' },
] as const

export type SectionId = (typeof NAV_SECTIONS)[number]['id']

function onHomeRoute(): boolean {
  return normalize(window.location.hash) === '/'
}

/**
 * Scroll to a landing section from any route. Unlike a fixed timeout, this
 * waits (per animation frame, up to 2.5s) for the section to actually mount,
 * so it keeps working while the route exit animation is playing.
 */
export function goToSection(id: string): void {
  if (onHomeRoute() && document.getElementById(id)) {
    scrollToSection(id)
    return
  }
  navigate('/')
  const start = performance.now()
  const tick = () => {
    const el = document.getElementById(id)
    if (el && onHomeRoute()) {
      // One extra frame so the page-enter layout has settled.
      requestAnimationFrame(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }))
      return
    }
    if (performance.now() - start < 2500) requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
}
