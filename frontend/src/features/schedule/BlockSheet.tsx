import { useState, type FormEvent } from 'react'

import { Button, Chip, DayPicker, Dialog, Field, Sheet, Spinner } from '@/components/ui'
import { useWorkouts } from '@/features/workouts/api'
import { errorMessage } from '@/lib/api'
import { WEEKDAYS_LONG, WEEKDAYS_SHORT, cn, shortTime } from '@/lib/format'
import type { BlockKind, ScheduleBlock, Subject } from '@/lib/types'

import { useCreateBlocks, useCreateSubject, useDeleteBlock, useSubjects, useUpdateBlock } from './api'
import { KINDS, SUBJECT_COLORS, fmtDuration, kindLabel, plusMinutes, toMinutes } from './shared'

interface Props {
  open: boolean
  onClose: () => void
  /** Dia pré-selecionado ao criar (0 = segunda). */
  weekday: number
  /** Início sugerido ao criar ("HH:MM"). */
  suggestedStart?: string
  block?: ScheduleBlock
}

/** Tela 30: criar/editar um bloco da agenda (aula, treino, estudo, outro) em um ou mais dias. */
export function BlockSheet({ open, onClose, weekday, suggestedStart, block }: Props) {
  return (
    <Sheet open={open} onClose={onClose} title={block ? 'Editar bloco' : 'Novo bloco'}>
      <BlockForm
        key={block?.id ?? `new-${weekday}-${suggestedStart ?? ''}`}
        weekday={weekday}
        suggestedStart={suggestedStart}
        block={block}
        onClose={onClose}
      />
    </Sheet>
  )
}

