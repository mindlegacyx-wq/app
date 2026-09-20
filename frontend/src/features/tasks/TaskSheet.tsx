import { useEffect, useState, type FormEvent } from 'react'

import { Button, DayPicker, Dialog, Field, Sheet } from '@/components/ui'
import { errorMessage } from '@/lib/api'
import { addDays, cn, describeDays, relativeDay } from '@/lib/format'
import type { Task, TaskPriority, TaskRecurrence } from '@/lib/types'

import { PriorityIcon, priorityLabel } from './PriorityIcon'
import { RecurrenceForm } from './RecurrenceForm'
import { RepeatIcon } from './RecurrencesSheet'
import { useCategories, useCreateRecurrence, useCreateTask, useDeleteTask, useRecurrences, useUpdateTask } from './api'

interface Props {
  open: boolean
  onClose: () => void
  /** "hoje" no fuso do usuário */
  today: string
  /** quando presente, edita */
  task?: Task
  onManageCategories: () => void
}

/** Tela 6: nova tarefa (uma vez ou fixa) / editar tarefa. */
export function TaskSheet({ open, onClose, today, task, onManageCategories }: Props) {
  const [editingRule, setEditingRule] = useState(false)
  // Só busca a regra quando a tarefa aberta veio de uma.
  const recurrences = useRecurrences()
  const rule = task?.recurrence_id
    ? (recurrences.data?.find((r) => r.id === task.recurrence_id) ?? null)
    : null

  useEffect(() => {
    if (open) setEditingRule(false)
  }, [open, task?.id])

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={editingRule ? 'Editar tarefa fixa' : task ? 'Editar tarefa' : 'Nova tarefa'}
    >
      {editingRule && rule ? (
        <RecurrenceForm recurrence={rule} onClose={onClose} />
      ) : (
        <TaskForm
          today={today}
          task={task}
          rule={rule}
          onEditRule={() => setEditingRule(true)}
          onClose={onClose}
          onManageCategories={onManageCategories}
        />
      )}
    </Sheet>
  )
}

const priorities: TaskPriority[] = ['low', 'medium', 'high']

function TaskForm({
  today,
  task,
  rule,
  onEditRule,
  onClose,
  onManageCategories,
}: Omit<Props, 'open'> & { rule: TaskRecurrence | null; onEditRule: () => void }) {
  const cats = useCategories()
  const create = useCreateTask()
  const createRule = useCreateRecurrence()
  const update = useUpdateTask()
  const remove = useDeleteTask()

  const [title, setTitle] = useState(task?.title ?? '')
  const [date, setDate] = useState(task?.date ?? today)
  const [priority, setPriority] = useState<TaskPriority>(task?.priority ?? 'medium')
  const [categoryId, setCategoryId] = useState<string | null>(task?.category_id ?? null)
  const [notes, setNotes] = useState(task?.notes ?? '')
  const [customDate, setCustomDate] = useState(false)
  // Tarefa fixa: em vez de um dia, uma regra de dias da semana.
  const [repeat, setRepeat] = useState(false)
  const [days, setDays] = useState<number[]>([0, 1, 2, 3, 4])
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const quickDates = [today, addDays(today, 1)]
  const isQuick = quickDates.includes(date)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      if (!task && repeat) {
        if (days.length === 0) {
          setError('Escolha pelo menos um dia da semana.')
          return
        }
        await createRule.mutateAsync({
          title: title.trim(),
          days_of_week: days,
          priority,
          category_id: categoryId,
          notes: notes.trim() || null,
        })
        onClose()
        return
      }
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
      {rule && (
        <button
          type="button"
          onClick={onEditRule}
          className="flex items-center gap-2.5 rounded-md border border-accent/30 bg-accent-soft px-3 py-2.5 text-left"
        >
          <RepeatIcon className="size-4 shrink-0 text-accent" />
          <span className="min-w-0 flex-1">
            <span className="block text-[13px] font-semibold text-accent">Tarefa fixa</span>
            <span className="block text-[12px] text-ink-muted first-letter:uppercase">
              {describeDays(rule.days_of_week)} · o que você mudar aqui vale só para hoje
            </span>
          </span>
          <span className="shrink-0 text-[13px] font-semibold text-accent">Editar a fixa</span>
        </button>
      )}

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
        <div className="flex flex-wrap gap-2">
          {quickDates.map((d) => (
            <Chip
              key={d}
              active={!repeat && date === d && !customDate}
              onClick={() => { setRepeat(false); setDate(d); setCustomDate(false) }}
            >
              {relativeDay(d, today)}
            </Chip>
          ))}
          <Chip active={!repeat && (customDate || !isQuick)} onClick={() => { setRepeat(false); setCustomDate(true) }}>
            {!repeat && (customDate || !isQuick) ? relativeDay(date, today) : 'Outro dia'}
          </Chip>
          {!task && (
            <Chip active={repeat} onClick={() => setRepeat(true)}>
              <RepeatIcon className="size-3.5" />
              Repetir
            </Chip>
          )}
        </div>
        {!repeat && (customDate || !isQuick) && (
          <input
            type="date"
            aria-label="Data"
            value={date}
            onChange={(e) => e.target.value && setDate(e.target.value)}
            className="tabular mt-1 h-11 rounded-md border border-line-strong bg-elevated px-3 text-[15px]"
          />
        )}
        {repeat && (
          <div className="mt-1 flex flex-col gap-1.5">
            <DayPicker value={days} onChange={setDays} label="Repete nestes dias" />
            <p className="text-[12px] text-ink-faint">
              Ela aparece sozinha todo dia marcado, com a caixinha para riscar. Não fez num dia? Não vira atrasada —
              conta zero naquele dia e recomeça no próximo.
            </p>
          </div>
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

      <Button
        type="submit"
        size="lg"
        full
        loading={create.isPending || update.isPending || createRule.isPending}
        disabled={!title.trim()}
      >
        {task ? 'Salvar' : repeat ? 'Criar tarefa fixa' : 'Adicionar'}
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
