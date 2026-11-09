import { useRef, type KeyboardEvent } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import type { FileItem } from '../../types'
import { FileCard } from './FileCard'
import { EASE } from '../ui/Motion'

/**
 * Animated queue. Arrow Up/Down (and Home/End) move focus + selection between
 * files, so the whole list is usable from the keyboard.
 */
export function FileList({
  items,
  selectedId,
  onSelect,
  onRemove,
}: {
  items: FileItem[]
  selectedId: string | null
  onSelect: (id: string) => void
  onRemove: (id: string) => void
}) {
  const reduce = useReducedMotion()
  const refs = useRef(new Map<string, HTMLButtonElement>())

  const move = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let next = -1
    if (e.key === 'ArrowDown') next = Math.min(items.length - 1, index + 1)
    else if (e.key === 'ArrowUp') next = Math.max(0, index - 1)
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = items.length - 1
    if (next === -1 || next === index) return
    e.preventDefault()
    const id = items[next].id
    refs.current.get(id)?.focus()
    onSelect(id)
  }

  return (
    <ul aria-label="Files in workspace" className="space-y-2">
      <AnimatePresence initial={false} mode="popLayout">
        {items.map((item, index) => (
          <motion.li
            key={item.id}
            layout={!reduce}
            initial={reduce ? false : { opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, x: -24, scale: 0.96, transition: { duration: 0.2 } }}
            transition={{ duration: 0.35, ease: EASE }}
          >
            <FileCard
              ref={(el) => {
                if (el) refs.current.set(item.id, el)
                else refs.current.delete(item.id)
              }}
              item={item}
              selected={selectedId === item.id}
              onSelect={() => onSelect(item.id)}
              onRemove={() => onRemove(item.id)}
              onKeyDown={(e) => move(e, index)}
            />
          </motion.li>
        ))}
      </AnimatePresence>
    </ul>
  )
}
