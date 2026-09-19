import { useState } from 'react'
import { Link } from 'react-router'

import { Button, Card, HoldButton, Section, Spinner } from '@/components/ui'
import { useConfirmWake, useUndoWake, useWakeDay } from '@/features/wake/api'
import { errorMessage } from '@/lib/api'
import { shortTime, timeIn } from '@/lib/format'

interface Props {
  date: string
  timezone: string
  /** dia aberto e não fechado: aceita segurar/desfazer */
  editable: boolean
}

/**
 * Bloco "Acordar" da tela Hoje.
 * - alarme tocando → atalho para a tela de alarme
 * - alarme perdido → segurar para confirmar (vira manual)
 * - sem registro → segurar para confirmar (a partir das 03:00)
 * - confirmado → horário real + atraso
 */
export function WakeBlock({ date, timezone, editable }: Props) {
  const wake = useWakeDay(date)
  const confirm = useConfirmWake(date)
  const undo = useUndoWake(date)
  const [error, setError] = useState<string | null>(null)

  const d = wake.data
  const aside = d?.scheduled_time ? `${d.alarm ? d.alarm.label : 'Horário'}: ${shortTime(d.scheduled_time)}` : undefined

  return (
    <Section title="Acordar" aside={aside}>
      {wake.isPending ? (
        <Card className="flex h-16 items-center justify-center">
          <Spinner className="size-5 text-ink-faint" />
        </Card>
      ) : wake.isError || !d ? (
        <Card className="text-[14px] text-ink-muted">{wake.isError ? errorMessage(wake.error) : 'Sem dados.'}</Card>
      ) : d.confirmed_at ? (
        <Card className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[15px]">
              Levantou às <span className="tabular font-semibold">{timeIn(d.confirmed_at, timezone)}</span>
            </p>
            <p className="mt-0.5 text-[13px] text-ink-muted">
              <Delay minutes={d.delay_minutes} />
              {d.snooze_count > 0 && ` · ${d.snooze_count === 1 ? '1 soneca' : `${d.snooze_count} sonecas`}`}
              {d.status === 'manual' && d.rang_at && ' · confirmado depois do alarme'}
              .
            </p>
          </div>
          {d.can_undo && editable && (
            <Button size="sm" variant="ghost" loading={undo.isPending} onClick={() => undo.mutate(undefined, { onError: (e) => setError(errorMessage(e)) })}>
              Desfazer
            </Button>
          )}
        </Card>
      ) : d.status === 'pending' ? (
        <Card className="flex items-center justify-between gap-3 border-accent/40 bg-accent-soft">
          <div>
            <p className="text-[15px] font-semibold text-accent">{d.ringing ? 'Alarme tocando' : 'Soneca em andamento'}</p>
            <p className="mt-0.5 text-[13px] text-ink-muted">
              {d.ringing ? 'Segure 3 segundos na tela do alarme para confirmar.' : d.next_ring_at ? `Toca de novo às ${timeIn(d.next_ring_at, timezone)}.` : ''}
            </p>
          </div>
          <Link to="/alarme" className="shrink-0">
            <Button size="sm">Abrir</Button>
          </Link>
        </Card>
      ) : editable && d.can_confirm ? (
        <>
          {d.status === 'missed' && (
            <p className="mb-2 text-[13px] text-warning">Você não confirmou que acordou em 60 min. Confirme agora com o horário real.</p>
          )}
          <HoldButton onComplete={() => confirm.mutate(undefined, { onError: (e) => setError(errorMessage(e)) })} disabled={confirm.isPending}>
            Segure para confirmar que levantou
          </HoldButton>
          {error && <p className="text-[13px] text-danger">{error}</p>}
        </>
      ) : editable ? (
        <Card className="text-[14px] text-ink-muted">
          {d.scheduled_time ? (
            <>
              Ainda é madrugada. O "Levantei" de hoje libera às 03:00
              {d.alarm && (
                <>
                  {' '}
                  — ou quando o alarme <span className="tabular font-semibold text-ink">{shortTime(d.scheduled_time)}</span> tocar
                </>
              )}
              .
            </>
          ) : (
            'Sem horário de acordar configurado.'
          )}
        </Card>
      ) : (
        <Card className="text-[14px] text-ink-muted">{d.status === 'missed' ? 'Alarme perdido: não confirmou que acordou.' : 'Sem registro de acordar neste dia.'}</Card>
      )}
      {error && d?.confirmed_at && <p className="text-[13px] text-danger">{error}</p>}
    </Section>
  )
}

function Delay({ minutes }: { minutes: number | null }) {
  if (minutes === null) return <>Sem horário de acordar configurado</>
  if (Math.abs(minutes) <= 5) return <>No horário</>
  if (minutes > 0) return <>{minutes} min depois do horário</>
  return <>{Math.abs(minutes)} min antes do horário</>
}
