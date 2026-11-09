import { useEffect, useRef } from 'react'
import type { FileItem } from '../types'

/**
 * Clean each file automatically once its analysis succeeds — at most once per
 * file, so a failed clean never loops. The worker runs jobs one at a time.
 */
export function useAutoClean(items: FileItem[], clean: (id: string) => Promise<void> | void, enabled: boolean): void {
  const tried = useRef(new Set<string>())
  useEffect(() => {
    if (!enabled) return
    for (const it of items) {
      if (it.status === 'ready' && it.analysis && !it.clean && it.structure && !it.structure.parseError && !tried.current.has(it.id)) {
        tried.current.add(it.id)
        void clean(it.id)
      }
    }
  }, [items, clean, enabled])
}
