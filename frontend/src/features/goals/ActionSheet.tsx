import { useState, type FormEvent } from 'react'

import { Button, Dialog, Field, Sheet } from '@/components/ui'
import { errorMessage } from '@/lib/api'
import { addDays, relativeDay } from '@/lib/format'
import type { GoalAction } from '@/lib/types'

import { useAddAction, useDeleteAction, useUpdateAction } from './api'
import { Chip } from './shared'

interface Props {
  open: boolean
  onClose: () => void
  goalId: string
  today: string
  action?: GoalAction
}

/** Tela 18: nova ação / editar ação. */
export function ActionSheet({ open, onClose, goalId, today, action }: Props) {
  return (
    <Sheet open={open} onClose={onClose} title={action ? 'Editar ação' : 'Nova ação'}>
      <ActionForm goalId={goalId} today={today} action={action} onClose={onClose} />
    </Sheet>
  )
}

function ActionForm({ goalId, today, action, onClose }: Omit<Props, 'open'>) {
  const add = useAddAction(goalId)
  const update = useUpdateAction()
  const remove = useDeleteAction()
  const [title, setTitle] = useState(action?.title ?? '')
  const [date, setDate] = useState<string>(action?.due_date ?? '')
  const [custom, setCustom] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const quick = [today, addDays(today, 1)]
  const isQuickOrNone = date === '' || quick.includes(date)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      if (action) {
        await update.mutateAsync({ id: action.id, title: title.trim(), due_date: date || undefined, clear_due_date: date === '' })
      } else {
        await add.mutateAsync({ title: title.trim(), due_date: date || null })
      }
      onClose()
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
      <Field
        label="Pequena ação"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        maxLength={120}
        required
        autoFocus={!action}
        placeholder="Ex.: Correr 3 km no parque"
      />

      <div className="flex flex-col gap-1.5">
        <span className="text-[13px] font-medium text-ink-muted">Quando</span>
        <div className="flex flex-wrap gap-2">
          <Chip active={date === '' && !custom} onClick={() => { setDate(''); setCustom(false) }}>
            Sem data
          </Chip>
          {quick.map((d) => (
            <Chip key={d} active={date === d && !custom} onClick={() => { setDate(d); setCustom(false) }}>
              {relativeDay(d, today)}
            </Chip>
          ))}
          <Chip active={custom || !isQuickOrNone} onClick={() => setCustom(true)}>
            {custom || !isQuickOrNone ? (date ? relativeDay(date, today) : 'Escolher') : 'Outro dia'}
          </Chip>
        </div>
        {(custom || !isQuickOrNone) && (
          <input
            type="date"
            aria-label="Data"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="tabular mt-1 h-11 rounded-md border border-line-strong bg-elevated px-3 text-[15px]"
          />
        )}
        <p className="text-[13px] text-ink-faint">Com data, a ação entra na tela Hoje e no seu percentual do dia.</p>
      </div>

      {error && <p className="text-[14px] text-danger">{error}</p>}
      <Button type="submit" size="lg" full loading={add.isPending || update.isPending} disabled={!title.trim()}>
        {action ? 'Salvar' : 'Adicionar'}
      </Button>
      {action && (
        <Button type="button" variant="ghost" full className="text-danger" onClick={() => setConfirmDelete(true)}>
          Excluir ação
        </Button>
      )}

      <Dialog
        open={confirmDelete}
        title="Excluir ação?"
        description="Ela sai da meta e do dia em que estava planejada."
        confirmLabel="Excluir"
        danger
        loading={remove.isPending}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => action && remove.mutate(action.id, { onSuccess: onClose, onError: (e) => setError(errorMessage(e)) })}
      />
    </form>
  )
}
