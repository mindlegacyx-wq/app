import { lazy, Suspense, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'

import { TopBar } from '@/app/shell/TopBar'
import { Button, Card, Fab, Ring, Section } from '@/components/ui'
import { useDayScore, useReopenDay } from '@/features/progress/api'
import { useRoutines, useRoutinesDay } from '@/features/routines/api'
import { TasksBlock } from '@/features/tasks/TasksBlock'
import { useAuth } from '@/lib/auth-store'
import { cn, firstName, greeting, longDate, timeIn, todayIn } from '@/lib/format'
import type { Task } from '@/lib/types'

import { RoutineBlock, RoutinePlaceholder } from './RoutineBlock'
import { WakeBlock } from './WakeBlock'

// Os sheets só carregam quando abertos pela primeira vez.
const TaskSheet = lazy(() => import('@/features/tasks/TaskSheet').then((m) => ({ default: m.TaskSheet })))
const CategoriesSheet = lazy(() =>
  import('@/features/tasks/CategoriesSheet').then((m) => ({ default: m.CategoriesSheet })),
)

/**
 * Tela Hoje. Blocos na ordem do dia. Os blocos ainda não construídos aparecem como
 * espaços reservados: Metas (Fase 4), Treino (5).
 */
export function TodayPage() {
  const user = useAuth((s) => s.user)!
  const tz = user.timezone
  const navigate = useNavigate()

  // Recalcula o "hoje" a cada minuto: quem deixa o app aberto vira o dia sem recarregar.
  const [date, setDate] = useState(() => todayIn(tz))
  useEffect(() => {
    const id = window.setInterval(() => setDate(todayIn(tz)), 60_000)
    return () => window.clearInterval(id)
  }, [tz])

  const day = useRoutinesDay(date)
  const routines = useRoutines()
  const score = useDayScore(date)
  const reopen = useReopenDay(date)

  const [taskSheet, setTaskSheet] = useState<{ open: boolean; task?: Task }>({ open: false })
  const [catsOpen, setCatsOpen] = useState(false)

  const morning = day.data?.routines.find((r) => r.kind === 'morning')
  const evening = day.data?.routines.find((r) => r.kind === 'evening')
  const custom = day.data?.routines.filter((r) => r.kind === 'custom') ?? []
  const hasMorningRoutine = routines.data?.some((r) => r.kind === 'morning') ?? true
  const hasEveningRoutine = routines.data?.some((r) => r.kind === 'evening') ?? true

  // O percentual e a sequência vêm do servidor (módulo progress); qualquer mutação invalida.
  const s = score.data
  const closed = Boolean(s && !s.is_open && s.closed_at)
  const editable = !closed

  return (
    <>
      <TopBar hero subtitle={longDate()} title={`${greeting()}, ${firstName(user.name)}`} />

      <Card className={cn('mt-2 p-5', closed && 'border-accent/30')}>
        <div className="flex items-center gap-5">
          <Ring value={s?.pct ?? 0} size={124} stroke={10} muted={!s || s.planned === 0}>
            <span className="tabular text-[34px] leading-none font-semibold tracking-[-0.03em]">{s?.pct ?? 0}%</span>
            <span className="mt-1 text-[11px] text-ink-faint">
              {s?.completed ?? 0} de {s?.planned ?? 0}
            </span>
          </Ring>
          <dl className="flex flex-1 flex-col gap-3">
            <Stat
              label="Sequência"
              value={String(s?.streak ?? 0)}
              unit={s?.streak === 1 ? 'dia' : 'dias'}
              highlight={Boolean(s?.hit_target)}
            />
            <Stat label="Meta do dia" value={`${s?.target ?? user.settings.discipline_target}%`} />
          </dl>
        </div>
        {closed && s && (
          <div className="mt-4 flex items-center justify-between border-t border-line pt-3">
            <p className="text-[13px] text-ink-muted">
              <span className="font-semibold text-accent">Dia fechado</span> às {timeIn(s.closed_at!, tz)}
              {s.hit_target ? ' · meta batida' : ' · meta não atingida'}
            </p>
            {s.can_reopen && (
              <Button size="sm" variant="ghost" loading={reopen.isPending} onClick={() => reopen.mutate()}>
                Reabrir
              </Button>
            )}
          </div>
        )}
      </Card>

      <div className="mt-7 flex flex-col gap-7">
        <WakeBlock date={date} timezone={tz} editable={editable} />

        {morning ? (
          <RoutineBlock date={date} routine={morning} title="Rotina da manhã" editable={editable} />
        ) : (
          <RoutinePlaceholder
            title="Rotina da manhã"
            text={hasMorningRoutine ? 'Adicione os primeiros itens da sua manhã.' : 'Crie a sua rotina da manhã.'}
            to="/rotina"
          />
        )}

        {custom.map((r) => (
          <RoutineBlock key={r.id} date={date} routine={r} editable={editable} />
        ))}

        <TasksBlock
          date={date}
          today={date}
          editable={editable}
          onAdd={() => setTaskSheet({ open: true })}
          onEdit={(task) => setTaskSheet({ open: true, task })}
        />

        <Section title="Treino de hoje">
          <Placeholder text="O treino do dia aparece aqui quando houver um plano." />
        </Section>

        <Section title="Ações das metas">
          <Placeholder text="Ações com data de hoje aparecem aqui." />
        </Section>

        {evening ? (
          <RoutineBlock date={date} routine={evening} title="Rotina da noite" editable={editable} />
        ) : (
          <RoutinePlaceholder
            title="Rotina da noite"
            text={hasEveningRoutine ? 'Adicione os itens que encerram o seu dia.' : 'Crie a sua rotina da noite.'}
            to="/rotina"
          />
        )}
      </div>

      <div className="mt-8">
        {closed ? (
          <Button size="lg" full variant="secondary" onClick={() => navigate('/hoje/fechar')}>
            Ver resumo do dia
          </Button>
        ) : (
          <>
            <Button
              size="lg"
              full
              variant={s?.hit_target ? 'primary' : 'secondary'}
              disabled={!s?.can_close}
              onClick={() => navigate('/hoje/fechar')}
            >
              Fechar o dia
            </Button>
            <p className="mt-2 text-center text-[13px] text-ink-faint">
              {s?.can_close ? 'Revise o dia e congele o percentual.' : 'Disponível quando houver algo planejado.'}
            </p>
          </>
        )}
      </div>

      <Fab label="Nova tarefa" onClick={() => setTaskSheet({ open: true })} />

      <Suspense fallback={null}>
        {(taskSheet.open || catsOpen) && (
          <>
            <TaskSheet
              open={taskSheet.open}
              today={date}
              task={taskSheet.task}
              onClose={() => setTaskSheet({ open: false })}
              onManageCategories={() => setCatsOpen(true)}
            />
            <CategoriesSheet open={catsOpen} onClose={() => setCatsOpen(false)} />
          </>
        )}
      </Suspense>
    </>
  )
}

function Stat({ label, value, unit, highlight }: { label: string; value: string; unit?: string; highlight?: boolean }) {
  return (
    <div>
      <dt className="text-[12px] text-ink-faint">{label}</dt>
      <dd className={cn('tabular text-[22px] leading-tight font-semibold tracking-[-0.02em]', highlight && 'text-accent')}>
        {value}
        {unit && <span className="ml-1 text-[13px] font-medium text-ink-muted">{unit}</span>}
      </dd>
    </div>
  )
}

function Placeholder({ text, to, cta }: { text: string; to?: string; cta?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-dashed border-line-strong px-4 py-3.5">
      <p className="text-[14px] text-ink-muted">{text}</p>
      {to ? (
        <Link to={to} className="shrink-0 text-[13px] font-semibold text-accent">
          {cta ?? 'Abrir'}
        </Link>
      ) : (
        <span className="shrink-0 rounded-full border border-line px-2 py-0.5 text-[11px] text-ink-faint">em breve</span>
      )}
    </div>
  )
}

