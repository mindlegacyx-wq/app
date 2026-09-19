import { cn } from '@/lib/format'
import type { TaskPriority } from '@/lib/types'

export const priorityLabel: Record<TaskPriority, string> = { low: 'Baixa', medium: 'Média', high: 'Alta' }

/** Três barras (como sinal de celular): 1 = baixa, 2 = média, 3 = alta. Neutro em cor. */
export function PriorityIcon({ priority, className }: { priority: TaskPriority; className?: string }) {
  const level = priority === 'high' ? 3 : priority === 'medium' ? 2 : 1
  return (
    <span
      className={cn('inline-flex items-end gap-[2px]', className)}
      role="img"
      aria-label={`Prioridade ${priorityLabel[priority].toLowerCase()}`}
    >
      {[1, 2, 3].map((n) => (
        <span
          key={n}
          className={cn(
            'w-[3px] rounded-[1px]',
            n === 1 ? 'h-[6px]' : n === 2 ? 'h-[9px]' : 'h-[12px]',
            n <= level ? (priority === 'high' ? 'bg-ink' : 'bg-ink-muted') : 'bg-white/12',
          )}
        />
      ))}
    </span>
  )
}
