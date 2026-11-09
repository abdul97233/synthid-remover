import { useId, useState } from 'react'
import type { ComponentType } from 'react'
import { motion } from 'framer-motion'
import { cn } from '../../lib/format'

export interface TabItem {
  id: string
  label: string
  icon?: ComponentType<{ className?: string }>
}

export function Tabs({
  items,
  active,
  onChange,
  className,
}: {
  items: TabItem[]
  active: string
  onChange: (id: string) => void
  className?: string
}) {
  const layoutId = useId()
  return (
    <div
      role="tablist"
      className={cn(
        'no-scrollbar flex w-full items-center gap-1 overflow-x-auto rounded-xl border border-line bg-elevated/60 p-1',
        className,
      )}
    >
      {items.map((item) => {
        const Icon = item.icon
        const selected = active === item.id
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(item.id)}
            className={cn(
              'relative flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-200',
              selected ? 'text-foreground' : 'text-muted hover:text-foreground',
            )}
          >
            {selected && (
              <motion.span
                layoutId={layoutId}
                className="absolute inset-0 rounded-lg border border-line bg-card shadow-sm"
                transition={{ type: 'spring', stiffness: 420, damping: 34 }}
              />
            )}
            <span className="relative inline-flex items-center gap-1.5">
              {Icon && <Icon className="size-4 shrink-0" />}
              {item.label}
            </span>
          </button>
        )
      })}
    </div>
  )
}

export function useTabs(defaultId: string) {
  return useState(defaultId)
}
