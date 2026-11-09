import { useSyncExternalStore } from 'react'

/**
 * User preferences, kept only in this browser's localStorage (functional
 * settings — never sent anywhere, never used for tracking).
 */
export interface Preferences {
  /** Simple = drop → auto-clean → download. Advanced = full inspection workspace. */
  mode: 'simple' | 'advanced'
  /** Advanced mode: clean automatically as soon as analysis finishes. */
  autoClean: boolean
  /** Output names: "photo-cleaned.jpg" (suffix) or "photo.jpg" (original). */
  naming: 'suffix' | 'original'
  /** Advanced mode: experimental "add metadata" tool (opt-in). */
  tagger: boolean
}

const KEY = 'sr-prefs'
const DEFAULTS: Preferences = { mode: 'simple', autoClean: false, naming: 'suffix', tagger: false }

function load(): Preferences {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return DEFAULTS
    const p = JSON.parse(raw) as Partial<Preferences>
    return {
      mode: p.mode === 'advanced' ? 'advanced' : 'simple',
      autoClean: p.autoClean === true,
      naming: p.naming === 'original' ? 'original' : 'suffix',
      tagger: p.tagger === true,
    }
  } catch {
    return DEFAULTS
  }
}

let current: Preferences = load()
const listeners = new Set<() => void>()

export function getPreferences(): Preferences {
  return current
}

export function setPreference<K extends keyof Preferences>(key: K, value: Preferences[K]): void {
  if (current[key] === value) return
  current = { ...current, [key]: value }
  try {
    localStorage.setItem(KEY, JSON.stringify(current))
  } catch {
    /* private mode — keep in memory only */
  }
  listeners.forEach((l) => l())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function usePreferences(): Preferences {
  return useSyncExternalStore(subscribe, getPreferences, getPreferences)
}
