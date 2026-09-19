import { useState, type FormEvent } from 'react'

import { Button, Dialog, Field, Sheet } from '@/components/ui'
import { errorMessage } from '@/lib/api'
import { addDays, cn, relativeDay } from '@/lib/format'
import type { Task, TaskPriority } from '@/lib/types'

import { PriorityIcon, priorityLabel } from './PriorityIcon'
import { useCategories, useCreateTask, useDeleteTask, useUpdateTask } from './api'

interface Props {
  open: boolean
  onClose: () => void
  /** "hoje" no fuso do usuário */
  today: string
  /** quando presente, edita */
  task?: Task
  onManageCategories: () => void
}

/** Tela 6: nova tarefa / editar tarefa. */
export function TaskSheet({ open, onClose, today, task, onManageCategories }: Props) {
  return (
    <Sheet open={open} onClose={onClose} title={task ? 'Editar tarefa' : 'Nova tarefa'}>
      <TaskForm today={today} task={task} onClose={onClose} onManageCategories={onManageCategories} />
    </Sheet>
  )
}

const priorities: TaskPriority[] = ['low', 'medium', 'high']

function TaskForm({ today, task, onClose, onManageCategories }: Omit<Props, 'open'>) {
  const cats = useCategories()
  const create = useCreateTask()
  const update = useUpdateTask()
  const remove = useDeleteTask()

  const [title, setTitle] = useState(task?.title ?? '')
  const [date, setDate] = useState(task?.date ?? today)
  const [priority, setPriority] = useState<TaskPriority>(task?.priority ?? 'medium')
  const [categoryId, setCategoryId] = useState<string | null>(task?.category_id ?? null)
  const [notes, setNotes] = useState(task?.notes ?? '')
  const [customDate, setCustomDate] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const quickDates = [today, addDays(today, 1)]
  const isQuick = quickDates.includes(date)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      if (task) {
        await update.mutateAsync({
          id: task.id,
          title: title.trim(),
          date,
          priority,
          category_id: categoryId ?? undefined,
          clear_category: categoryId === null,
          notes: notes.trim() || undefined,
          clear_notes: notes.trim() === '',
        })
      } else {
        await create.mutateAsync({
          title: title.trim(),
          date,
          priority,
          category_id: categoryId,
          notes: notes.trim() || null,
        })
      }
      onClose()
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  async function setStatus(status: 'cancelled' | 'pending') {
    if (!task) return
    try {
      await update.mutateAsync({ id: task.id, status })
      onClose()
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
      <Field
        label="O que precisa ser feito"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        maxLength={140}
        required
        autoFocus={!task}
        placeholder="Ex.: Enviar proposta para o cliente"
      />

      <div className="flex flex-col gap-1.5">
        <span className="text-[13px] font-medium text-ink-muted">Quando</span>
        <div className="flex gap-2">
          {quickDates.map((d) => (
            <Chip key={d} active={date === d && !customDate} onClick={() => { setDate(d); setCustomDate(false) }}>
              {relativeDay(d, today)}
            </Chip>
          ))}
          <Chip active={customDate || !isQuick} onClick={() => setCustomDate(true)}>
            {customDate || !isQuick ? relativeDay(date, today) : 'Outro dia'}
          </Chip>
        </div>
        {(customDate || !isQuick) && (
          <input
            type="date"
            aria-label="Data"
            value={date}
            onChange={(e) => e.target.value && setDate(e.target.value)}
            className="tabular mt-1 h-11 rounded-md border border-line-strong bg-elevated px-3 text-[15px]"
          />
        )}
      </div>

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
                priority === p ? 'border-accent bg-accent-soft text-accent' : 'border-line-strong bg-elevated text-ink-muted hover:text-ink',
              )}
            >
              <PriorityIcon priority={p} />
              {priorityLabel[p]}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-baseline justify-between">
          <span className="text-[13px] font-medium text-ink-muted">Categoria</span>
          <button type="button" onClick={onManageCategories} className="text-[13px] font-semibold text-accent">
            Gerenciar
          </button>
        </div>
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

      <div className="flex flex-col gap-1.5">
        <label htmlFor="task-notes" className="text-[13px] font-medium text-ink-muted">
          Notas (opcional)
        </label>
        <textarea
          id="task-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          maxLength={2000}
          className="w-full resize-none rounded-md border border-line-strong bg-elevated px-4 py-3 text-[15px] outline-none placeholder:text-ink-faint focus:border-accent/70 focus:ring-2 focus:ring-accent/20"
        />
      </div>

      {error && <p className="text-[14px] text-danger">{error}</p>}

      <Button type="submit" size="lg" full loading={create.isPending || update.isPending} disabled={!title.trim()}>
        {task ? 'Salvar' : 'Adicionar'}
      </Button>

      {task && (
        <div className="flex gap-2">
          {task.status === 'cancelled' ? (
            <Button type="button" variant="secondary" full onClick={() => setStatus('pending')}>
              Reativar
            </Button>
          ) : (
            <Button type="button" variant="secondary" full onClick={() => setStatus('cancelled')}>
              Cancelar tarefa
            </Button>
          )}
          <Button type="button" variant="ghost" full className="text-danger" onClick={() => setConfirmDelete(true)}>
            Excluir
          </Button>
        </div>
      )}

      <Dialog
        open={confirmDelete}
        title="Excluir tarefa?"
        description="Ela vai para a lixeira por 30 dias."
        confirmLabel="Excluir"
        danger
        loading={remove.isPending}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => task && remove.mutate(task.id, { onSuccess: onClose, onError: (e) => setError(errorMessage(e)) })}
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
        'inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium transition-colors first-letter:uppercase',
        active ? 'border-accent bg-accent-soft text-accent' : 'border-line-strong bg-elevated text-ink-muted hover:text-ink',
      )}
    >
      {children}
    </button>
  )
}
