import { useState } from 'react'

import { Button, Card, HoldButton, Section, Spinner } from '@/components/ui'
import { useConfirmWake, useUndoWake, useWakeDay } from '@/features/wake/api'
import { errorMessage } from '@/lib/api'
import { shortTime, timeIn } from '@/lib/format'

interface Props {
  date: string
  timezone: string
  /** só o dia de hoje aceita o botão de segurar */
  isToday: boolean
}

/** Bloco "Acordar" da tela Hoje: segurar 3 s para registrar o horário real em que levantou. */
export function WakeBlock({ date, timezone, isToday }: Props) {
  const wake = useWakeDay(date)
  const confirm = useConfirmWake(date)
  const undo = useUndoWake(date)
  const [error, setError] = useState<string | null>(null)

  const aside = wake.data?.scheduled_time ? `Horário: ${shortTime(wake.data.scheduled_time)}` : undefined

  return (
    <Section title="Acordar" aside={aside}>
      {wake.isPending ? (
        <Card className="flex h-16 items-center justify-center">
          <Spinner className="size-5 text-ink-faint" />
        </Card>
      ) : wake.isError ? (
        <Card className="text-[14px] text-ink-muted">{errorMessage(wake.error)}</Card>
      ) : wake.data.confirmed_at ? (
        <Card className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[15px]">
              Levantou às <span className="tabular font-semibold">{timeIn(wake.data.confirmed_at, timezone)}</span>
            </p>
            <p className="mt-0.5 text-[13px] text-ink-muted">
              <Delay minutes={wake.data.delay_minutes} />
            </p>
          </div>
          {wake.data.can_undo && (
            <Button
              size="sm"
              variant="ghost"
              loading={undo.isPending}
              onClick={() => undo.mutate(undefined, { onError: (e) => setError(errorMessage(e)) })}
            >
              Desfazer
            </Button>
          )}
        </Card>
      ) : isToday ? (
        <>
          <HoldButton
            onComplete={() => confirm.mutate(undefined, { onError: (e) => setError(errorMessage(e)) })}
            disabled={confirm.isPending}
          >
            Segure para confirmar que levantou
          </HoldButton>
          {error && <p className="text-[13px] text-danger">{error}</p>}
        </>
      ) : (
        <Card className="text-[14px] text-ink-muted">Sem registro de acordar neste dia.</Card>
      )}
      {error && wake.data?.confirmed_at && <p className="text-[13px] text-danger">{error}</p>}
    </Section>
  )
}

function Delay({ minutes }: { minutes: number | null }) {
  if (minutes === null) return <>Sem horário de acordar configurado.</>
  if (Math.abs(minutes) <= 5) return <>No horário.</>
  if (minutes > 0) return <>{minutes} min depois do horário.</>
  return <>{Math.abs(minutes)} min antes do horário.</>
}
