import { useState, type FormEvent } from 'react'

import { Button, Dialog, Field, Sheet } from '@/components/ui'
import { errorMessage } from '@/lib/api'
import type { Exercise } from '@/lib/types'

import { useAddExercise, useDeleteExercise, useUpdateExercise } from './api'

interface Props {
  open: boolean
  onClose: () => void
  workoutId: string
  exercise?: Exercise
}

/** Exercício: nome, séries, repetições, carga e descanso. */
export function ExerciseSheet({ open, onClose, workoutId, exercise }: Props) {
  return (
    <Sheet open={open} onClose={onClose} title={exercise ? 'Editar exercício' : 'Novo exercício'}>
      <ExerciseForm workoutId={workoutId} exercise={exercise} onClose={onClose} />
    </Sheet>
  )
}

function ExerciseForm({ workoutId, exercise, onClose }: Omit<Props, 'open'>) {
  const add = useAddExercise(workoutId)
  const update = useUpdateExercise()
  const remove = useDeleteExercise()
  const [name, setName] = useState(exercise?.name ?? '')
  const [sets, setSets] = useState(exercise?.sets ? String(exercise.sets) : '')
  const [reps, setReps] = useState(exercise?.reps ?? '')
  const [load, setLoad] = useState(exercise?.load ?? '')
  const [rest, setRest] = useState(exercise?.rest_seconds ? String(exercise.rest_seconds) : '')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const body = {
      name: name.trim(),
      sets: sets ? Number(sets) : null,
      reps: reps.trim() || null,
      load: load.trim() || null,
      rest_seconds: rest ? Number(rest) : null,
    }
    try {
      if (exercise) {
        const clear = (['sets', 'reps', 'load', 'rest_seconds'] as const).filter((k) => body[k] === null)
        await update.mutateAsync({ id: exercise.id, ...body, clear })
      } else {
        await add.mutateAsync(body)
      }
      onClose()
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <Field label="Exercício" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} required autoFocus={!exercise} placeholder="Ex.: Agachamento livre" />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Séries" type="number" inputMode="numeric" min={1} max={50} value={sets} onChange={(e) => setSets(e.target.value)} placeholder="4" className="[&_input]:tabular" />
        <Field label="Repetições" value={reps} onChange={(e) => setReps(e.target.value)} maxLength={20} placeholder="8-10 ou 30s" className="[&_input]:tabular" />
        <Field label="Carga" value={load} onChange={(e) => setLoad(e.target.value)} maxLength={20} placeholder="60kg, corporal" className="[&_input]:tabular" />
        <Field label="Descanso (s)" type="number" inputMode="numeric" min={5} max={900} value={rest} onChange={(e) => setRest(e.target.value)} placeholder="90" hint="Liga o cronômetro na sessão." className="[&_input]:tabular" />
      </div>
      {error && <p className="text-[14px] text-danger">{error}</p>}
      <Button type="submit" size="lg" full loading={add.isPending || update.isPending} disabled={!name.trim()}>
        {exercise ? 'Salvar' : 'Adicionar'}
      </Button>
      {exercise && (
        <Button type="button" variant="ghost" full className="text-danger" onClick={() => setConfirmDelete(true)}>
          Excluir exercício
        </Button>
      )}
      <Dialog
        open={confirmDelete}
        title="Excluir exercício?"
        description="Ele sai do plano. Sessões anteriores continuam no histórico."
        confirmLabel="Excluir"
        danger
        loading={remove.isPending}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => exercise && remove.mutate(exercise.id, { onSuccess: onClose, onError: (e) => setError(errorMessage(e)) })}
      />
    </form>
  )
}
