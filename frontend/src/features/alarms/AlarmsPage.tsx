import { AnimatePresence, m } from 'motion/react'
import { useState } from 'react'
import { Link } from 'react-router'

import { Button, Card, EmptyState, Fab, Spinner, Toggle } from '@/components/ui'
import { errorMessage } from '@/lib/api'
import { useAuth } from '@/lib/auth-store'
import { cn, describeDays, describeNextRing, shortTime } from '@/lib/format'
import type { Alarm, AlarmSoundFile } from '@/lib/types'

import { AlarmSheet } from './AlarmSheet'
import { PushDeviceCard } from './PushDeviceCard'
import { useAlarmSounds, useAlarms, useUpdateAlarm } from './api'
import { SOUND_LABELS } from './sounds'

/** Tela 11: lista de alarmes com toggle, próximo toque, notificações e atalho para o histórico. */
export function AlarmsPage() {
  const user = useAuth((s) => s.user)!
  const alarms = useAlarms()
  const update = useUpdateAlarm()
  const sounds = useAlarmSounds()
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

          <Link to="/despertador/cabeceira" className="mt-3 block">
            <Card className="flex items-center gap-3 transition-colors hover:bg-elevated">
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-accent-soft text-accent" aria-hidden>
                <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="13" r="7" />
                  <path d="M12 10v3l2 1.5M9 2.5h6M5.5 5 4 6.5M18.5 5 20 6.5" />
                </svg>
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-semibold">Modo cabeceira</span>
                <span className="block text-[12px] text-ink-faint">
                  Tela aberta a noite toda: o alarme toca com o seu áudio, sem depender de notificação.
                </span>
              </span>
              <svg className="size-4 shrink-0 text-ink-faint" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M9 5l7 7-7 7" /></svg>
            </Card>
          </Link>

          <PushDeviceCard className="mt-3" />

          <LoudGuide className="mt-3" />

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
                          {describeDays(a.days_of_week)} · {soundName(a, sounds.data)}
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


/** Nome do som na lista: o áudio do usuário vence o som pronto. */
function soundName(alarm: Alarm, files?: AlarmSoundFile[]): string {
  if (alarm.sound_file_id) {
    return files?.find((f) => f.id === alarm.sound_file_id)?.name ?? 'Meu áudio'
  }
  return SOUND_LABELS[alarm.sound]
}

/** O que o navegador não faz sozinho: deixar a notificação alta com o app fechado. */
function LoudGuide({ className }: { className?: string }) {
  const [open, setOpen] = useState(false)
  return (
    <Card className={cn('overflow-hidden', className)} padded={false}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left"
      >
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-white/6 text-ink-muted" aria-hidden>
          <svg className="size-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 9.5h3.5L12 5.5v13L7.5 14.5H4zM16 9.5a4 4 0 0 1 0 5M18.8 7a7.5 7.5 0 0 1 0 10" />
          </svg>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px]">Fazer tocar alto com o app fechado</span>
          <span className="block text-[12px] text-ink-faint">Ajuste do celular — leva um minuto</span>
        </span>
        <svg
          className={cn('size-4 shrink-0 text-ink-faint transition-transform', open && 'rotate-90')}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M9 5l7 7-7 7" />
        </svg>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <m.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            <div className="flex flex-col gap-3 border-t border-line px-4 py-3.5 text-[13px] leading-relaxed text-ink-muted">
              <p className="text-ink-faint">
                Notificação de site não aceita som personalizado — isso não existe em navegador nenhum. Com o app
                fechado quem toca é o som de notificação do celular, e é ele que dá para deixar alto:
              </p>
              <div>
                <p className="font-semibold text-ink">Android</p>
                <p className="text-ink-faint">
                  Ajustes → Apps → Disciplina (ou Chrome, se não instalou) → Notificações → escolha a categoria do
                  site → <b>Som</b>: ponha um toque forte, <b>Importância</b>: alta, e ligue <b>Ignorar Não perturbe</b>.
                </p>
              </div>
              <div>
                <p className="font-semibold text-ink">iPhone</p>
                <p className="text-ink-faint">
                  O app precisa estar instalado pela Tela de Início. Ajustes → Notificações → Disciplina → ligue
                  <b> Sons</b> e <b>Alertas críticos</b> se aparecer. No Foco/Não perturbe, adicione o app às
                  permissões.
                </p>
              </div>
              <p className="text-ink-faint">
                Quer garantia de verdade? <b>Modo cabeceira</b>: a tela fica aberta e o alarme toca o seu áudio sem
                passar por notificação nenhuma.
              </p>
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </Card>
  )
}
