import { useState } from 'react'
import { Link } from 'react-router'

import { TopBar } from '@/app/shell/TopBar'
import { Button, Card, EmptyState, Fab, Spinner } from '@/components/ui'
import { errorMessage } from '@/lib/api'
import { useAuth } from '@/lib/auth-store'
import { cn, daysUntil, describeDeadline, todayIn } from '@/lib/format'
import type { Goal, GoalStatus } from '@/lib/types'

import { GoalSheet } from './GoalSheet'
import { useGoals } from './api'
import { Chip, ProgressBar, areaLabel } from './shared'

const filters: { key: GoalStatus; label: string }[] = [
  { key: 'active', label: 'Ativas' },
  { key: 'completed', label: 'Concluídas' },
  { key: 'archived', label: 'Arquivadas' },
]

/** Tela 15: lista de metas com progresso, prazo e área. */
export function GoalsPage() {
  const user = useAuth((s) => s.user)!
  const today = todayIn(user.timezone)
  const [status, setStatus] = useState<GoalStatus>('active')
  const [creating, setCreating] = useState(false)
  const goals = useGoals(status)

  return (
    <>
      <TopBar title="Metas" />

      <div className="no-scrollbar -mx-5 mt-1 flex gap-2 overflow-x-auto px-5 pb-1">
        {filters.map((f) => (
          <Chip key={f.key} active={status === f.key} onClick={() => setStatus(f.key)}>
            {f.label}
          </Chip>
        ))}
      </div>

      {goals.isPending ? (
        <div className="flex justify-center py-16">
          <Spinner className="size-6 text-ink-faint" />
        </div>
      ) : goals.isError ? (
        <EmptyState className="mt-6" title="Não foi possível carregar" description={errorMessage(goals.error)} />
      ) : goals.data.length === 0 ? (
        <EmptyState
          className="mt-4"
          title={status === 'active' ? 'Nenhuma meta ativa' : status === 'completed' ? 'Nenhuma meta concluída' : 'Nada arquivado'}
          description={
            status === 'active'
              ? 'Uma meta boa cabe numa frase e se divide em ações pequenas com data.'
              : undefined
          }
          action={
            status === 'active' ? (
              <Button onClick={() => setCreating(true)}>Criar a primeira meta</Button>
            ) : undefined
          }
        />
      ) : (
        <ul className="mt-4 flex flex-col gap-3">
          {goals.data.map((g) => (
            <li key={g.id}>
              <GoalCard goal={g} today={today} />
            </li>
          ))}
        </ul>
      )}

      <Fab label="Nova meta" onClick={() => setCreating(true)} />
      <GoalSheet open={creating} onClose={() => setCreating(false)} />
    </>
  )
}

function GoalCard({ goal, today }: { goal: Goal; today: string }) {
  const next = goal.actions.find((a) => !a.is_done)
  const overdue = goal.deadline !== null && goal.status === 'active' && daysUntil(goal.deadline, today) < 0
  return (
    <Link to={`/metas/${goal.id}`} className="block">
      <Card className={cn('transition-colors hover:bg-elevated', goal.status !== 'active' && 'opacity-70')}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[12px] font-semibold tracking-[0.06em] text-ink-faint uppercase">{areaLabel[goal.area]}</p>
            <h3 className="mt-0.5 truncate text-[18px] font-semibold tracking-[-0.01em]">{goal.title}</h3>
          </div>
          <span className="tabular shrink-0 text-[18px] font-semibold text-ink-muted">{goal.progress_pct}%</span>
        </div>
        <ProgressBar pct={goal.progress_pct} className="mt-3" />
        <p className="mt-2.5 flex items-center justify-between text-[13px] text-ink-muted">
          <span>
            {goal.actions_done}/{goal.actions_total} {goal.actions_total === 1 ? 'ação' : 'ações'}
          </span>
          <span className={cn(overdue && 'text-warning')}>{goal.status === 'active' ? describeDeadline(goal.deadline, today) : goal.status === 'completed' ? 'concluída' : 'arquivada'}</span>
        </p>
        {next && goal.status === 'active' && (
          <p className="mt-2 truncate text-[13px] text-ink-faint">
            Próxima: <span className="text-ink-muted">{next.title}</span>
          </p>
        )}
      </Card>
    </Link>
  )
}
