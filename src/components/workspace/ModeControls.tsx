import { useId } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { Wand2, SlidersHorizontal, type LucideIcon } from 'lucide-react'
import { cn } from '../../lib/format'
import type { Preferences } from '../../lib/preferences'

/** Simple / Advanced segmented switch with a sliding thumb. */
export function ModeSwitch({ mode, onChange }: { mode: Preferences['mode']; onChange: (m: Preferences['mode']) => void }) {
  const reduce = useReducedMotion()
  const id = useId()
  const options = [
    { value: 'simple' as const, label: 'Simple', icon: Wand2, hint: 'Auto-clean and download' },
    { value: 'advanced' as const, label: 'Advanced', icon: SlidersHorizontal, hint: 'Inspect, compare and fine-tune' },
  ]
  return (
    <div role="radiogroup" aria-label="Workspace mode" className="inline-flex shrink-0 self-start rounded-xl border border-line bg-elevated/70 p-1 sm:self-auto">
      {options.map((o) => {
        const on = mode === o.value
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            title={o.hint}
            onClick={() => onChange(o.value)}
            className={cn(
              'relative inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors',
              on ? 'text-foreground' : 'text-muted hover:text-foreground',
            )}
          >
            {on && (
              <motion.span
                layoutId={`${id}-thumb`}
                aria-hidden
                className="absolute inset-0 rounded-lg border border-line bg-card shadow-sm"
                transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 450, damping: 34 }}
              />
            )}
            <o.icon className={cn('relative size-4', on && 'text-primary')} aria-hidden="true" />
            <span className="relative">{o.label}</span>
          </button>
        )
      })}
    </div>
  )
}

/** Accessible on/off switch with a label. */
export function PrefSwitch({
  label,
  checked,
  onChange,
  icon: Icon,
}: {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
  icon?: LucideIcon
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="inline-flex items-center gap-2.5 self-start text-sm font-medium sm:self-auto"
    >
      <span
        className={cn(
          'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition-colors duration-200',
          checked ? 'border-primary bg-primary' : 'border-line-strong bg-elevated',
        )}
      >
        <span
          className={cn(
            'inline-block size-3.5 rounded-full bg-white shadow transition-transform duration-200',
            checked ? 'translate-x-[18px]' : 'translate-x-[2px]',
          )}
        />
      </span>
      {Icon && <Icon className="size-3.5 text-subtle" aria-hidden="true" />}
      {label}
    </button>
  )
}

/** Output file naming preference. */
export function NamingSelect({ value, onChange }: { value: Preferences['naming']; onChange: (v: Preferences['naming']) => void }) {
  const opts = [
    { v: 'suffix' as const, label: 'photo-cleaned.jpg' },
    { v: 'original' as const, label: 'photo.jpg' },
  ]
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="font-medium">File names</span>
      <div role="radiogroup" aria-label="Output file names" className="inline-flex rounded-lg border border-line bg-elevated/60 p-0.5">
        {opts.map((o) => (
          <button
            key={o.v}
            type="button"
            role="radio"
            aria-checked={value === o.v}
            onClick={() => onChange(o.v)}
            className={cn(
              'rounded-md px-2 py-1 font-mono text-[11px] transition-colors',
              value === o.v ? 'bg-card text-foreground shadow-sm' : 'text-muted hover:text-foreground',
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}
