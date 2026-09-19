import type { ReactNode } from 'react'

import { cn } from '@/lib/format'

interface EmptyStateProps {
  title: string
  description?: string
  action?: ReactNode
  compact?: boolean
  className?: string
}

/** Toda lista vazia ensina o próximo passo. Nunca tela branca. */
export function EmptyState({ title, description, action, compact = false, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center rounded-lg border border-dashed border-line-strong text-center',
        compact ? 'gap-1.5 px-4 py-5' : 'gap-2 px-6 py-10',
        className,
      )}
    >
      <p className={cn('font-semibold', compact ? 'text-[15px]' : 'text-[17px]')}>{title}</p>
      {description && <p className="max-w-xs text-[14px] leading-relaxed text-ink-muted">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}
