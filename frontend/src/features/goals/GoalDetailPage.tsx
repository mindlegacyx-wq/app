import { Reorder, useDragControls } from 'motion/react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'

import { Button, Card, Checkbox, Dialog, EmptyState, Spinner } from '@/components/ui'
import { errorMessage } from '@/lib/api'
import { useAuth } from '@/lib/auth-store'
import { cn, describeDeadline, relativeDay, todayIn } from '@/lib/format'
import type { GoalAction } from '@/lib/types'

import { ActionSheet } from './ActionSheet'
import { GoalSheet } from './GoalSheet'
import { useDeleteGoal, useGoal, useReorderActions, useToggleAction, useUpdateGoal } from './api'
import { ProgressBar, areaLabel } from './shared'

/** Tela 16: detalhe da meta com progresso, prazo e a lista ordenável de ações. */
export function GoalDetailPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const user = useAuth((s) => s.user)!
  const today = todayIn(user.timezone)

  const goal = useGoal(id)
  const update = useUpdateGoal(id)
  const remove = useDeleteGoal()
  const toggle = useToggleAction({ goalId: id, date: today })
  const reorder = useReorderActions(id)

  const [editOpen, setEditOpen] = useState(false)
  const [actionSheet, setActionSheet] = useState<{ open: boolean; action?: GoalAction }>({ open: false })
  const [confirm, setConfirm] = useState<'complete' | 'delete' | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (goal.isPending) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Spinner className="size-6 text-ink-faint" />
      </div>
    )
  }
  if (goal.isError || !goal.data) {
    return (
      <div className="safe-top pt-2">
        <Header title="Meta" />
        <EmptyState className="mt-6" title="Meta não encontrada" action={<Link to="/metas" className="text-accent">Voltar</Link>} />
      </div>
    )
  }
  const g = goal.data
  const active = g.status === 'active'
  const allDone = g.actions_total > 0 && g.actions_done === g.actions_total

  return (
    <div className="safe-top pt-2">
      <Header title={g.title} />

      {error && (
        <p role="alert" className="mt-3 rounded-md border border-danger/30 bg-danger-soft px-3 py-2.5 text-[14px] text-danger">
          {error}
        </p>
      )}

      <Card className="mt-3">
        <button type="button" onClick={() => setEditOpen(true)} className="w-full text-left">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[12px] font-semibold tracking-[0.06em] text-ink-faint uppercase">
                {areaLabel[g.area]}
                {!active && ` · ${g.status === 'completed' ? 'concluída' : 'arquivada'}`}
              </p>
              <p className="mt-1 text-[15px] text-ink-muted first-letter:uppercase">{describeDeadline(g.deadline, today)}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="tabular text-[26px] font-semibold tracking-[-0.02em]">{g.progress_pct}%</span>
              <svg className="size-4 text-ink-faint" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 5l7 7-7 7" /></svg>
            </div>
          </div>
          <ProgressBar pct={g.progress_pct} className="mt-3" />
          <p className="mt-2 text-[13px] text-ink-muted">
            {g.actions_done} de {g.actions_total} {g.actions_total === 1 ? 'ação' : 'ações'}
          </p>
          {g.description && <p className="mt-3 text-[14px] leading-relaxed text-ink-muted">{g.description}</p>}
        </button>
      </Card>

      <div className="mt-7 flex items-baseline justify-between px-0.5">
        <h2 className="text-[12px] font-semibold tracking-[0.08em] text-ink-faint uppercase">Ações</h2>
        {g.actions.length > 1 && <span className="text-[12px] text-ink-faint">Arraste pela alça para ordenar</span>}
      </div>

      {g.actions.length === 0 ? (
        <EmptyState
          className="mt-2"
          title="Divida a meta em passos"
          description="Ações pequenas, de preferência com data. Cada uma com data vira um item do seu dia."
          action={active ? <Button onClick={() => setActionSheet({ open: true })}>Adicionar ação</Button> : undefined}
        />
      ) : (
        <ActionList
          key={g.actions.map((a) => a.id).join()}
          actions={g.actions}
          today={today}
          editable={active}
          onToggle={(a, done) => toggle.mutate({ id: a.id, done }, { onError: (e) => setError(errorMessage(e)) })}
          onOpen={(a) => setActionSheet({ open: true, action: a })}
          onReorder={(ids) => reorder.mutate(ids, { onError: (e) => setError(errorMessage(e)) })}
        />
      )}

      {g.actions.length > 0 && active && (
        <Button variant="secondary" full className="mt-3" onClick={() => setActionSheet({ open: true })}>
          + Adicionar ação
        </Button>
      )}

      <div className="mt-10 flex flex-col gap-2">
        {active ? (
          <Button size="lg" full variant={allDone ? 'primary' : 'secondary'} onClick={() => setConfirm('complete')}>
            Concluir meta
          </Button>
        ) : (
          <Button size="lg" full variant="secondary" loading={update.isPending} onClick={() => update.mutate({ status: 'active' }, { onError: (e) => setError(errorMessage(e)) })}>
            Reativar meta
          </Button>
        )}
        <div className="flex gap-2">
          {g.status !== 'archived' && (
            <Button variant="ghost" full loading={update.isPending} onClick={() => update.mutate({ status: 'archived' }, { onError: (e) => setError(errorMessage(e)) })}>
              Arquivar
            </Button>
          )}
          <Button variant="ghost" full className="text-danger" onClick={() => setConfirm('delete')}>
            Excluir
          </Button>
        </div>
      </div>

      <GoalSheet open={editOpen} onClose={() => setEditOpen(false)} goal={g} />
      <ActionSheet
        open={actionSheet.open}
        goalId={g.id}
        today={today}
        action={actionSheet.action}
        onClose={() => setActionSheet({ open: false })}
      />

      <Dialog
        open={confirm === 'complete'}
        title="Concluir meta?"
        description={
          allDone
            ? 'Todas as ações estão feitas. A meta vai para Concluídas.'
            : `${g.actions_total - g.actions_done} ${g.actions_total - g.actions_done === 1 ? 'ação ainda está pendente' : 'ações ainda estão pendentes'}. Elas deixam de contar no dia.`
        }
        confirmLabel="Concluir"
        loading={update.isPending}
        onCancel={() => setConfirm(null)}
        onConfirm={() =>
          update.mutate({ status: 'completed' }, { onSuccess: () => setConfirm(null), onError: (e) => setError(errorMessage(e)) })
        }
      />
      <Dialog
        open={confirm === 'delete'}
        title="Excluir meta?"
        description="Ela e as ações vão para a lixeira por 30 dias."
        confirmLabel="Excluir"
        danger
        loading={remove.isPending}
        onCancel={() => setConfirm(null)}
        onConfirm={() => remove.mutate(g.id, { onSuccess: () => navigate('/metas', { replace: true }), onError: (e) => setError(errorMessage(e)) })}
      />
    </div>
  )
}

