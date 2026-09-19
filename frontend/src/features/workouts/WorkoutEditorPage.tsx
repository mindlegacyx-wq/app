import { Reorder, useDragControls } from 'motion/react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'

import { Button, Card, Dialog, EmptyState, Spinner, Toggle } from '@/components/ui'
import { errorMessage } from '@/lib/api'
import { cn, describeDays } from '@/lib/format'
import type { Exercise } from '@/lib/types'

import { ExerciseSheet } from './ExerciseSheet'
import { WorkoutSheet } from './WorkoutSheet'
import { useDeleteWorkout, useReorderExercises, useUpdateWorkout, useWorkout } from './api'
import { exerciseMeta } from './shared'

/** Tela 20: plano com dias, notas e a lista ordenável de exercícios. */
export function WorkoutEditorPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const workout = useWorkout(id)
  const update = useUpdateWorkout(id)
  const remove = useDeleteWorkout()
  const reorder = useReorderExercises(id)

  const [metaOpen, setMetaOpen] = useState(false)
  const [exSheet, setExSheet] = useState<{ open: boolean; exercise?: Exercise }>({ open: false })
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (workout.isPending) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Spinner className="size-6 text-ink-faint" />
      </div>
    )
  }
  if (workout.isError || !workout.data) {
    return (
      <div className="safe-top pt-2">
        <Header title="Treino" />
        <EmptyState className="mt-6" title="Treino não encontrado" action={<Link to="/treinos" className="text-accent">Voltar</Link>} />
      </div>
    )
  }
  const w = workout.data

  return (
    <div className="safe-top pt-2">
      <Header title={w.name} />

      {error && (
        <p role="alert" className="mt-3 rounded-md border border-danger/30 bg-danger-soft px-3 py-2.5 text-[14px] text-danger">
          {error}
        </p>
      )}

      <Card className="mt-3">
        <button type="button" onClick={() => setMetaOpen(true)} className="flex w-full items-start justify-between gap-3 text-left">
          <div className="min-w-0">
            <p className="text-[12px] font-semibold tracking-[0.06em] text-ink-faint uppercase">Plano</p>
            <p className="mt-1 text-[15px] text-ink-muted first-letter:uppercase">{describeDays(w.days_of_week)}</p>
            {w.notes && <p className="mt-2 text-[14px] leading-relaxed text-ink-muted">{w.notes}</p>}
          </div>
          <svg className="mt-1 size-4 shrink-0 text-ink-faint" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 5l7 7-7 7" /></svg>
        </button>
        <div className="mt-4 flex items-center justify-between border-t border-line pt-3">
          <div>
            <p className="text-[15px]">Plano ativo</p>
            <p className="text-[13px] text-ink-faint">Pausado, não entra no dia nem no percentual.</p>
          </div>
          <Toggle label="Plano ativo" checked={w.is_active} disabled={update.isPending} onChange={(v) => update.mutate({ is_active: v }, { onError: (e) => setError(errorMessage(e)) })} />
        </div>
      </Card>

      <div className="mt-7 flex items-baseline justify-between px-0.5">
        <h2 className="text-[12px] font-semibold tracking-[0.08em] text-ink-faint uppercase">
          Exercícios {w.exercises.length > 0 && `· ${w.exercises.length}`}
        </h2>
        {w.exercises.length > 1 && <span className="text-[12px] text-ink-faint">Arraste pela alça para ordenar</span>}
      </div>

      {w.exercises.length === 0 ? (
        <EmptyState
          className="mt-2"
          title="Nenhum exercício ainda"
          description="O plano só entra no dia quando tiver pelo menos um exercício."
          action={<Button onClick={() => setExSheet({ open: true })}>Adicionar exercício</Button>}
        />
      ) : (
        <ExerciseList
          key={w.exercises.map((e) => e.id).join()}
          exercises={w.exercises}
          onEdit={(e) => setExSheet({ open: true, exercise: e })}
          onReorder={(ids) => reorder.mutate(ids, { onError: (e) => setError(errorMessage(e)) })}
        />
      )}

      {w.exercises.length > 0 && (
        <Button variant="secondary" full className="mt-3" onClick={() => setExSheet({ open: true })}>
          + Adicionar exercício
        </Button>
      )}

      <div className="mt-10">
        <Button variant="ghost" full className="text-danger" onClick={() => setConfirmDelete(true)}>
          Excluir treino
        </Button>
      </div>

      <WorkoutSheet open={metaOpen} onClose={() => setMetaOpen(false)} workout={w} />
      <ExerciseSheet open={exSheet.open} workoutId={w.id} exercise={exSheet.exercise} onClose={() => setExSheet({ open: false })} />
      <Dialog
        open={confirmDelete}
        title="Excluir treino?"
        description="O plano vai para a lixeira por 30 dias. Sessões já registradas continuam no histórico."
        confirmLabel="Excluir"
        danger
        loading={remove.isPending}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => remove.mutate(w.id, { onSuccess: () => navigate('/treinos', { replace: true }), onError: (e) => setError(errorMessage(e)) })}
      />
    </div>
  )
}

