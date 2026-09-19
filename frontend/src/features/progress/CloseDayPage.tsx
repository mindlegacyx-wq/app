import { useState } from 'react'
import { Link, useNavigate } from 'react-router'

import { Button, Card, Ring, Spinner } from '@/components/ui'
import { errorMessage } from '@/lib/api'
import { useAuth } from '@/lib/auth-store'
import { cn, longDate, timeIn, todayIn } from '@/lib/format'
import type { DayScore, ScoreComponent } from '@/lib/types'

import { useCloseDay, useDayScore, useReopenDay } from './api'
import { kindLabel } from './shared'


/** Tela 8: resumo do dia, o que ficou de fora, sequência; confirma o fechamento. */
export function CloseDayPage() {
  const user = useAuth((s) => s.user)!
  const navigate = useNavigate()
  const date = todayIn(user.timezone)
  const score = useDayScore(date)
  const close = useCloseDay(date)
  const reopen = useReopenDay(date)
  const [error, setError] = useState<string | null>(null)

  if (score.isPending) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Spinner className="size-6 text-ink-faint" />
      </div>
    )
  }
  if (score.isError) {
    return (
      <div className="safe-top pt-2">
        <Header />
        <Card className="mt-6 text-[14px] text-ink-muted">{errorMessage(score.error)}</Card>
      </div>
    )
  }

  const d = score.data
  const closed = !d.is_open && d.closed_at !== null
  const previousStreak = d.hit_target ? Math.max(d.streak - 1, 0) : null

  return (
    <div className="safe-top flex min-h-dvh flex-col pt-2">
      <Header />

      <div className="mt-6 flex flex-col items-center text-center">
        <p className="text-[13px] text-ink-muted first-letter:uppercase">{longDate()}</p>
        <Ring value={d.pct} size={196} stroke={14} muted={d.planned === 0} className="mt-5">
          <span className="tabular text-[52px] leading-none font-semibold tracking-[-0.04em]">{d.pct}%</span>
          <span className="mt-1.5 text-[12px] text-ink-muted">
            {d.completed} de {d.planned}
          </span>
        </Ring>

        <h1 className="mt-6 text-[26px] leading-tight font-semibold tracking-[-0.03em]">
          {d.hit_target ? 'Dia cumprido.' : d.planned === 0 ? 'Nada planejado.' : 'Meta não atingida.'}
        </h1>
        <p className="mt-2 max-w-xs text-[15px] leading-relaxed text-ink-muted">
          {d.hit_target
            ? d.pct > d.target
              ? `Você fez ${d.pct}% do que planejou, acima da meta de ${d.target}%.`
              : `Você fez ${d.pct}% do que planejou, exatamente na meta.`
            : d.planned === 0
              ? 'Sem plano não há o que medir. Dia vazio zera a sequência.'
              : `Você fez ${d.pct}% do que planejou. A meta era ${d.target}%.`}
        </p>
      </div>

      <Card className="mt-7 flex items-center justify-between">
        <div>
          <p className="text-[12px] text-ink-faint">Sequência</p>
          <p className="tabular mt-0.5 text-[22px] leading-tight font-semibold tracking-[-0.02em]">
            {previousStreak !== null && previousStreak !== d.streak ? (
              <>
                <span className="text-ink-faint">{previousStreak}</span>
                <span className="mx-2 text-ink-faint">→</span>
                <span className="text-accent">{d.streak}</span>
              </>
            ) : (
              <span className={cn(d.streak === 0 && 'text-ink-muted')}>{d.streak}</span>
            )}
            <span className="ml-1.5 text-[13px] font-medium text-ink-muted">{d.streak === 1 ? 'dia' : 'dias'}</span>
          </p>
        </div>
        <div className="text-right">
          <p className="text-[12px] text-ink-faint">Recorde</p>
          <p className="tabular mt-0.5 text-[22px] leading-tight font-semibold tracking-[-0.02em]">{d.best_streak}</p>
        </div>
      </Card>

      {d.missing.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-2 px-0.5 text-[12px] font-semibold tracking-[0.08em] text-ink-faint uppercase">
            Ficou de fora · {d.missing.length}
          </h2>
          <Card padded={false} className="divide-y divide-line overflow-hidden">
            {d.missing.map((m, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                <span className="w-16 shrink-0 text-[11px] font-semibold tracking-[0.06em] text-ink-faint uppercase">
                  {kindLabel[m.kind]}
                </span>
                <span className="truncate text-[14px] text-ink-muted">{m.title}</span>
              </div>
            ))}
          </Card>
        </section>
      )}

      <div className="mt-6">
        <h2 className="mb-2 px-0.5 text-[12px] font-semibold tracking-[0.08em] text-ink-faint uppercase">Por área</h2>
        <Card padded={false} className="divide-y divide-line overflow-hidden">
          {(Object.keys(kindLabel) as ScoreComponent[])
            .filter((k) => d.breakdown[k].planned > 0)
            .map((k) => (
              <Area key={k} label={kindLabel[k]} planned={d.breakdown[k].planned} completed={d.breakdown[k].completed} />
            ))}
        </Card>
      </div>

      {error && (
        <p role="alert" className="mt-4 rounded-md border border-danger/30 bg-danger-soft px-3 py-2.5 text-[14px] text-danger">
          {error}
        </p>
      )}

      <div className="mt-auto flex flex-col gap-2 pt-8 pb-6">
        {closed ? (
          <>
            <p className="text-center text-[13px] text-ink-muted">
              Dia fechado às {timeIn(d.closed_at!, user.timezone)}
              {d.finalized ? ' · definitivo' : ''}
            </p>
            <Button size="lg" full onClick={() => navigate('/hoje')}>
              Voltar para Hoje
            </Button>
            {d.can_reopen && (
              <Button
                variant="ghost"
                full
                loading={reopen.isPending}
                onClick={() => reopen.mutate(undefined, { onError: (e) => setError(errorMessage(e)) })}
              >
                Reabrir o dia
              </Button>
            )}
          </>
        ) : (
          <>
            <Button
              size="lg"
              full
              disabled={!d.can_close}
              loading={close.isPending}
              onClick={() => close.mutate(undefined, { onError: (e) => setError(errorMessage(e)) })}
            >
              Fechar o dia
            </Button>
            <p className="text-center text-[13px] text-ink-faint">
              {d.can_close
                ? 'Congela o percentual de hoje. Dá para reabrir até as 03:00.'
                : 'Não há nada planejado para fechar.'}
            </p>
            <Button variant="ghost" full onClick={() => navigate('/hoje')}>
              Ainda não
            </Button>
          </>
        )}
      </div>
    </div>
  )
}

function Header() {
  return (
    <header className="flex h-12 items-center gap-3">
      <Link to="/hoje" aria-label="Voltar" className="-ml-2 flex size-9 items-center justify-center rounded-full text-ink-muted hover:bg-white/5 hover:text-ink">
        <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 5l-7 7 7 7" />
        </svg>
      </Link>
      <h1 className="text-[20px] font-semibold tracking-[-0.02em]">Fechar o dia</h1>
    </header>
  )
}

function Area({ label, planned, completed }: { label: string; planned: number; completed: number }) {
  const pct = Math.round((completed / planned) * 100)
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <span className="w-16 shrink-0 text-[14px]">{label}</span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/8">
        <div className={cn('h-full rounded-full', pct === 100 ? 'bg-accent' : 'bg-ink-muted')} style={{ width: `${pct}%` }} />
      </div>
      <span className="tabular w-12 shrink-0 text-right text-[13px] text-ink-muted">
        {completed}/{planned}
      </span>
    </div>
  )
}

export type { DayScore }
