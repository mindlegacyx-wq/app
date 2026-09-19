import type { HTMLAttributes, ReactNode } from 'react'

import { cn } from '@/lib/format'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padded?: boolean
}

export function Card({ padded = true, className, ...rest }: CardProps) {
  return (
    <div
      {...rest}
      className={cn('rounded-lg border border-line bg-surface', padded && 'p-4', className)}
    />
  )
}

interface SectionProps {
  title: string
  aside?: ReactNode
  children: ReactNode
  className?: string
}

/** Bloco de conteúdo com título discreto em caixa alta. Usado na tela Hoje. */
export function Section({ title, aside, children, className }: SectionProps) {
  return (
    <section className={cn('flex flex-col gap-2.5', className)}>
      <header className="flex items-baseline justify-between px-0.5">
        <h2 className="text-[12px] font-semibold tracking-[0.08em] text-ink-faint uppercase">{title}</h2>
        {aside && <div className="text-[13px] text-ink-muted">{aside}</div>}
      </header>
      {children}
    </section>
  )
}