function Header({ title }: { title: string }) {
  return (
    <header className="flex h-12 items-center gap-3">
      <Link to="/treinos" aria-label="Voltar" className="-ml-2 flex size-9 items-center justify-center rounded-full text-ink-muted hover:bg-white/5 hover:text-ink">
        <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 5l-7 7 7 7" />
        </svg>
      </Link>
      <h1 className="truncate text-[20px] font-semibold tracking-[-0.02em]">{title}</h1>
    </header>
  )
}

function ExerciseList({ exercises, onEdit, onReorder }: { exercises: Exercise[]; onEdit: (e: Exercise) => void; onReorder: (ids: string[]) => void }) {
  const [orderIds, setOrderIds] = useState(() => exercises.map((e) => e.id))
  const byId = new Map(exercises.map((e) => [e.id, e]))
  return (
    <Reorder.Group axis="y" values={orderIds} onReorder={setOrderIds} className="mt-2 flex flex-col gap-2" as="ul">
      {orderIds.map((id) => {
        const e = byId.get(id)
        if (!e) return null
        return (
          <ExerciseRow
            key={e.id}
            exercise={e}
            onEdit={() => onEdit(e)}
            onDrop={() => {
              if (orderIds.join() !== exercises.map((x) => x.id).join()) onReorder(orderIds)
            }}
          />
        )
      })}
    </Reorder.Group>
  )
}

function ExerciseRow({ exercise, onEdit, onDrop }: { exercise: Exercise; onEdit: () => void; onDrop: () => void }) {
  const controls = useDragControls()
  const meta = exerciseMeta(exercise)
  return (
    <Reorder.Item
      value={exercise.id}
      dragListener={false}
      dragControls={controls}
      onDragEnd={onDrop}
      className="flex items-center gap-2 rounded-lg border border-line bg-surface pr-3 pl-2"
      whileDrag={{ scale: 1.02, boxShadow: '0 12px 30px rgb(0 0 0 / 45%)', borderColor: 'rgb(255 255 255 / 20%)' }}
    >
      <button type="button" aria-label="Arrastar para reordenar" onPointerDown={(e) => controls.start(e)} className="flex h-12 w-8 shrink-0 cursor-grab touch-none items-center justify-center text-ink-faint active:cursor-grabbing">
        <svg className="size-4" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
          <circle cx="5.5" cy="3.5" r="1.4" /><circle cx="10.5" cy="3.5" r="1.4" />
          <circle cx="5.5" cy="8" r="1.4" /><circle cx="10.5" cy="8" r="1.4" />
          <circle cx="5.5" cy="12.5" r="1.4" /><circle cx="10.5" cy="12.5" r="1.4" />
        </svg>
      </button>
      <button type="button" onClick={onEdit} className="flex min-w-0 flex-1 items-center gap-3 py-3 text-left">
        <span className="min-w-0 flex-1 truncate text-[15px]">{exercise.name}</span>
        {meta && <span className={cn('tabular shrink-0 text-[12px] text-ink-faint')}>{meta}</span>}
      </button>
    </Reorder.Item>
  )
}
