import { useState, type FormEvent } from 'react'

import { Button, DayPicker, Dialog, Field, Toggle } from '@/components/ui'
import { errorMessage } from '@/lib/api'
import { cn } from '@/lib/format'
import type { TaskPriority, TaskRecurrence } from '@/lib/types'

import { PriorityIcon, priorityLabel } from './PriorityIcon'
import { useCategories, useDeleteRecurrence, useUpdateRecurrence } from './api'

const priorities: TaskPriority[] = ['low', 'medium', 'high']

/** Editar a regra de uma tarefa fixa. O que já foi feito nos dias anteriores não muda. */
export function RecurrenceForm({ recurrence, onClose }: { recurrence: TaskRecurrence; onClose: () => void }) {
  const cats = useCategories()
  const update = useUpdateRecurrence()
  const remove = useDeleteRecurrence()
  const [title, setTitle] = useState(recurrence.title)
  const [days, setDays] = useState<number[]>(recurrence.days_of_week)
  const [priority, setPriority] = useState<TaskPriority>(recurrence.priority)
  const [categoryId, setCategoryId] = useState<string | null>(recurrence.category_id)
  const [notes, setNotes] = useState(recurrence.notes ?? '')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (days.length === 0) {
      setError('Escolha pelo menos um dia da semana.')
      return
    }
    try {
      await update.mutateAsync({
        id: recurrence.id,
        title: title.trim(),
        days_of_week: days,
        priority,
        category_id: categoryId ?? undefined,
        clear_category: categoryId === null,
        notes: notes.trim() || undefined,
        clear_notes: notes.trim() === '',
      })
      onClose()
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
      <Field label="O que precisa ser feito" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={140} required />
      <DayPicker value={days} onChange={setDays} label="Repete nestes dias" />

      <div className="flex flex-col gap-1.5">
        <span className="text-[13px] font-medium text-ink-muted">Prioridade</span>
        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Prioridade">
          {priorities.map((p) => (
            <button
              key={p}
              type="button"
              role="radio"
              aria-checked={priority === p}
              onClick={() => setPriority(p)}
              className={cn(
                'flex h-11 items-center justify-center gap-2 rounded-md border text-[14px] font-semibold transition-colors',
                priority === p ? 'border-accent bg-accent-soft text-accent' : 'border-line-strong bg-elevated text-ink-muted',
              )}
            >
              <PriorityIcon priority={p} />
              {priorityLabel[p]}
            </button>
          ))}
        </div>
      </div>

      {(cats.data?.length ?? 0) > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium text-ink-muted">Categoria</span>
          <div className="flex flex-wrap gap-2">
            <Chip active={categoryId === null} onClick={() => setCategoryId(null)}>
              Sem categoria
            </Chip>
            {cats.data?.map((c) => (
              <Chip key={c.id} active={categoryId === c.id} onClick={() => setCategoryId(c.id)}>
                <span className="size-2 rounded-full" style={{ background: c.color }} aria-hidden />
                {c.name}
              </Chip>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="rec-notes" className="text-[13px] font-medium text-ink-muted">
          Notas (opcional)
        </label>
        <textarea
          id="rec-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          maxLength={2000}
          className="w-full resize-none rounded-md border border-line-strong bg-elevated px-4 py-3 text-[15px] outline-none placeholder:text-ink-faint focus:border-accent/70 focus:ring-2 focus:ring-accent/20"
        />
      </div>

      <div className="flex items-center justify-between border-t border-line pt-4">
        <div className="pr-3">
          <p className="text-[15px]">Ativa</p>
          <p className="text-[13px] text-ink-faint">Pausada, ela some dos próximos dias e volta quando você quiser.</p>
        </div>
        <Toggle
          label="Tarefa fixa ativa"
          checked={recurrence.is_active}
          disabled={update.isPending}
          onChange={(v) => update.mutate({ id: recurrence.id, is_active: v }, { onError: (e) => setError(errorMessage(e)) })}
        />
      </div>

      {error && <p className="text-[14px] text-danger">{error}</p>}

      <Button type="submit" size="lg" full loading={update.isPending} disabled={!title.trim()}>
        Salvar
      </Button>
      <Button type="button" variant="ghost" full className="text-danger" onClick={() => setConfirmDelete(true)}>
        Excluir tarefa fixa
      </Button>

      <Dialog
        open={confirmDelete}
        title="Excluir a tarefa fixa?"
        description="Ela para de aparecer daqui para frente. Os dias já marcados continuam no histórico."
        confirmLabel="Excluir"
        danger
        loading={remove.isPending}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() =>
          remove.mutate(recurrence.id, { onSuccess: onClose, onError: (e) => setError(errorMessage(e)) })
        }
      />
    </form>
  )
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium transition-colors',
        active ? 'border-accent bg-accent-soft text-accent' : 'border-line-strong bg-elevated text-ink-muted',
      )}
    >
      {children}
    </button>
  )
}