function BlockForm({ weekday, suggestedStart, block, onClose }: Omit<Props, 'open'>) {
  const subjects = useSubjects()
  const workouts = useWorkouts()
  const create = useCreateBlocks()
  const update = useUpdateBlock()
  const remove = useDeleteBlock()
  const createSubject = useCreateSubject()

  const [kind, setKind] = useState<BlockKind>(block?.kind ?? 'class')
  const [title, setTitle] = useState(block?.title ?? '')
  const [subjectId, setSubjectId] = useState<string | null>(block?.subject_id ?? null)
  const [workoutId, setWorkoutId] = useState<string | null>(block?.workout_id ?? null)
  const [days, setDays] = useState<number[]>(block ? [block.weekday] : [weekday])
  const [start, setStart] = useState(block ? shortTime(block.start_time) : (suggestedStart ?? '07:30'))
  const [end, setEnd] = useState(block ? shortTime(block.end_time) : plusMinutes(suggestedStart ?? '07:30', 45))
  const [location, setLocation] = useState(block?.location ?? '')
  const [newSubject, setNewSubject] = useState<{
    open: boolean
    name: string
    color: string
  }>({ open: false, name: '', color: SUBJECT_COLORS[1]! })
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const duration = start && end ? toMinutes(end) - toMinutes(start) : 0
  const activeSubjects = (subjects.data ?? []).filter((s) => s.is_active || s.id === subjectId)
  const activeWorkouts = (workouts.data ?? []).filter((w) => w.is_active || w.id === workoutId)

  /** O título segue a matéria/treino escolhido, a menos que o usuário já tenha escrito outro. */
  function pickSubject(s: Subject | null) {
    const prev = activeSubjects.find((x) => x.id === subjectId)
    setSubjectId(s?.id ?? null)
    if (s && (!title.trim() || title === prev?.name)) setTitle(s.name)
  }
  function pickWorkout(id: string | null) {
    const prev = activeWorkouts.find((w) => w.id === workoutId)
    const next = activeWorkouts.find((w) => w.id === id)
    setWorkoutId(id)
    if (next && (!title.trim() || title === prev?.name)) setTitle(next.name)
  }
  function pickKind(k: BlockKind) {
    setKind(k)
    if (k !== 'class') setSubjectId(null)
    if (k !== 'workout') setWorkoutId(null)
    if (k === 'workout' && !title.trim()) setTitle('Treino')
    if (k === 'study' && !title.trim()) setTitle('Estudo')
  }

  async function addSubject() {
    const name = newSubject.name.trim()
    if (!name) return
    try {
      const s = await createSubject.mutateAsync({
        name,
        color: newSubject.color,
      })
      setNewSubject({
        open: false,
        name: '',
        color: SUBJECT_COLORS[(activeSubjects.length + 2) % SUBJECT_COLORS.length]!,
      })
      pickSubject(s)
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (days.length === 0) return setError('Escolha pelo menos um dia da semana.')
    if (!start || !end) return setError('Informe o horário de início e de fim.')
    if (duration <= 0) return setError('O fim precisa ser depois do início.')
    if (kind === 'workout' && !workoutId && activeWorkouts.length > 0 && !title.trim()) return setError('Escolha o treino.')
    const base = {
      title: title.trim(),
      kind,
      subject_id: kind === 'class' ? subjectId : null,
      workout_id: kind === 'workout' ? workoutId : null,
      start_time: start,
      end_time: end,
      location: location.trim() || null,
    }
    try {
      if (block) {
        await update.mutateAsync({
          id: block.id,
          ...base,
          weekday: days[0]!,
          clear_subject: base.subject_id === null,
          clear_workout: base.workout_id === null,
          clear_location: base.location === null,
        })
      } else {
        await create.mutateAsync({ ...base, weekdays: days })
      }
      onClose()
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
      <div className="flex flex-col gap-1.5">
        <span className="text-[13px] font-medium text-ink-muted">Tipo</span>
        <div className="grid grid-cols-4 gap-2" role="radiogroup" aria-label="Tipo do bloco">
          {KINDS.map((k) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={kind === k}
              onClick={() => pickKind(k)}
              className={cn(
                'h-10 rounded-sm border text-[13px] font-semibold transition-colors',
                kind === k ? 'border-accent bg-accent-soft text-accent' : 'border-line-strong bg-elevated text-ink-muted hover:text-ink',
              )}
            >
              {kindLabel[k]}
            </button>
          ))}
        </div>
      </div>

      {kind === 'class' && (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between">
            <span className="text-[13px] font-medium text-ink-muted">Matéria</span>
            {!newSubject.open && (
              <button
                type="button"
                onClick={() => setNewSubject((s) => ({ ...s, open: true }))}
                className="text-[13px] font-semibold text-accent"
              >
                + Nova matéria
              </button>
            )}
          </div>
          {subjects.isPending ? (
            <Spinner className="size-4 text-ink-faint" />
          ) : (
            <div className="flex flex-wrap gap-2">
              <Chip active={subjectId === null} onClick={() => pickSubject(null)}>
                Sem matéria
              </Chip>
              {activeSubjects.map((s) => (
                <Chip key={s.id} active={subjectId === s.id} onClick={() => pickSubject(s)}>
                  <span className="size-2 rounded-full" style={{ background: s.color }} aria-hidden />
                  {s.name}
                </Chip>
              ))}
            </div>
          )}
          {newSubject.open && (
            <div className="mt-1 flex flex-col gap-3 rounded-lg border border-line-strong bg-elevated p-3">
              <Field
                label="Nome da matéria"
                value={newSubject.name}
                onChange={(e) => setNewSubject((s) => ({ ...s, name: e.target.value }))}
                maxLength={60}
                placeholder="Ex.: Matemática"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    void addSubject()
                  }
                }}
              />
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Cor da matéria">
                {SUBJECT_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    role="radio"
                    aria-checked={newSubject.color === c}
                    aria-label={c}
                    onClick={() => setNewSubject((s) => ({ ...s, color: c }))}
                    className={cn(
                      'size-8 rounded-full border-2 transition-transform',
                      newSubject.color === c ? 'scale-110 border-ink' : 'border-transparent',
                    )}
                    style={{ background: c }}
                  />
                ))}
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="secondary" full onClick={() => setNewSubject((s) => ({ ...s, open: false }))}>
                  Cancelar
                </Button>
                <Button
                  type="button"
                  full
                  loading={createSubject.isPending}
                  disabled={!newSubject.name.trim()}
                  onClick={() => void addSubject()}
                >
                  Adicionar matéria
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {kind === 'workout' && (
        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium text-ink-muted">Plano de treino</span>
          {workouts.isPending ? (
            <Spinner className="size-4 text-ink-faint" />
          ) : activeWorkouts.length === 0 ? (
            <p className="text-[13px] text-ink-faint">
              Nenhum plano criado ainda. O bloco só marca o horário; crie o plano na aba Treinos.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Chip active={workoutId === null} onClick={() => pickWorkout(null)}>
                Só o horário
              </Chip>
              {activeWorkouts.map((w) => (
                <Chip key={w.id} active={workoutId === w.id} onClick={() => pickWorkout(w.id)}>
                  {w.name}
                </Chip>
              ))}
            </div>
          )}
        </div>
      )}

      <Field
        label="Título"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        maxLength={60}
        required
        placeholder={kind === 'class' ? 'Ex.: Matemática' : kind === 'workout' ? 'Ex.: Treino A' : 'Ex.: Curso de inglês'}
      />

      {block ? (
        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium text-ink-muted">Dia da semana</span>
          <div className="grid grid-cols-7 gap-1.5" role="radiogroup" aria-label="Dia da semana">
            {WEEKDAYS_SHORT.map((short, d) => (
              <button
                key={d}
                type="button"
                role="radio"
                aria-checked={days[0] === d}
                aria-label={WEEKDAYS_LONG[d]}
                onClick={() => setDays([d])}
                className={cn(
                  'h-10 rounded-sm border text-[14px] font-semibold transition-colors',
                  days[0] === d
                    ? 'border-accent bg-accent-soft text-accent'
                    : 'border-line-strong bg-elevated text-ink-faint hover:text-ink',
                )}
              >
                {short}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <DayPicker value={days} onChange={setDays} label="Dias da semana (cria um bloco em cada)" />
      )}

      <div className="grid grid-cols-2 gap-3">
        <Field
          label="Início"
          type="time"
          value={start}
          onChange={(e) => {
            const v = e.target.value
            // Mantém a duração ao mover o início.
            if (v && start && end && duration > 0) setEnd(plusMinutes(v, duration))
            setStart(v)
          }}
          className="[&_input]:tabular"
          required
        />
        <Field
          label="Fim"
          type="time"
          value={end}
          onChange={(e) => setEnd(e.target.value)}
          className="[&_input]:tabular"
          hint={duration > 0 ? fmtDuration(duration) : undefined}
          required
        />
      </div>
      {!block && kind === 'class' && (
        <div className="-mt-2 flex flex-wrap gap-2" aria-label="Duração rápida">
          {[45, 50, 60, 90].map((m) => (
            <Chip key={m} active={duration === m} onClick={() => start && setEnd(plusMinutes(start, m))}>
              {fmtDuration(m)}
            </Chip>
          ))}
        </div>
      )}

      <Field
        label="Local (opcional)"
        value={location}
        onChange={(e) => setLocation(e.target.value)}
        maxLength={60}
        placeholder="Ex.: Sala 12 · Academia"
      />

      {error && <p className="text-[14px] text-danger">{error}</p>}

      <Button type="submit" size="lg" full loading={create.isPending || update.isPending} disabled={!title.trim()}>
        {block ? 'Salvar' : days.length > 1 ? `Criar em ${days.length} dias` : 'Criar bloco'}
      </Button>

      {block && (
        <div className="flex gap-2">
          <Button
            type="button"
            variant="secondary"
            full
            loading={update.isPending}
            onClick={() =>
              update.mutate(
                { id: block.id, is_active: !block.is_active },
                {
                  onSuccess: onClose,
                  onError: (e) => setError(errorMessage(e)),
                },
              )
            }
          >
            {block.is_active ? 'Pausar' : 'Reativar'}
          </Button>
          <Button type="button" variant="ghost" full className="text-danger" onClick={() => setConfirmDelete(true)}>
            Excluir
          </Button>
        </div>
      )}

      <Dialog
        open={confirmDelete}
        title="Excluir bloco?"
        description={block ? `"${block.title}" de ${WEEKDAYS_LONG[block.weekday]} vai para a lixeira por 30 dias.` : undefined}
        confirmLabel="Excluir"
        danger
        loading={remove.isPending}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() =>
          block &&
          remove.mutate(block.id, {
            onSuccess: () => {
              setConfirmDelete(false)
              onClose()
            },
            onError: (e) => {
              setConfirmDelete(false)
              setError(errorMessage(e))
            },
          })
        }
      />
    </form>
  )
}
