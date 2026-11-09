import { LoaderCircle } from 'lucide-react'
import { cn } from '../../lib/format'

export function Spinner({ className }: { className?: string }) {
  return <LoaderCircle className={cn('size-4 animate-spin text-primary', className)} aria-hidden="true" />
}

export function ProgressBar({ value, className }: { value: number; className?: string }) {
  const v = Math.max(3, Math.min(100, value))
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(value)}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn('relative h-1.5 w-full overflow-hidden rounded-full bg-line/70', className)}
    >
      <div
        className="relative h-full overflow-hidden rounded-full bg-brand transition-[width] duration-300 ease-out"
        style={{ width: `${v}%` }}
      >
        <div className="shimmer absolute inset-0" />
      </div>
    </div>
  )
}

/** Placeholder block while content loads. */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('shimmer rounded-lg bg-elevated', className)} />
}
