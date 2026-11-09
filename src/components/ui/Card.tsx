import type { ReactNode } from 'react'
import { cn } from '../../lib/format'
import { Reveal } from './Motion'

export function Card({
  className,
  children,
  interactive = false,
}: {
  className?: string
  children: ReactNode
  /** Adds a lift + glow on hover. */
  interactive?: boolean
}) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-line bg-card shadow-card',
        interactive &&
          'transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-glow',
        className,
      )}
    >
      {children}
    </div>
  )
}

export function SectionHeading({
  id,
  eyebrow,
  title,
  description,
  align = 'center',
}: {
  id?: string
  eyebrow?: string
  title: ReactNode
  description?: ReactNode
  align?: 'center' | 'left'
}) {
  return (
    <Reveal
      id={id}
      className={cn(
        'mb-10 max-w-2xl scroll-mt-24 lg:mb-14',
        align === 'center' ? 'mx-auto text-center' : 'text-left',
      )}
    >
      <h2 className="text-3xl font-semibold tracking-[-0.025em] text-balance sm:text-4xl lg:text-[2.75rem] lg:leading-[1.1]">
        {title}
      </h2>
      {description && <p className="mt-4 text-pretty text-base leading-relaxed text-muted sm:text-lg">{description}</p>}
    </Reveal>
  )
}
