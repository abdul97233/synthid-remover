import type { ReactNode } from 'react'
import { cn } from '../../lib/format'

export type Tone = 'primary' | 'ok' | 'warn' | 'danger' | 'neutral' | 'accent'

const TONES: Record<Tone, string> = {
  primary: 'bg-primary/10 text-primary border-primary/20',
  ok: 'bg-ok/10 text-ok border-ok/20',
  warn: 'bg-warn/10 text-warn border-warn/20',
  danger: 'bg-danger/10 text-danger border-danger/20',
  neutral: 'bg-elevated text-muted border-line',
  accent: 'bg-accent/10 text-accent border-accent/20',
}

export function Badge({
  tone = 'neutral',
  children,
  className,
}: {
  tone?: Tone
  children: ReactNode
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap',
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}

export function StatusDot({ tone = 'neutral', spin = false }: { tone?: Tone; spin?: boolean }) {
  return (
    <span
      className={cn(
        'inline-block size-2 rounded-full',
        spin && 'animate-pulse',
        tone === 'primary' && 'bg-primary',
        tone === 'ok' && 'bg-ok',
        tone === 'warn' && 'bg-warn',
        tone === 'danger' && 'bg-danger',
        tone === 'neutral' && 'bg-muted',
        tone === 'accent' && 'bg-accent',
      )}
    />
  )
}
