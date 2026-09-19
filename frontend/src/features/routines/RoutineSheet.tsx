import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'

import { Button, DayPicker, Field, Sheet } from '@/components/ui'
import { errorMessage } from '@/lib/api'
import { shortTime } from '@/lib/format'
import type { Routine, RoutineKind } from '@/lib/types'

import { useCreateRoutine, useUpdateRoutine } from './api'

interface Props {
  open: boolean
  onClose: () => void
  /** tipo ao criar */
  kind?: RoutineKind
  /** quando presente, edita em vez de criar */
  routine?: Routine
}

const defaults: Record<RoutineKind, { name: string; start: string }> = {
  morning: { name: 'Manhã', start: '06:00' },
  evening: { name: 'Noite', start: '22:00' },
  custom: { name: '', start: '09:00' },
}

export function RoutineSheet({ open, onClose, kind = 'custom', routine }: Props) {
  const editing = Boolean(routine)
  const title = editing ? 'Editar rotina' : kind === 'custom' ? 'Novo bloco' : `Rotina da ${kind === 'morning' ? 'manhã' : 'noite'}`
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      {/* O formulário monta a cada abertura: estado sempre limpo, sem efeitos. */}
      <RoutineForm kind={kind} routine={routine} onClose={onClose} />
    </Sheet>
  )
}

function RoutineForm({ kind, routine, onClose }: { kind: RoutineKind; routine?: Routine; onClose: () => void }) {
  const navigate = useNavigate()
  const editing = Boolean(routine)
  const [name, setName] = useState(routine?.name ?? defaults[kind].name)
  const [start, setStart] = useState(routine?.start_time ? shortTime(routine.start_time) : defaults[kind].start)
  const [days, setDays] = useState<number[]>(routine?.days_of_week ?? [0, 1, 2, 3, 4, 5, 6])
  const [error, setError] = useState<string | null>(null)

  const create = useCreateRoutine()
  const update = useUpdateRoutine(routine?.id ?? '')
  const pending = create.isPending || update.isPending

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (days.length === 0) {
      setError('Escolha pelo menos um dia da semana.')
      return
    }
    const body = { name: name.trim(), start_time: start || null, days_of_week: days }
    try {
      if (routine) {
        await update.mutateAsync(body)
        onClose()
      } else {
        const created = await create.mutateAsync({ ...body, kind })
        onClose()
        navigate(`/rotina/${created.id}`)
      }
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <Field label="Nome" value={name} onChange={(e) => setName(e.target.value)} required autoFocus={!editing} maxLength={60} />
      <Field
        label="Horário de início"
        type="time"
        value={start}
        onChange={(e) => setStart(e.target.value)}
        hint={kind === 'morning' ? 'Normalmente, o seu horário de acordar.' : undefined}
        className="[&_input]:tabular"
      />
      <DayPicker value={days} onChange={setDays} />
      {error && <p className="text-[14px] text-danger">{error}</p>}
      <Button type="submit" size="lg" full loading={pending} disabled={!name.trim()}>
        {editing ? 'Salvar' : 'Criar'}
      </Button>
    </form>
  )
}
