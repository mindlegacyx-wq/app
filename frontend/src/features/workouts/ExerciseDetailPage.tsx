import { useNavigate, useParams } from 'react-router'

import { Card, EmptyState, LineChart, Spinner, type ChartPoint } from '@/components/ui'
import { errorMessage } from '@/lib/api'

import { useExerciseHistory } from './api'
import { describeLastSets, fmtKg } from './load'

/** Tela 44: a evolução de um exercício — carga por sessão e o registro de cada dia. */
export function ExerciseDetailPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { data, isPending, isError, error } = useExerciseHistory(id)

  const points: ChartPoint[] = (data?.points ?? [])
    .filter((p) => p.best_weight !== null)
    .map((p) => ({ x: p.date, y: p.best_weight as number }))

  return (
    <>
      <div className="safe-top flex items-center gap-3 pt-2">
        <button type="button" onClick={() => navigate(-1)} aria-label="Voltar" className="-ml-1 p-1 text-ink-muted active:text-ink">
          <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
            <path d="M15 5l-7 7 7 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <h1 className="truncate text-[20px] font-semibold tracking-[-0.02em]">{data?.name ?? 'Exercício'}</h1>
      </div>

      {isPending ? (
        <div className="flex justify-center py-16">
          <Spinner className="size-6 text-ink-faint" />
        </div>
      ) : isError ? (
        <EmptyState className="mt-6" title="Não foi possível carregar" description={errorMessage(error)} />
      ) : data.points.length === 0 ? (
        <EmptyState
          className="mt-10"
          title="Sem registros ainda"
          description="Quando você marcar séries deste exercício, a evolução da carga aparece aqui."
        />
      ) : (
        <div className="mt-3 flex flex-col gap-3">
          <Card className="p-4">
            <p className="text-[12px] tracking-[0.14em] text-ink-faint uppercase">Maior carga por treino</p>
            <LineChart
              className="mt-2"
              points={points}
              label="Maior carga"
              format={(v) => fmtKg(v)}
              formatX={(x) => new Date(`${x}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
            />
          </Card>

          <Card className="p-0">
            <ul className="divide-y divide-line">
              {[...data.points].reverse().map((p) => (
                <li key={p.date} className="flex items-baseline justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-[14px] font-medium">
                      {new Date(`${p.date}T12:00:00`).toLocaleDateString('pt-BR', {
                        day: '2-digit',
                        month: 'long',
                      })}
                    </p>
                    <p className="truncate text-[12px] text-ink-faint">{describeLastSets(p.sets)}</p>
                  </div>
                  <span className="shrink-0 text-[13px] font-semibold tabular-nums">
                    {p.total_volume > 0 ? fmtKg(p.total_volume) : '—'}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
          <p className="px-1 text-[12px] leading-relaxed text-ink-faint">
            O número da direita é o volume do dia (peso × repetições somados). Ele sobe quando você levanta mais peso ou faz mais repetições
            — é a medida honesta de progresso.
          </p>
        </div>
      )}
    </>
  )
}
