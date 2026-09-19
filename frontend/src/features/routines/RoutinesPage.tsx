import { useState } from 'react'
import { Link } from 'react-router'

import { TopBar } from '@/app/shell/TopBar'
import { Button, Card, EmptyState, Spinner } from '@/components/ui'
import { errorMessage } from '@/lib/api'
import { cn, describeDays, pluralize, shortTime } from '@/lib/format'
import type { Routine, RoutineKind } from '@/lib/types'

import { RoutineSheet } from './RoutineSheet'
import { useRoutines } from './api'

const kindLabel: Record<RoutineKind, string> = { morning: 'Manhã', evening: 'Noite', custom: 'Bloco' }

/** Tela 9: cards Manhã, Noite e blocos personalizados; atalho para o despertador. */
export function RoutinesPage() {
  const routines = useRoutines()
  const [creating, setCreating] = useState<RoutineKind | null>(null)

  const morning = routines.data?.find((r) => r.kind === 'morning')
  const evening = routines.data?.find((r) => r.kind === 'evening')
  const custom = routines.data?.filter((r) => r.kind === 'custom') ?? []

  return (
    <>
      <TopBar title="Rotina" />

      {routines.isPending ? (
        <div className="flex justify-center py-16">
          <Spinner className="size-6 text-ink-faint" />
        </div>
      ) : routines.isError ? (
        <EmptyState className="mt-6" title="Não foi possível carregar" description={errorMessage(routines.error)} />
      ) : (
        <div className="mt-2 flex flex-col gap-3">
          {morning ? (
            <RoutineCard routine={morning} />
          ) : (
            <MissingCard kind="morning" onCreate={() => setCreating('morning')} />
          )}
          {evening ? (
            <RoutineCard routine={evening} />
          ) : (
            <MissingCard kind="evening" onCreate={() => setCreating('evening')} />
          )}

          <div className="mt-4 flex items-baseline justify-between px-0.5">
            <h2 className="text-[12px] font-semibold tracking-[0.08em] text-ink-faint uppercase">Blocos personalizados</h2>
            <button type="button" onClick={() => setCreating('custom')} className="text-[13px] font-semibold text-accent">
              + Novo bloco
            </button>
          </div>
          {custom.length === 0 ? (
            <EmptyState
              compact
              title="Nenhum bloco ainda"
              description="Blocos são horários fixos do seu dia: foco, estudo, leitura."
              action={
                <Button size="sm" variant="secondary" onClick={() => setCreating('custom')}>
                  Criar bloco
                </Button>
              }
            />
          ) : (
            custom.map((r) => <RoutineCard key={r.id} routine={r} />)
          )}

          <div className="mt-4 px-0.5">
            <h2 className="text-[12px] font-semibold tracking-[0.08em] text-ink-faint uppercase">Despertador</h2>
          </div>
          <Card className="flex items-center justify-between">
            <div>
              <p className="text-[15px]">Alarmes com confirmação</p>
              <p className="mt-0.5 text-[13px] text-ink-faint">Chega na Fase 6. Hoje você confirma que levantou pela tela Hoje.</p>
            </div>
            <span className="shrink-0 rounded-full border border-line px-2 py-0.5 text-[11px] text-ink-faint">em breve</span>
          </Card>
        </div>
      )}

      <RoutineSheet open={creating !== null} kind={creating ?? 'custom'} onClose={() => setCreating(null)} />
    </>
  )
}

function RoutineCard({ routine }: { routine: Routine }) {
  const activeItems = routine.items.filter((i) => i.is_active)
  const minutes = activeItems.reduce((n, i) => n + (i.duration_minutes ?? 0), 0)
  return (
    <Link to={`/rotina/${routine.id}`} className="block">
      <Card className={cn('transition-colors hover:bg-elevated', !routine.is_active && 'opacity-60')}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[12px] font-semibold tracking-[0.06em] text-ink-faint uppercase">{kindLabel[routine.kind]}</p>
            <h3 className="mt-0.5 truncate text-[18px] font-semibold tracking-[-0.01em]">{routine.name}</h3>
          </div>
          {routine.start_time && (
            <span className="tabular shrink-0 text-[18px] font-semibold text-ink-muted">{shortTime(routine.start_time)}</span>
          )}
        </div>
        <p className="mt-3 text-[13px] text-ink-muted">
          {activeItems.length === 0 ? 'Sem itens ainda' : pluralize(activeItems.length, 'item', 'itens')}
          {minutes > 0 && ` · ${minutes} min`}
          {' · '}
          {describeDays(routine.days_of_week)}
          {!routine.is_active && ' · pausada'}
        </p>
        {activeItems.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-1.5">
            {activeItems.slice(0, 4).map((i) => (
              <li key={i.id} className="rounded-full border border-line bg-elevated px-2.5 py-1 text-[12px] text-ink-muted">
                {i.title}
              </li>
            ))}
            {activeItems.length > 4 && (
              <li className="px-1 py-1 text-[12px] text-ink-faint">+{activeItems.length - 4}</li>
            )}
          </ul>
        )}
      </Card>
    </Link>
  )
}

function MissingCard({ kind, onCreate }: { kind: 'morning' | 'evening'; onCreate: () => void }) {
  return (
    <EmptyState
      compact
      title={kind === 'morning' ? 'Rotina da manhã' : 'Rotina da noite'}
      description={kind === 'morning' ? 'O que você faz assim que levanta.' : 'Como você encerra o dia.'}
      action={
        <Button size="sm" onClick={onCreate}>
          Criar
        </Button>
      }
    />
  )
}
