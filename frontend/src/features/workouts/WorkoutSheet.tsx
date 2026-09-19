import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'

import { Button, DayPicker, Field, Sheet } from '@/components/ui'
import { errorMessage } from '@/lib/api'
import type { Workout } from '@/lib/types'

import { useCreateWorkout, useUpdateWorkout } from './api'

interface Props {
  open: boolean
  onClose: () => void
  workout?: Workout
}

/** Tela 20 (meta do plano): nome, dias da semana, notas. */
export function WorkoutSheet({ open, onClose, workout }: Props) {
  return (
    <Sheet open={open} onClose={onClose} title={workout ? 'Editar treino' : 'Novo treino'}>
      <WorkoutForm workout={workout} onClose={onClose} />
    </Sheet>
  )
}

function WorkoutForm({ workout, onClose }: { workout?: Workout; onClose: () => void }) {
  const navigate = useNavigate()
  const create = useCreateWorkout()
  const update = useUpdateWorkout(workout?.id ?? '')
  const [name, setName] = useState(workout?.name ?? '')
  const [days, setDays] = useState<number[]>(workout?.days_of_week ?? [0, 2, 4])
  const [notes, setNotes] = useState(workout?.notes ?? '')
  const [error, setError] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (days.length === 0) {
      setError('Escolha pelo menos um dia da semana.')
      return
    }
    try {
      if (workout) {
        await update.mutateAsync({ name: name.trim(), days_of_week: days, notes: notes.trim() || undefined, clear_notes: notes.trim() === '' })
        onClose()
      } else {
        const created = await create.mutateAsync({ name: name.trim(), days_of_week: days, notes: notes.trim() || null })
        onClose()
        navigate(`/treinos/${created.id}`)
      }
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
      <Field label="Nome do treino" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} required autoFocus={!workout} placeholder="Ex.: Treino A · Pernas" />
      <DayPicker value={days} onChange={setDays} />
      <div className="flex flex-col gap-1.5">
        <label htmlFor="wk-notes" className="text-[13px] font-medium text-ink-muted">
          Notas (opcional)
        </label>
        <textarea
          id="wk-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          maxLength={1000}
          placeholder="Aquecimento, observações, progressão de carga…"
          className="w-full resize-none rounded-md border border-line-strong bg-elevated px-4 py-3 text-[15px] outline-none placeholder:text-ink-faint focus:border-accent/70 focus:ring-2 focus:ring-accent/20"
        />
      </div>
      {error && <p className="text-[14px] text-danger">{error}</p>}
      <Button type="submit" size="lg" full loading={create.isPending || update.isPending} disabled={!name.trim()}>
        {workout ? 'Salvar' : 'Criar treino'}
      </Button>
    </form>
  )
}
