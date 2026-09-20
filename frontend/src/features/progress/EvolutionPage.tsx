import { useMemo, useState } from 'react'
import { Link } from 'react-router'

import { TopBar } from '@/app/shell/TopBar'
import { Card, EmptyState, Spinner } from '@/components/ui'
import { errorMessage } from '@/lib/api'
import { useAuth } from '@/lib/auth-store'
import { addDays, cn, todayIn } from '@/lib/format'
import type { AreaStat, HistoryDay, ProgressSummary } from '@/lib/types'

import { LevelCard } from '@/features/player/LevelCard'

import { useProgressHistory, useProgressSummary } from './api'
import { heatClass, kindLabel } from './shared'

/** Tela 23: sequência e recorde, médias 7/30 dias, mapa de calor do mês, barras por área. */
export function EvolutionPage() {
  const user = useAuth((s) => s.user)!
  const today = todayIn(user.timezone)
  const summary = useProgressSummary()

  return (
    <>
      <TopBar title="Evolução" />
      {summary.isPending ? (
        <div className="flex justify-center py-16">
          <Spinner className="size-6 text-ink-faint" />
        </div>
      ) : summary.isError ? (
        <EmptyState className="mt-6" title="Não foi possível carregar" description={errorMessage(summary.error)} />
      ) : (
        <div className="mt-2 flex flex-col gap-3">
          <LevelCard />
          <StreakCard s={summary.data} />
          <div className="grid grid-cols-2 gap-3">
            <WindowCard
              title="7 dias"
              avg={summary.data.week.average_pct}
              hit={summary.data.week.hit_days}
              tracked={summary.data.week.tracked}
            />
            <WindowCard
              title="30 dias"
              avg={summary.data.month.average_pct}
              hit={summary.data.month.hit_days}
              tracked={summary.data.month.tracked}
            />
          </div>
          <Heatmap today={today} firstDay={summary.data.first_day} target={user.settings.discipline_target} />
          <AreasCard areas={summary.data.areas} tracked={summary.data.month.tracked} />
          {summary.data.closed_days === 0 && (
            <p className="px-0.5 text-[13px] leading-relaxed text-ink-faint">
              As médias e as barras aparecem a partir do primeiro dia fechado. Hoje entra no mapa em tempo real.
            </p>
          )}
        </div>
      )}
    </>
  )
}

function StreakCard({ s }: { s: ProgressSummary }) {
  const record = s.best_streak > 0 && s.streak >= s.best_streak && s.streak > 0
  return (
    <Card className="flex items-center justify-between gap-4">
      <div>
        <p className="text-[12px] font-semibold tracking-[0.06em] text-ink-faint uppercase">Sequência</p>
        <p className="mt-1 flex items-baseline gap-1.5">
          <span className={cn('tabular text-[44px] leading-none font-semibold tracking-[-0.04em]', s.streak > 0 && 'text-accent')}>
            {s.streak}
          </span>
          <span className="text-[15px] text-ink-muted">{s.streak === 1 ? 'dia' : 'dias'}</span>
          {record && <span className="ml-1 rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-semibold text-accent">recorde</span>}
        </p>
        <p className="mt-2 text-[13px] leading-relaxed text-ink-muted">
          {s.today_hit
            ? 'Hoje já está cumprido.'
            : s.streak_before_today > 0
              ? `${s.streak_before_today} ${s.streak_before_today === 1 ? 'dia' : 'dias'} até ontem — cumpra hoje para chegar a ${s.streak_before_today + 1}.`
              : 'Cumpra a meta de hoje para começar uma sequência.'}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-[12px] font-semibold tracking-[0.06em] text-ink-faint uppercase">Recorde</p>
        <p className="tabular mt-1 text-[28px] leading-none font-semibold tracking-[-0.03em]">{s.best_streak}</p>
        <p className="mt-1 text-[12px] text-ink-faint">{s.best_streak === 1 ? 'dia' : 'dias'}</p>
      </div>
    </Card>
  )
}

function WindowCard({ title, avg, hit, tracked }: { title: string; avg: number | null; hit: number; tracked: number }) {
  return (
    <Card>
      <p className="text-[12px] font-semibold tracking-[0.06em] text-ink-faint uppercase">Média · {title}</p>
      <p className="tabular mt-1 text-[32px] leading-none font-semibold tracking-[-0.03em]">{avg === null ? '—' : `${avg}%`}</p>
      <p className="mt-2 text-[12px] text-ink-faint">
        {tracked === 0 ? 'sem dias fechados' : `${hit} de ${tracked} ${tracked === 1 ? 'dia' : 'dias'} na meta`}
      </p>
    </Card>
  )
}

