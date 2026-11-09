import { useRef } from 'react'
import type { PointerEvent, ReactNode } from 'react'
import { cn } from '../../lib/format'

/**
 * Card with a pointer-following radial glow (pure CSS variables, no re-renders).
 * Used by the bento grid and other landing surfaces.
 */
export function GlowCard({
  children,
  className,
  glow = 'var(--primary)',
}: {
  children: ReactNode
  className?: string
  glow?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    const el = ref.current
    if (!el) return
    const r = el.getBoundingClientRect()
    el.style.setProperty('--mx', `${e.clientX - r.left}px`)
    el.style.setProperty('--my', `${e.clientY - r.top}px`)
  }
  return (
    <div
      ref={ref}
      onPointerMove={onMove}
      className={cn(
        'group/glow relative isolate overflow-hidden rounded-2xl border border-line bg-card shadow-card',
        'transition-[border-color,box-shadow,transform] duration-300 hover:-translate-y-0.5 hover:border-primary/35',
        'hover:shadow-[0_18px_50px_-24px_color-mix(in_srgb,var(--primary)_55%,transparent)]',
        className,
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-0 transition-opacity duration-500 group-hover/glow:opacity-100"
        style={{
          background: `radial-gradient(380px circle at var(--mx, 50%) var(--my, 0%), color-mix(in srgb, ${glow} 16%, transparent), transparent 65%)`,
        }}
      />
      {children}
    </div>
  )
}

/** Gradient-tinted icon tile used across landing cards. */
export function IconTile({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex size-10 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-linear-to-br from-primary/15 to-accent/10 text-primary',
        className,
      )}
    >
      {children}
    </span>
  )
}

export const CONTAINER = 'mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8'
