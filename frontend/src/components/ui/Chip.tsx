import type { ReactNode } from 'react'

import { cn } from '@/lib/format'

interface ChipProps {
  active: boolean
  onClick: () => void
  children: ReactNode
  className?: string
}

/** Opção em forma de pílula (categoria, matéria, tipo). `aria-pressed` reflete a seleção. */
export function Chip({ active, onClick, children, className }: ChipProps) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium transition-colors first-letter:uppercase',
        active ? 'border-accent bg-accent-soft text-accent' : 'border-line-strong bg-elevated text-ink-muted hover:text-ink',
        className,
      )}
    >
      {children}
    </button>
  )
}