function Heatmap({ today, firstDay, target }: { today: string; firstDay: string; target: number }) {
  const [offset, setOffset] = useState(0)
  const { start, end, label, grid } = useMemo(() => monthGrid(today, offset), [today, offset])
  const history = useProgressHistory(start, end)
  const byDate = new Map<string, HistoryDay>()
  for (const d of history.data?.days ?? []) byDate.set(d.date, d)
  const canGoBack = start > firstDay.slice(0, 7) + '-01'
  const hits = [...byDate.values()].filter((d) => d.hit_target).length

  return (
    <Card>
      <div className="flex items-center justify-between">
        <button
          type="button"
          aria-label="Mês anterior"
          disabled={!canGoBack}
          onClick={() => setOffset((m) => m - 1)}
          className="flex size-9 items-center justify-center rounded-full text-ink-muted hover:bg-white/5 disabled:opacity-30"
        >
          <svg
            className="size-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </button>
        <div className="text-center">
          <p className="text-[15px] font-semibold first-letter:uppercase">{label}</p>
          <p className="text-[12px] text-ink-faint">
            {history.isPending ? '…' : `${hits} ${hits === 1 ? 'dia' : 'dias'} na meta de ${target}%`}
          </p>
        </div>
        <button
          type="button"
          aria-label="Próximo mês"
          disabled={offset >= 0}
          onClick={() => setOffset((m) => m + 1)}
          className="flex size-9 items-center justify-center rounded-full text-ink-muted hover:bg-white/5 disabled:opacity-30"
        >
          <svg
            className="size-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      <div className="mt-4 grid grid-cols-7 gap-1.5 text-center text-[11px] font-semibold text-ink-faint">
        {['S', 'T', 'Q', 'Q', 'S', 'S', 'D'].map((d, i) => (
          <span key={i}>{d}</span>
        ))}
      </div>
      <div className="mt-1.5 grid grid-cols-7 gap-1.5">
        {grid.map((ymd, i) => {
          if (!ymd) return <span key={`pad-${i}`} />
          const d = byDate.get(ymd)
          const future = ymd > today
          const before = ymd < firstDay
          const inert = future || before
          const cell = (
            <span
              className={cn(
                'tabular flex aspect-square w-full items-center justify-center rounded-md text-[13px] font-semibold transition-colors',
                inert ? 'text-ink-faint/50' : heatClass(d ? d.pct : null, Boolean(d?.hit_target)),
                ymd === today && 'ring-2 ring-white/40 ring-offset-2 ring-offset-surface',
              )}
            >
              {Number(ymd.slice(-2))}
            </span>
          )
          return inert ? (
            <span key={ymd} className="block">
              {cell}
            </span>
          ) : (
            <Link key={ymd} to={`/evolucao/${ymd}`} aria-label={`Dia ${ymd}${d ? `, ${d.pct}%` : ''}`} className="block">
              {cell}
            </Link>
          )
        })}
      </div>

      <div className="mt-4 flex items-center justify-end gap-1.5 text-[11px] text-ink-faint">
        <span>0%</span>
        {['bg-white/8', 'bg-accent/10', 'bg-accent/22', 'bg-accent/45', 'bg-accent'].map((c) => (
          <span key={c} className={cn('size-3 rounded-sm', c)} />
        ))}
        <span>meta</span>
      </div>
    </Card>
  )
}

function AreasCard({ areas, tracked }: { areas: AreaStat[]; tracked: number }) {
  return (
    <Card>
      <div className="flex items-baseline justify-between">
        <p className="text-[12px] font-semibold tracking-[0.06em] text-ink-faint uppercase">Por área · 30 dias</p>
        {tracked > 0 && (
          <span className="text-[12px] text-ink-faint">
            {tracked} {tracked === 1 ? 'dia fechado' : 'dias fechados'}
          </span>
        )}
      </div>
      <ul className="mt-3 flex flex-col gap-3">
        {areas.map((a) => (
          <li key={a.kind}>
            <div className="flex items-baseline justify-between text-[14px]">
              <span>{kindLabel[a.kind]}</span>
              <span className="tabular text-ink-muted">
                {a.pct === null ? (
                  <span className="text-ink-faint">nada planejado</span>
                ) : (
                  <>
                    {a.completed}/{a.planned} ·{' '}
                    <span className={cn('font-semibold', a.pct >= 80 ? 'text-accent' : 'text-ink')}>{a.pct}%</span>
                  </>
                )}
              </span>
            </div>
            <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-white/8">
              <div
                className={cn(
                  'h-full rounded-full transition-[width] duration-500 ease-out-quart',
                  (a.pct ?? 0) >= 80 ? 'bg-accent' : 'bg-ink-muted',
                )}
                style={{ width: `${a.pct ?? 0}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
    </Card>
  )
}

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
