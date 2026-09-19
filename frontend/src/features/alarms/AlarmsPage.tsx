import { useState } from 'react'
import { Link } from 'react-router'

import { Button, Card, EmptyState, Fab, Spinner, Toggle } from '@/components/ui'
import { errorMessage } from '@/lib/api'
import { useAuth } from '@/lib/auth-store'
import { cn, describeDays, describeNextRing, shortTime } from '@/lib/format'
import type { Alarm } from '@/lib/types'

import { AlarmSheet } from './AlarmSheet'
import { PushDeviceCard } from './PushDeviceCard'
import { useAlarms, useUpdateAlarm } from './api'
import { SOUND_LABELS } from './sounds'

/** Tela 11: lista de alarmes com toggle, próximo toque, notificações e atalho para o histórico. */
export function AlarmsPage() {
  const user = useAuth((s) => s.user)!
  const alarms = useAlarms()
  const update = useUpdateAlarm()
  const [sheet, setSheet] = useState<{ open: boolean; alarm?: Alarm }>({ open: false })
  const [error, setError] = useState<string | null>(null)

  const next = alarms.data?.next ?? null

  return (
    <div className="safe-top pt-2 pb-24">
      <header className="flex h-12 items-center gap-3">
        <Link to="/rotina" aria-label="Voltar" className="-ml-2 flex size-9 items-center justify-center rounded-full text-ink-muted hover:bg-white/5 hover:text-ink">
          <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </Link>
        <h1 className="min-w-0 flex-1 truncate text-[20px] font-semibold tracking-[-0.02em]">Despertador</h1>
        <Link to="/despertador/historico" className="text-[13px] font-semibold text-accent">
          Histórico
        </Link>
      </header>

      {error && (
        <p role="alert" className="mt-3 rounded-md border border-danger/30 bg-danger-soft px-3 py-2.5 text-[14px] text-danger">
          {error}
        </p>
      )}

      {alarms.isPending ? (
        <div className="flex justify-center py-16">
          <Spinner className="size-6 text-ink-faint" />
        </div>
      ) : alarms.isError ? (
        <EmptyState className="mt-6" title="Não foi possível carregar" description={errorMessage(alarms.error)} />
      ) : (
        <>
          <Card className="mt-3">
            <p className="text-[12px] font-semibold tracking-[0.06em] text-ink-faint uppercase">Próximo alarme</p>
            {next ? (
              <p className="mt-1 text-[22px] font-semibold tracking-[-0.02em]">
                <span className="text-ink-muted">{next.label} · </span>
                <span className="first-letter:uppercase">{describeNextRing(next.at, user.timezone)}</span>
              </p>
            ) : (
              <p className="mt-1 text-[16px] text-ink-muted">Nenhum alarme ativo.</p>
            )}
          </Card>

          <PushDeviceCard className="mt-3" />

          <div className="mt-7 flex items-baseline justify-between px-0.5">
            <h2 className="text-[12px] font-semibold tracking-[0.08em] text-ink-faint uppercase">Alarmes</h2>
          </div>

          {alarms.data.alarms.length === 0 ? (
            <EmptyState
              className="mt-2"
              title="Nenhum alarme"
              description="Sem alarme, o acordar vale pelo horário das configurações, sem toque."
              action={<Button onClick={() => setSheet({ open: true })}>Criar alarme</Button>}
            />
          ) : (
            <ul className="mt-2 flex flex-col gap-2">
              {alarms.data.alarms.map((a) => (
                <li key={a.id}>
                  <Card padded={false} className={cn('flex items-center gap-3 pr-4 transition-opacity', !a.is_active && 'opacity-60')}>
                    <button type="button" onClick={() => setSheet({ open: true, alarm: a })} className="flex min-w-0 flex-1 items-center gap-4 py-3.5 pl-4 text-left">
                      <span className="tabular text-[32px] leading-none font-semibold tracking-[-0.03em]">{shortTime(a.time)}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15px]">{a.label}</span>
                        <span className="mt-0.5 block truncate text-[13px] text-ink-faint first-letter:uppercase">
                          {describeDays(a.days_of_week)} · {SOUND_LABELS[a.sound]}
                          {!a.requires_confirmation && ' · sem hold'}
                        </span>
                      </span>
                    </button>
                    <Toggle
                      label={`Alarme ${a.label} ativo`}
                      checked={a.is_active}
                      disabled={update.isPending}
                      onChange={(v) => update.mutate({ id: a.id, is_active: v }, { onError: (e) => setError(errorMessage(e)) })}
                    />
                  </Card>
                </li>
              ))}
            </ul>
          )}

          <p className="mt-6 px-0.5 text-[13px] leading-relaxed text-ink-faint">
            Com o app aberto na cabeceira, o alarme toca em tela cheia. Com o app fechado, chega como notificação — mantenha o alarme nativo do celular como reserva.
          </p>
        </>
      )}

      <Fab label="Novo alarme" onClick={() => setSheet({ open: true })} />
      <AlarmSheet open={sheet.open} alarm={sheet.alarm} onClose={() => setSheet({ open: false })} />
    </div>
  )
}
