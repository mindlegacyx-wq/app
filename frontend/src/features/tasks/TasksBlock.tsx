import { useState } from 'react'

import { Card, Checkbox, Section, Spinner } from '@/components/ui'
import { errorMessage } from '@/lib/api'
import { cn, relativeDay } from '@/lib/format'
import type { Task, TaskCategory } from '@/lib/types'

import { PriorityIcon } from './PriorityIcon'
import { useCategories, useTasksDay, useToggleTask, useUpdateTask } from './api'

interface Props {
  date: string
  today: string
  onAdd: () => void
  onEdit: (task: Task) => void
}

/** Bloco "Tarefas" da tela Hoje: atrasadas, pendentes por prioridade, feitas e canceladas. */
export function TasksBlock({ date, today, onAdd, onEdit }: Props) {
  const day = useTasksDay(date)
  const cats = useCategories()
  const toggle = useToggleTask(date)
  const update = useUpdateTask()
  const [error, setError] = useState<string | null>(null)
  const [showCancelled, setShowCancelled] = useState(false)

  const byId = new Map((cats.data ?? []).map((c) => [c.id, c]))
  const tasks = day.data?.tasks ?? []
  const visible = tasks.filter((t) => t.status !== 'cancelled' || showCancelled)
  const cancelledCount = tasks.filter((t) => t.status === 'cancelled').length
  const overdue = day.data?.overdue ?? []

  const aside = day.data && day.data.planned > 0 && (
    <span className={cn('tabular', day.data.completed === day.data.planned && 'text-accent')}>
      {day.data.completed}/{day.data.planned}
    </span>
  )

  return (
    <Section title="Tarefas" aside={aside}>
      {day.isPending ? (
        <Card className="flex h-14 items-center justify-center">
          <Spinner className="size-5 text-ink-faint" />
        </Card>
      ) : day.isError ? (
        <Card className="text-[14px] text-ink-muted">{errorMessage(day.error)}</Card>
      ) : (
        <>
          {overdue.length > 0 && (
            <Card padded={false} className="overflow-hidden border-warning/30">
              <p className="px-4 pt-3 pb-1 text-[12px] font-semibold tracking-[0.06em] text-warning uppercase">
                Atrasadas · {overdue.length}
              </p>
              <ul className="divide-y divide-line">
                {overdue.map((t) => (
                  <TaskRow
                    key={t.id}
                    task={t}
                    category={t.category_id ? byId.get(t.category_id) : undefined}
                    meta={relativeDay(t.date, today)}
                    onToggle={(done) => toggle.mutate({ id: t.id, done }, { onError: (e) => setError(errorMessage(e)) })}
                    onOpen={() => onEdit(t)}
                    action={{
                      label: 'Mover para hoje',
                      onClick: () => update.mutate({ id: t.id, date: today }, { onError: (e) => setError(errorMessage(e)) }),
                    }}
                  />
                ))}
              </ul>
            </Card>
          )}

          {visible.length === 0 && overdue.length === 0 ? (
            <button
              type="button"
              onClick={onAdd}
              className="flex w-full items-center justify-between gap-3 rounded-lg border border-dashed border-line-strong px-4 py-3.5 text-left transition-colors hover:bg-white/3"
            >
              <p className="text-[14px] text-ink-muted">Nada planejado para {date === today ? 'hoje' : 'este dia'}.</p>
              <span className="shrink-0 text-[13px] font-semibold text-accent">+ Tarefa</span>
            </button>
          ) : visible.length > 0 ? (
            <Card padded={false} className="overflow-hidden">
              <ul className="divide-y divide-line">
                {visible.map((t) => (
                  <TaskRow
                    key={t.id}
                    task={t}
                    category={t.category_id ? byId.get(t.category_id) : undefined}
                    onToggle={(done) => toggle.mutate({ id: t.id, done }, { onError: (e) => setError(errorMessage(e)) })}
                    onOpen={() => onEdit(t)}
                  />
                ))}
              </ul>
            </Card>
          ) : null}

          {cancelledCount > 0 && (
            <button
              type="button"
              onClick={() => setShowCancelled((s) => !s)}
              className="self-start px-0.5 text-[12px] text-ink-faint hover:text-ink-muted"
            >
              {showCancelled ? 'Ocultar canceladas' : `${cancelledCount} cancelada${cancelledCount > 1 ? 's' : ''}`}
            </button>
          )}
          {error && <p className="text-[13px] text-danger">{error}</p>}
        </>
      )}
    </Section>
  )
}

function TaskRow({
  task,
  category,
  meta,
  onToggle,
  onOpen,
  action,
}: {
  task: Task
  category?: TaskCategory
  meta?: string
  onToggle: (done: boolean) => void
  onOpen: () => void
  action?: { label: string; onClick: () => void }
}) {
  const done = task.status === 'done'
  const cancelled = task.status === 'cancelled'
  return (
    <li className={cn('flex items-center gap-3 px-4 py-3', cancelled && 'opacity-50')}>
      {cancelled ? (
        <span className="flex size-7 shrink-0 items-center justify-center text-ink-faint" aria-label="Cancelada">
          <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </span>
      ) : (
        <Checkbox label={task.title} checked={done} onChange={onToggle} />
      )}
      <button type="button" onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
        <span className={cn('min-w-0 flex-1', done && 'text-ink-faint line-through', cancelled && 'line-through')}>
          <span className="block truncate text-[15px]">{task.title}</span>
          {(category || meta) && (
            <span className="mt-0.5 flex items-center gap-2 text-[12px] text-ink-faint">
              {meta && <span className="first-letter:uppercase">{meta}</span>}
              {category && (
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-2 rounded-full" style={{ background: category.color }} aria-hidden />
                  {category.name}
                </span>
              )}
            </span>
          )}
        </span>
        {!done && !cancelled && <PriorityIcon priority={task.priority} className="shrink-0" />}
      </button>
      {action && !done && (
        <button type="button" onClick={action.onClick} className="shrink-0 text-[12px] font-semibold text-accent">
          {action.label}
        </button>
      )}
    </li>
  )
}
