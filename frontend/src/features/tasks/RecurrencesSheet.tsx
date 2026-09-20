import { AnimatePresence, m } from 'motion/react'
import { useEffect, useState } from 'react'

import { EmptyState, Sheet, Spinner } from '@/components/ui'
import { describeDays } from '@/lib/format'
import { cn } from '@/lib/format'

import { RecurrenceForm } from './RecurrenceForm'
import { useRecurrences } from './api'

interface Props {
  open: boolean
  onClose: () => void
  /** abre direto na regra desta tarefa fixa */
  editingId?: string | null
}

/**
 * Lista das tarefas fixas. Editar abre na mesma camada (sheet sobre sheet some atrás no
 * celular), do mesmo jeito que a escolha de exercício do treino.
 */
export function RecurrencesSheet({ open, onClose, editingId = null }: Props) {
  const { data, isPending } = useRecurrences()
  const [editing, setEditing] = useState<string | null>(editingId)

  useEffect(() => {
    if (open) setEditing(editingId)
  }, [open, editingId])

  const current = data?.find((r) => r.id === editing) ?? null

  return (
    <Sheet open={open} onClose={onClose} title={current ? 'Editar tarefa fixa' : 'Tarefas fixas'}>
      {current ? (
        <RecurrenceForm
          recurrence={current}
          onClose={() => (editingId ? onClose() : setEditing(null))}
        />
      ) : isPending ? (
        <div className="flex justify-center py-10">
          <Spinner className="size-5 text-ink-faint" />
        </div>
      ) : (data?.length ?? 0) === 0 ? (
        <EmptyState
          title="Nenhuma tarefa fixa"
          description="Ao criar uma tarefa, escolha Repetir e marque os dias. Ela passa a aparecer sozinha todo dia marcado."
        />
      ) : (
        <ul className="flex flex-col gap-2">
          <AnimatePresence initial={false}>
            {data?.map((r, i) => (
              <m.li
                key={r.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ delay: Math.min(i, 6) * 0.03, duration: 0.2 }}
              >
                <button
                  type="button"
                  onClick={() => setEditing(r.id)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-md border border-line bg-surface px-3 py-3 text-left transition-colors active:bg-elevated',
                    !r.is_active && 'opacity-60',
                  )}
                >
                  <RepeatIcon className="size-4 shrink-0 text-accent" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px]">{r.title}</span>
                    <span className="block text-[12px] text-ink-faint first-letter:uppercase">
                      {describeDays(r.days_of_week)}
                      {!r.is_active && ' · pausada'}
                    </span>
                  </span>
                  <svg className="size-4 shrink-0 text-ink-faint" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </m.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
    </Sheet>
  )
}

/** Duas setas em ciclo: o sinal de "isso volta toda semana". */
export function RepeatIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn('size-4', className)} fill="none" aria-hidden>
      <path
        d="M4 9.5A5.5 5.5 0 0 1 9.5 4H16M16 4l-2.6-2.4M16 4l-2.6 2.4M20 14.5A5.5 5.5 0 0 1 14.5 20H8M8 20l2.6 2.4M8 20l2.6-2.4"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
