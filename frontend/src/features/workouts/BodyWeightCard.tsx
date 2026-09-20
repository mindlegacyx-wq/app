import { useState } from 'react'

import { Button, Card, LineChart, Sheet, type ChartPoint } from '@/components/ui'
import { errorMessage } from '@/lib/api'
import { cn } from '@/lib/format'

import { useBodyWeight, useSetBodyWeight } from './api'
import { fmtKg } from './load'

/** Peso corporal: número grande, variação de 30 dias e a linha do tempo. */
export function BodyWeightCard({ className }: { className?: string }) {
  const { data } = useBodyWeight()
  const [open, setOpen] = useState(false)

  const points: ChartPoint[] = (data?.entries ?? []).map((e) => ({ x: e.date, y: e.weight }))
  const change = data?.change_30d ?? null

  return (
    <>
      <Card className={cn('p-4', className)}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[12px] tracking-[0.14em] text-ink-faint uppercase">Peso corporal</p>
            <p className="mt-1 text-[28px] leading-none font-semibold tabular-nums">{data?.latest != null ? fmtKg(data.latest) : '—'}</p>
            {change !== null && change !== 0 && (
              <p className={cn('mt-1 text-[13px] font-medium', change < 0 ? 'text-accent' : 'text-ink-muted')}>
                {change > 0 ? '+' : ''}
                {change.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} kg em 30 dias
              </p>
            )}
          </div>
          <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>
            Registrar
          </Button>
        </div>

        {points.length > 1 && (
          <LineChart
            className="mt-3"
            points={points}
            label="Peso corporal"
            format={(v) => fmtKg(v)}
            formatX={(x) => new Date(`${x}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
          />
        )}
        {points.length <= 1 && (
          <p className="mt-3 text-[13px] leading-relaxed text-ink-faint">
            Anote o peso de vez em quando. Com dois registros a linha já aparece — e ela conta uma história bem mais honesta que a balança
            de um dia só.
          </p>
        )}
      </Card>

      <WeightSheet open={open} onClose={() => setOpen(false)} current={data?.latest ?? null} />
    </>
  )
}

function WeightSheet({ open, onClose, current }: { open: boolean; onClose: () => void; current: number | null }) {
  const save = useSetBodyWeight()
  const [value, setValue] = useState(current ? String(current).replace('.', ',') : '')
  const [error, setError] = useState<string | null>(null)

  return (
    <Sheet open={open} onClose={onClose} title="Peso de hoje">
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault()
          const weight = Number(value.replace(',', '.'))
          if (!Number.isFinite(weight) || weight <= 20) {
            setError('Digite o peso em kg (ex.: 82,5).')
            return
          }
          save.mutate({ weight }, { onSuccess: onClose, onError: (err) => setError(errorMessage(err)) })
        }}
      >
        <label className="flex items-baseline gap-2 rounded-md border border-line bg-surface px-4 py-3 focus-within:border-accent">
          <input
            type="text"
            inputMode="decimal"
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value.replace(/[^\d.,]/g, ''))}
            placeholder="82,5"
            aria-label="Peso em quilos"
            className="w-full bg-transparent text-[28px] font-semibold tabular-nums outline-none"
          />
          <span className="text-[15px] text-ink-faint">kg</span>
        </label>
        {error && <p className="text-[14px] text-danger">{error}</p>}
        <Button type="submit" size="lg" full loading={save.isPending}>
          Salvar
        </Button>
        <p className="text-center text-[12px] text-ink-faint">Vale o peso do dia. Registrar de novo hoje substitui o anterior.</p>
      </form>
    </Sheet>
  )
}