function Header({ title }: { title: string }) {
  return (
    <header className="flex h-12 items-center gap-3">
      <Link to="/metas" aria-label="Voltar" className="-ml-2 flex size-9 items-center justify-center rounded-full text-ink-muted hover:bg-white/5 hover:text-ink">
        <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 5l-7 7 7 7" />
        </svg>
      </Link>
      <h1 className="truncate text-[20px] font-semibold tracking-[-0.02em]">{title}</h1>
    </header>
  )
}

function ActionList({
  actions,
  today,
  editable,
  onToggle,
  onOpen,
  onReorder,
}: {
  actions: GoalAction[]
  today: string
  editable: boolean
  onToggle: (a: GoalAction, done: boolean) => void
  onOpen: (a: GoalAction) => void
  onReorder: (ids: string[]) => void
}) {
  // Só a ORDEM fica local (para o arrastar ser fluido); os dados vêm sempre do servidor.
  const [orderIds, setOrderIds] = useState(() => actions.map((a) => a.id))
  const byId = new Map(actions.map((a) => [a.id, a]))
  return (
    <Reorder.Group axis="y" values={orderIds} onReorder={setOrderIds} className="mt-2 flex flex-col gap-2" as="ul">
      {orderIds.map((id) => {
        const a = byId.get(id)
        if (!a) return null
        return (
          <ActionRow
            key={a.id}
            action={a}
            today={today}
            editable={editable}
            onToggle={(done) => onToggle(a, done)}
            onOpen={() => onOpen(a)}
            onDrop={() => {
              if (orderIds.join() !== actions.map((i) => i.id).join()) onReorder(orderIds)
            }}
          />
        )
      })}
    </Reorder.Group>
  )
}

function ActionRow({
  action,
  today,
  editable,
  onToggle,
  onOpen,
  onDrop,
}: {
  action: GoalAction
  today: string
  editable: boolean
  onToggle: (done: boolean) => void
  onOpen: () => void
  onDrop: () => void
}) {
  const controls = useDragControls()
  const late = action.due_date !== null && !action.is_done && action.due_date < today
  return (
    <Reorder.Item
      value={action.id}
      dragListener={false}
      dragControls={controls}
      onDragEnd={onDrop}
      className="flex items-center gap-2 rounded-lg border border-line bg-surface pr-3 pl-1"
      whileDrag={{ scale: 1.02, boxShadow: '0 12px 30px rgb(0 0 0 / 45%)', borderColor: 'rgb(255 255 255 / 20%)' }}
    >
      <button
        type="button"
        aria-label="Arrastar para reordenar"
        onPointerDown={(e) => editable && controls.start(e)}
        className={cn('flex h-12 w-7 shrink-0 items-center justify-center text-ink-faint', editable ? 'cursor-grab touch-none active:cursor-grabbing' : 'opacity-40')}
      >
        <svg className="size-4" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
          <circle cx="5.5" cy="3.5" r="1.4" /><circle cx="10.5" cy="3.5" r="1.4" />
          <circle cx="5.5" cy="8" r="1.4" /><circle cx="10.5" cy="8" r="1.4" />
          <circle cx="5.5" cy="12.5" r="1.4" /><circle cx="10.5" cy="12.5" r="1.4" />
        </svg>
      </button>
      <Checkbox label={action.title} checked={action.is_done} onChange={onToggle} disabled={!editable} size="md" />
      <button type="button" onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-3 py-3 text-left">
        <span className={cn('min-w-0 flex-1 truncate text-[15px]', action.is_done && 'text-ink-faint line-through')}>{action.title}</span>
        {action.due_date && (
          <span className={cn('tabular shrink-0 text-[12px] first-letter:uppercase', late ? 'text-warning' : 'text-ink-faint')}>
            {relativeDay(action.due_date, today)}
          </span>
        )}
      </button>
    </Reorder.Item>
  )
}
