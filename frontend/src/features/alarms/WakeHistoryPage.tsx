import { Link } from 'react-router'

import { Card, EmptyState, Spinner } from '@/components/ui'
import { useWakeHistory } from '@/features/wake/api'
import { errorMessage } from '@/lib/api'
import { useAuth } from '@/lib/auth-store'
import { addDays, cn, relativeDay, timeIn, todayIn } from '@/lib/format'
import type { WakeHistoryDay, WakeStatus } from '@/lib/types'

const statusLabel: Record<WakeStatus, string> = {
  confirmed: 'Confirmado',
  manual: 'Manual',
  missed: 'Perdido',
  pending: 'Tocando',
}

/** Tela 14: últimos 30 dias — planejado × levantou, atraso, sonecas. */
export function WakeHistoryPage() {
  const user = useAuth((s) => s.user)!
  const today = todayIn(user.timezone)
  const start = addDays(today, -29)
  const history = useWakeHistory(start, today)

  return (
    <div className="safe-top pt-2">
      <header className="flex h-12 items-center gap-3">
        <Link to="/despertador" aria-label="Voltar" className="-ml-2 flex size-9 items-center justify-center rounded-full text-ink-muted hover:bg-white/5 hover:text-ink">
          <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </Link>
        <h1 className="text-[20px] font-semibold tracking-[-0.02em]">Histórico de acordar</h1>
      </header>

      {history.isPending ? (
        <div className="flex justify-center py-16">
          <Spinner className="size-6 text-ink-faint" />
        </div>
      ) : history.isError ? (
        <EmptyState className="mt-6" title="Não foi possível carregar" description={errorMessage(history.error)} />
      ) : (
        <>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <Stat label="Levantou" value={String(history.data.confirmed)} hint="de 30 dias" />
            <Stat label="Perdidos" value={String(history.data.missed)} danger={history.data.missed > 0} />
            <Stat label="Atraso" value={history.data.average_delay_minutes === null ? '—' : `${history.data.average_delay_minutes > 0 ? '+' : ''}${history.data.average_delay_minutes}`} hint="min · média" />
          </div>

          {history.data.days.length === 0 ? (
            <EmptyState className="mt-6" title="Nenhum registro ainda" description="A partir do primeiro alarme confirmado (ou do primeiro “Levantei”), cada dia aparece aqui." />
          ) : (
            <Card padded={false} className="mt-4 divide-y divide-line overflow-hidden">
              {history.data.days.map((d) => (
                <Row key={d.date} day={d} today={today} timezone={user.timezone} />
              ))}
            </Card>
          )}
        </>
      )}
    </div>
  )
}

function Stat({ label, value, hint, danger }: { label: string; value: string; hint?: string; danger?: boolean }) {
  return (
    <Card className="px-3 py-3">
      <p className="text-[11px] font-semibold tracking-[0.06em] text-ink-faint uppercase">{label}</p>
      <p className={cn('tabular mt-1 text-[24px] leading-none font-semibold tracking-[-0.02em]', danger && 'text-danger')}>
        {value}
        {hint && <span className="ml-1 text-[12px] font-normal text-ink-faint">{hint}</span>}
      </p>
    </Card>
  )
}

function Row({ day, today, timezone }: { day: WakeHistoryDay; today: string; timezone: string }) {
  const planned = day.scheduled_at ? timeIn(day.scheduled_at, timezone) : '--:--'
  const got = day.confirmed_at ? timeIn(day.confirmed_at, timezone) : '--:--'
  const delay = day.delay_minutes
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="w-24 shrink-0">
        <p className="text-[14px] first-letter:uppercase">{relativeDay(day.date, today)}</p>
        <p className="text-[12px] text-ink-faint">{day.label ?? 'Sem alarme'}</p>
      </div>
      <div className="tabular min-w-0 flex-1 text-[15px]">
        <p className="whitespace-nowrap">
          <span className="text-ink-faint">{planned}</span>
          <span className="mx-1.5 text-ink-faint">→</span>
          <span className={cn('font-semibold', day.status === 'missed' && 'text-danger')}>{got}</span>
        </p>
        {day.snooze_count > 0 && <p className="text-[12px] text-ink-faint">{day.snooze_count === 1 ? '1 soneca' : `${day.snooze_count} sonecas`}</p>}
      </div>
      <div className="shrink-0 text-right">
        <p className={cn('text-[12px] font-semibold', day.status === 'missed' ? 'text-danger' : day.status === 'confirmed' ? 'text-accent' : 'text-ink-muted')}>{statusLabel[day.status]}</p>
        {delay !== null && day.confirmed_at && (
          <p className={cn('tabular text-[12px]', Math.abs(delay) <= 5 ? 'text-ink-faint' : delay > 0 ? 'text-warning' : 'text-ink-muted')}>
            {Math.abs(delay) <= 5 ? 'no horário' : delay > 0 ? `+${delay} min` : `${delay} min`}
          </p>
        )}
      </div>
    </div>
  )
}
