import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'

import { Button, Field, Sheet } from '@/components/ui'
import { errorMessage } from '@/lib/api'
import type { Goal, GoalArea } from '@/lib/types'

import { useCreateGoal, useUpdateGoal } from './api'
import { Chip, areaLabel, areas } from './shared'

interface Props {
  open: boolean
  onClose: () => void
  goal?: Goal
}

/** Tela 17: nova meta / editar meta. */
export function GoalSheet({ open, onClose, goal }: Props) {
  return (
    <Sheet open={open} onClose={onClose} title={goal ? 'Editar meta' : 'Nova meta'}>
      <GoalForm goal={goal} onClose={onClose} />
    </Sheet>
  )
}

function GoalForm({ goal, onClose }: { goal?: Goal; onClose: () => void }) {
  const navigate = useNavigate()
  const create = useCreateGoal()
  const update = useUpdateGoal(goal?.id ?? '')
  const [title, setTitle] = useState(goal?.title ?? '')
  const [description, setDescription] = useState(goal?.description ?? '')
  const [area, setArea] = useState<GoalArea>(goal?.area ?? 'personal')
  const [deadline, setDeadline] = useState(goal?.deadline ?? '')
  const [error, setError] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      if (goal) {
        await update.mutateAsync({
          title: title.trim(),
          area,
          description: description.trim() || undefined,
          clear_description: description.trim() === '',
          deadline: deadline || undefined,
          clear_deadline: deadline === '',
        })
        onClose()
      } else {
        const created = await create.mutateAsync({
          title: title.trim(),
          area,
          description: description.trim() || null,
          deadline: deadline || null,
        })
        onClose()
        navigate(`/metas/${created.id}`)
      }
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
      <Field
        label="Qual é a meta"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        maxLength={100}
        required
        autoFocus={!goal}
        placeholder="Ex.: Correr 10 km sem parar"
      />

      <div className="flex flex-col gap-1.5">
        <span className="text-[13px] font-medium text-ink-muted">Área</span>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Área">
          {areas.map((a) => (
            <Chip key={a} active={area === a} onClick={() => setArea(a)}>
              {areaLabel[a]}
            </Chip>
          ))}
        </div>
      </div>

      <Field
        label="Prazo (opcional)"
        type="date"
        value={deadline}
        onChange={(e) => setDeadline(e.target.value)}
        hint="Sem prazo, a meta fica aberta até você concluir."
        className="[&_input]:tabular"
      />

      <div className="flex flex-col gap-1.5">
        <label htmlFor="goal-desc" className="text-[13px] font-medium text-ink-muted">
          Por que essa meta importa (opcional)
        </label>
        <textarea
          id="goal-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          maxLength={2000}
          className="w-full resize-none rounded-md border border-line-strong bg-elevated px-4 py-3 text-[15px] outline-none placeholder:text-ink-faint focus:border-accent/70 focus:ring-2 focus:ring-accent/20"
        />
      </div>

      {error && <p className="text-[14px] text-danger">{error}</p>}
      <Button type="submit" size="lg" full loading={create.isPending || update.isPending} disabled={!title.trim()}>
        {goal ? 'Salvar' : 'Criar meta'}
      </Button>
    </form>
  )
}
