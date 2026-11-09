import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from '../../lib/format'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline' | 'glass'
type Size = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  children: ReactNode
}

const VARIANTS: Record<Variant, string> = {
  primary:
    'relative overflow-hidden bg-brand text-primary-fg shadow-[0_8px_24px_-8px_color-mix(in_srgb,var(--primary)_60%,transparent)] hover:shadow-[0_12px_32px_-8px_color-mix(in_srgb,var(--primary)_75%,transparent)] hover:-translate-y-px before:absolute before:inset-0 before:bg-gradient-to-b before:from-white/20 before:to-transparent before:opacity-0 hover:before:opacity-100 before:transition-opacity',
  secondary: 'bg-elevated text-foreground hover:bg-line border border-line',
  ghost: 'text-muted hover:text-foreground hover:bg-elevated',
  danger: 'bg-danger/10 text-danger hover:bg-danger/20 border border-danger/20',
  outline:
    'border border-line bg-card text-foreground hover:border-primary/50 hover:text-primary hover:bg-primary/5',
  glass: 'glass border border-line text-foreground hover:border-line-strong hover:bg-card',
}

const SIZES: Record<Size, string> = {
  sm: 'h-8 px-3 text-xs gap-1.5 rounded-lg',
  md: 'h-10 px-4 text-sm gap-2 rounded-xl',
  lg: 'h-12 px-6 text-[15px] gap-2.5 rounded-xl',
}

export function Button({ variant = 'primary', size = 'md', className, children, type = 'button', ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex shrink-0 items-center justify-center font-medium whitespace-nowrap select-none',
        'transition-all duration-200 ease-out',
        'disabled:opacity-45 disabled:pointer-events-none active:scale-[0.97]',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...rest}
    >
      <span className="relative inline-flex items-center gap-[inherit]">{children}</span>
    </button>
  )
}
