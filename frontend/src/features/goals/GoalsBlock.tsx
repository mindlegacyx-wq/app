import { useState } from 'react'
import { Link } from 'react-router'

import { Card, Checkbox, Section, Spinner } from '@/components/ui'
import { errorMessage } from '@/lib/api'
import { cn, relativeDay } from '@/lib/format'
import type { DayGoalAction } from '@/lib/types'

import { useGoalsDay, useToggleAction, useUpdateAction } from './api'

interface Props {
  date: string
  editable: boolean
}

/** Bloco "Ações das metas" da tela Hoje: ações com data hoje e as atrasadas. */
export function GoalsBlock({ date, editable }: Props) {
  const day = useGoalsDay(date)
  const toggle = useToggleAction({ date })
  const update = useUpdateAction()
  const [error, setError] = useState<string | null>(null)

  const actions = day.data?.actions ?? []
  const overdue = day.data?.overdue ?? []
  const aside = day.data && day.data.planned > 0 && (
    <span className={cn('tabular', day.data.completed === day.data.planned && 'text-accent')}>
      {day.data.completed}/{day.data.planned}
    </span>
  )

  return (
    <Section title="Ações das metas" aside={aside}>
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
                {overdue.map((a) => (
                  <Row
                    key={a.id}
                    action={a}
                    meta={relativeDay(a.due_date, date)}
                    editable={editable}
                    onToggle={(done) => toggle.mutate({ id: a.id, done }, { onError: (e) => setError(errorMessage(e)) })}
                    onMove={() => update.mutate({ id: a.id, due_date: date }, { onError: (e) => setError(errorMessage(e)) })}
                  />
                ))}
              </ul>
            </Card>
          )}

          {actions.length === 0 && overdue.length === 0 ? (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-dashed border-line-strong px-4 py-3.5">
              <p className="text-[14px] text-ink-muted">Nenhuma ação de meta com data hoje.</p>
              <Link to="/metas" className="shrink-0 text-[13px] font-semibold text-accent">
                Metas
              </Link>
            </div>
          ) : actions.length > 0 ? (
            <Card padded={false} className="overflow-hidden">
              <ul className="divide-y divide-line">
                {actions.map((a) => (
                  <Row
                    key={a.id}
                    action={a}
                    editable={editable}
                    onToggle={(done) => toggle.mutate({ id: a.id, done }, { onError: (e) => setError(errorMessage(e)) })}
                  />
                ))}
              </ul>
            </Card>
          ) : null}
          {error && <p className="text-[13px] text-danger">{error}</p>}
        </>
      )}
    </Section>
  )
}

function Row({
  action,
  meta,
  editable,
  onToggle,
  onMove,
}: {
  action: DayGoalAction
  meta?: string
  editable: boolean
  onToggle: (done: boolean) => void
  onMove?: () => void
}) {
  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <Checkbox label={action.title} checked={action.is_done} onChange={onToggle} disabled={!editable} />
      <Link to={`/metas/${action.goal_id}`} className="min-w-0 flex-1">
        <span className={cn('block truncate text-[15px]', action.is_done && 'text-ink-faint line-through')}>{action.title}</span>
        <span className="mt-0.5 block truncate text-[12px] text-ink-faint">
          {meta && <span className="first-letter:uppercase">{meta} · </span>}
          {action.goal_title}
        </span>
      </Link>
      {onMove && !action.is_done && editable && (
        <button type="button" onClick={onMove} className="shrink-0 text-[12px] font-semibold text-accent">
          Mover para hoje
        </button>
      )}
    </li>
  )
}
