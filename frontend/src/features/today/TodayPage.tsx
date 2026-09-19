import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'

import { TopBar } from '@/app/shell/TopBar'
import { Button, Card, Fab, Ring, Section } from '@/components/ui'
import { useRoutines, useRoutinesDay } from '@/features/routines/api'
import { useTasksDay } from '@/features/tasks/api'
import { TasksBlock } from '@/features/tasks/TasksBlock'
import { useWakeDay } from '@/features/wake/api'
import { useAuth } from '@/lib/auth-store'
import { firstName, greeting, longDate, todayIn } from '@/lib/format'
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
 * espaços reservados: Fechar o dia (Fase 3), Metas (4), Treino (5).
 */
export function TodayPage() {
  const user = useAuth((s) => s.user)!
  const tz = user.timezone

  // Recalcula o "hoje" a cada minuto: quem deixa o app aberto vira o dia sem recarregar.
  const [date, setDate] = useState(() => todayIn(tz))
  useEffect(() => {
    const id = window.setInterval(() => setDate(todayIn(tz)), 60_000)
    return () => window.clearInterval(id)
  }, [tz])

  const day = useRoutinesDay(date)
  const wake = useWakeDay(date)
  const routines = useRoutines()
  const tasks = useTasksDay(date)

  const [taskSheet, setTaskSheet] = useState<{ open: boolean; task?: Task }>({ open: false })
  const [catsOpen, setCatsOpen] = useState(false)

  const morning = day.data?.routines.find((r) => r.kind === 'morning')
  const evening = day.data?.routines.find((r) => r.kind === 'evening')
  const custom = day.data?.routines.filter((r) => r.kind === 'custom') ?? []
  const hasMorningRoutine = routines.data?.some((r) => r.kind === 'morning') ?? true
  const hasEveningRoutine = routines.data?.some((r) => r.kind === 'evening') ?? true

  // Progresso do dia com o que já existe (rotinas + acordar + tarefas). O percentual
  // oficial, com treino e metas e a sequência, vem do servidor na Fase 3.
  const progress = useMemo(() => {
    const wakePlanned = wake.data?.scheduled_time ? 1 : 0
    const wakeDone = wake.data?.confirmed_at ? 1 : 0
    const planned = (day.data?.planned ?? 0) + wakePlanned + (tasks.data?.planned ?? 0)
    const completed = (day.data?.completed ?? 0) + wakeDone + (tasks.data?.completed ?? 0)
    return { planned, completed, pct: planned ? Math.round((completed / planned) * 100) : 0 }
  }, [day.data, wake.data, tasks.data])

  return (
    <>
      <TopBar hero subtitle={longDate()} title={`${greeting()}, ${firstName(user.name)}`} />

      <Card className="mt-2 flex items-center gap-5 p-5">
        <Ring value={progress.pct} size={124} stroke={10} muted={progress.planned === 0}>
          <span className="tabular text-[34px] leading-none font-semibold tracking-[-0.03em]">{progress.pct}%</span>
          <span className="mt-1 text-[11px] text-ink-faint">
            {progress.completed} de {progress.planned}
          </span>
        </Ring>
        <dl className="flex flex-1 flex-col gap-3">
          <Stat label="Sequência" value="0" unit="dias" />
          <Stat label="Meta do dia" value={`${user.settings.discipline_target}%`} />
        </dl>
      </Card>

      <div className="mt-7 flex flex-col gap-7">
        <WakeBlock date={date} timezone={tz} isToday />

        {morning ? (
          <RoutineBlock date={date} routine={morning} title="Rotina da manhã" editable />
        ) : (
          <RoutinePlaceholder
            title="Rotina da manhã"
            text={hasMorningRoutine ? 'Adicione os primeiros itens da sua manhã.' : 'Crie a sua rotina da manhã.'}
            to="/rotina"
          />
        )}

        {custom.map((r) => (
          <RoutineBlock key={r.id} date={date} routine={r} editable />
        ))}

        <TasksBlock
          date={date}
          today={date}
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
          <RoutineBlock date={date} routine={evening} title="Rotina da noite" editable />
        ) : (
          <RoutinePlaceholder
            title="Rotina da noite"
            text={hasEveningRoutine ? 'Adicione os itens que encerram o seu dia.' : 'Crie a sua rotina da noite.'}
            to="/rotina"
          />
        )}
      </div>

      <div className="mt-8">
        <Button size="lg" full variant="secondary" disabled>
          Fechar o dia
        </Button>
        <p className="mt-2 text-center text-[13px] text-ink-faint">O fechamento do dia e a sequência chegam na Fase 3.</p>
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

function Stat({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div>
      <dt className="text-[12px] text-ink-faint">{label}</dt>
      <dd className="tabular text-[22px] leading-tight font-semibold tracking-[-0.02em]">
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

