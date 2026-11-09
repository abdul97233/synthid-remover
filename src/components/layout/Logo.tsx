import { useId } from 'react'
import { cn } from '../../lib/format'

/**
 * Brand mark: a "P" whose base trails off into fading dashes, i.e. the
 * file stays intact while its metadata is stripped away.
 */
export function LogoMark({ className }: { className?: string }) {
  const id = useId()
  return (
    <svg
      viewBox="0 0 64 64"
      aria-hidden="true"
      className={cn('size-8 shrink-0 drop-shadow-[0_6px_14px_color-mix(in_srgb,var(--primary)_45%,transparent)]', className)}
    >
      <defs>
        <linearGradient id={`${id}bg`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#5B4DFF" />
          <stop offset="0.6" stopColor="#A24DFF" />
          <stop offset="1" stopColor="#22D3EE" />
        </linearGradient>
        <linearGradient id={`${id}sh`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.28" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill={`url(#${id}bg)`} />
      <rect width="64" height="64" rx="16" fill={`url(#${id}sh)`} />
      <path
        d="M21 48V16h12.5a10 10 0 0 1 0 20H21"
        fill="none"
        stroke="#fff"
        strokeWidth="6.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M31 46h7" stroke="#fff" strokeWidth="5" strokeLinecap="round" opacity="0.6" />
      <path d="M44 46h2" stroke="#fff" strokeWidth="5" strokeLinecap="round" opacity="0.3" />
    </svg>
  )
}

/** Brand mark + wordmark, shared by header and footer. */
export function Logo({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <span className={cn('flex items-center gap-2.5', className)}>
      <LogoMark />
      {!compact && (
        <span className="text-[15px] font-semibold tracking-[-0.01em] whitespace-nowrap">
          SynthID<span className="font-normal text-muted"> Remover</span>
        </span>
      )}
    </span>
  )
}
