import { useCallback, useSyncExternalStore } from 'react'

export type Theme = 'light' | 'dark'

const STORAGE_KEY = 'sr-theme'

const read = (): Theme => (document.documentElement.classList.contains('dark') ? 'dark' : 'light')

/** Every toggle in the UI observes the <html> class, so they never disagree. */
function subscribe(onChange: () => void) {
  const obs = new MutationObserver(onChange)
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
  return () => obs.disconnect()
}

/**
 * Theme state. Stored only in localStorage as a functional preference —
 * this app sets no cookies and performs no tracking of any kind.
 */
export function useTheme(): { theme: Theme; toggle: () => void } {
  const theme = useSyncExternalStore(subscribe, read, read)

  const toggle = useCallback(() => {
    const next: Theme = read() === 'dark' ? 'light' : 'dark'
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      /* private mode — ignore */
    }
    document.documentElement.classList.toggle('dark', next === 'dark')
  }, [])

  return { theme, toggle }
}
