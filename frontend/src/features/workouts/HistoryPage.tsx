import { useMemo, useState } from 'react'
import { Link } from 'react-router'

import { Card, EmptyState, Spinner } from '@/components/ui'
import { errorMessage } from '@/lib/api'
import { useAuth } from '@/lib/auth-store'
import { WEEKDAYS_SHORT, addDays, cn, relativeDay, todayIn } from '@/lib/format'

import { useWorkoutHistory } from './api'

/** Tela 22: calendário do mês com dias treinados e lista das sessões. */
export function HistoryPage() {
  const user = useAuth((s) => s.user)!
  const today = todayIn(user.timezone)
  const [monthOffset, setMonthOffset] = useState(0)

  const { start, end, label, grid } = useMemo(() => monthGrid(today, monthOffset), [today, monthOffset])
  const history = useWorkoutHistory(start, end)

  const byDate = new Map<string, { completed: number; skipped: number }>()
  for (const item of history.data?.items ?? []) {
    const cur = byDate.get(item.date) ?? { completed: 0, skipped: 0 }
    if (item.status === 'completed') cur.completed += 1
    else cur.skipped += 1
    byDate.set(item.date, cur)
  }
  const trained = [...byDate.values()].filter((v) => v.completed > 0).length

  return (
    <div className="safe-top pt-2">
      <header className="flex h-12 items-center gap-3">
        <Link to="/treinos" aria-label="Voltar" className="-ml-2 flex size-9 items-center justify-center rounded-full text-ink-muted hover:bg-white/5 hover:text-ink">
          <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </Link>
        <h1 className="text-[20px] font-semibold tracking-[-0.02em]">Histórico</h1>
      </header>

      <Card className="mt-3">
        <div className="flex items-center justify-between">
          <button type="button" aria-label="Mês anterior" onClick={() => setMonthOffset((m) => m - 1)} className="flex size-9 items-center justify-center rounded-full text-ink-muted hover:bg-white/5">
            <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 5l-7 7 7 7" /></svg>
          </button>
          <p className="text-[15px] font-semibold first-letter:uppercase">{label}</p>
          <button type="button" aria-label="Próximo mês" disabled={monthOffset >= 0} onClick={() => setMonthOffset((m) => m + 1)} className="flex size-9 items-center justify-center rounded-full text-ink-muted hover:bg-white/5 disabled:opacity-30">
            <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 5l7 7-7 7" /></svg>
          </button>
        </div>

        <div className="mt-3 grid grid-cols-7 gap-1 text-center">
          {WEEKDAYS_SHORT.map((d, i) => (
            <span key={i} className="text-[11px] font-semibold text-ink-faint">
              {d}
            </span>
          ))}
          {grid.map((cell, i) =>
            cell ? (
              <div
                key={cell}
                className={cn(
                  'tabular flex aspect-square items-center justify-center rounded-md text-[13px]',
                  byDate.get(cell)?.completed
                    ? 'bg-accent font-semibold text-on-accent'
                    : byDate.get(cell)?.skipped
                      ? 'border border-line-strong text-ink-faint line-through'
                      : cell > today
                        ? 'text-ink-faint/40'
                        : 'text-ink-muted',
                  cell === today && !byDate.get(cell)?.completed && 'ring-1 ring-accent/60',
                )}
              >
                {Number(cell.slice(8))}
              </div>
            ) : (
              <span key={`e${i}`} />
            ),
          )}
        </div>
        <p className="mt-3 text-[13px] text-ink-muted">
          {history.isPending ? 'Carregando…' : `${trained} ${trained === 1 ? 'dia treinado' : 'dias treinados'} no mês`}
        </p>
      </Card>

      {history.isPending ? (
        <div className="flex justify-center py-10">
          <Spinner className="size-5 text-ink-faint" />
        </div>
      ) : history.isError ? (
        <EmptyState className="mt-4" title="Não foi possível carregar" description={errorMessage(history.error)} />
      ) : history.data.items.length === 0 ? (
        <EmptyState className="mt-4" compact title="Nenhuma sessão neste mês" description="Treinos concluídos ou pulados aparecem aqui." />
      ) : (
        <Card padded={false} className="mt-4 divide-y divide-line overflow-hidden">
          {history.data.items.map((it) => (
            <div key={`${it.date}-${it.workout_id}`} className="flex items-center gap-3 px-4 py-3">
              <span className="tabular w-16 shrink-0 text-[12px] text-ink-faint first-letter:uppercase">{relativeDay(it.date, today)}</span>
              <span className={cn('min-w-0 flex-1 truncate text-[15px]', it.status === 'skipped' && 'text-ink-faint line-through')}>{it.workout_name}</span>
              <span className={cn('tabular shrink-0 text-[12px]', it.status === 'completed' ? 'text-accent' : 'text-ink-faint')}>
                {it.status === 'completed' ? `${it.exercises_done}/${it.exercises_total}` : 'pulado'}
              </span>
            </div>
          ))}
        </Card>
      )}
    </div>
  )
}

/** Grade do mês (segunda a domingo), com células vazias antes do dia 1. */
function monthGrid(today: string, offset: number) {
  const [y, m] = today.split('-').map(Number) as [number, number]
  const first = new Date(Date.UTC(y, m - 1 + offset, 1))
  const start = first.toISOString().slice(0, 10)
  const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0))
  const end = last.toISOString().slice(0, 10)
  const label = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(first)
  const lead = (first.getUTCDay() + 6) % 7 // segunda = 0
  const grid: (string | null)[] = Array(lead).fill(null)
  for (let d = 0; d < last.getUTCDate(); d++) grid.push(addDays(start, d))
  return { start, end, label, grid }
}
