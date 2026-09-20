import { useEffect, useState, type FormEvent } from 'react'

import { Button, Dialog, Field, Sheet } from '@/components/ui'
import { errorMessage } from '@/lib/api'
import { cn } from '@/lib/format'
import type { Exercise, LibraryExercise, LoadMode } from '@/lib/types'

import { useAddExercise, useDeleteExercise, useUpdateExercise } from './api'
import { ExerciseIcon } from './ExerciseIcon'
import { ExercisePicker } from './ExercisePicker'
import { loadLabel } from './load'

interface Props {
  open: boolean
  onClose: () => void
  workoutId: string
  exercise?: Exercise
}

/**
 * Novo exercício em dois passos: escolher da biblioteca e depois ajustar séries e carga.
 *
 * Os passos se revezam na mesma camada — sheet sobre sheet fica atrás no celular e confunde.
 */
export function ExerciseSheet({ open, onClose, workoutId, exercise }: Props) {
  const [step, setStep] = useState<'pick' | 'form'>(exercise ? 'form' : 'pick')
  const [preset, setPreset] = useState<LibraryExercise | null>(null)

  useEffect(() => {
    if (!open) return
    setStep(exercise ? 'form' : 'pick')
    setPreset(null)
  }, [open, exercise])

  if (step === 'pick') {
    return (
      <ExercisePicker
        open={open}
        onClose={onClose}
        onPick={(picked) => {
          setPreset(picked)
          setStep('form')
        }}
      />
    )
  }

  return (
    <Sheet open={open} onClose={onClose} title={exercise ? 'Editar exercício' : 'Novo exercício'}>
      <ExerciseForm
        workoutId={workoutId}
        exercise={exercise}
        preset={preset}
        onPickAgain={() => setStep('pick')}
        onClose={onClose}
      />
    </Sheet>
  )
}

function ExerciseForm({
  workoutId,
  exercise,
  preset,
  onPickAgain,
  onClose,
}: Omit<Props, 'open'> & { preset: LibraryExercise | null; onPickAgain: () => void }) {
  const add = useAddExercise(workoutId)
  const update = useUpdateExercise()
  const remove = useDeleteExercise()
  const [name, setName] = useState(preset?.name ?? exercise?.name ?? '')
  const [sets, setSets] = useState(exercise?.sets ? String(exercise.sets) : '3')
  const [reps, setReps] = useState(exercise?.reps ?? '8-12')
  const [rest, setRest] = useState(
    String(exercise?.rest_seconds ?? preset?.rest ?? 90),
  )
  const [mode, setMode] = useState<LoadMode>(preset?.load_mode ?? exercise?.load_mode ?? 'total')
  const [bar, setBar] = useState(String(preset?.bar_weight ?? exercise?.bar_weight ?? 20))
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const icon = preset?.icon ?? exercise?.icon ?? null

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const body = {
      name: name.trim(),
      sets: sets ? Number(sets) : null,
      reps: reps.trim() || null,
      load: null,
      rest_seconds: rest ? Number(rest) : null,
      load_mode: mode,
      bar_weight: mode === 'per_side' ? Number(bar.replace(',', '.')) || 0 : 0,
    }
    try {
      if (exercise) {
        const clear = (['sets', 'reps', 'rest_seconds'] as const).filter((k) => body[k] === null)
        await update.mutateAsync({ id: exercise.id, ...body, clear })
      } else {
        await add.mutateAsync({
          ...body,
          library_key: preset?.key ?? null,
          muscle: preset?.muscle ?? null,
          icon: preset?.icon ?? null,
          increment: preset?.increment ?? null,
        })
      }
      onClose()
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <button
        type="button"
        onClick={onPickAgain}
        className="flex items-center gap-3 rounded-md border border-line bg-surface px-3 py-2.5 text-left active:bg-elevated"
      >
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-white/6 text-ink-muted">
          <ExerciseIcon icon={icon} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-medium">{name || 'Escolher da lista'}</span>
          <span className="block text-[12px] text-ink-faint">Toque para trocar o exercício</span>
        </span>
      </button>

      <Field label="Nome" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} required placeholder="Ex.: Agachamento livre" />

      <div className="grid grid-cols-2 gap-3">
        <Field label="Séries" type="number" inputMode="numeric" min={1} max={50} value={sets} onChange={(e) => setSets(e.target.value)} placeholder="3" className="[&_input]:tabular" />
        <Field label="Repetições" value={reps} onChange={(e) => setReps(e.target.value)} maxLength={20} placeholder="8-12 ou 30s" hint="O topo da faixa é o alvo." className="[&_input]:tabular" />
        <Field label="Descanso (s)" type="number" inputMode="numeric" min={5} max={900} value={rest} onChange={(e) => setRest(e.target.value)} placeholder="90" hint="Liga o cronômetro." className="[&_input]:tabular" />
        {mode === 'per_side' && (
          <Field label="Peso da barra (kg)" inputMode="decimal" value={bar} onChange={(e) => setBar(e.target.value)} placeholder="20" className="[&_input]:tabular" />
        )}
      </div>

      <div>
        <p className="text-[13px] font-medium text-ink-muted">Como você digita o peso</p>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {(['total', 'per_side', 'bodyweight'] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={mode === value}
              onClick={() => setMode(value)}
              className={cn(
                'rounded-md border px-2 py-2 text-[12px] font-medium transition-colors',
                mode === value ? 'border-accent bg-accent-soft text-accent' : 'border-line bg-surface text-ink-muted',
              )}
            >
              {value === 'total' ? 'Total' : value === 'per_side' ? 'Por lado' : 'Corpo'}
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-[12px] text-ink-faint">
          {mode === 'per_side'
            ? `Você digita o que tem de cada lado; o app soma a barra. 20 de cada lado = ${20 * 2 + (Number(bar.replace(',', '.')) || 0)} kg.`
            : mode === 'bodyweight'
              ? 'Sem carga: conta só as repetições (ou o tempo).'
              : `Você digita o peso cheio (${loadLabel('total')}).`}
        </p>
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
