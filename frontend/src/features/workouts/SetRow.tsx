import { m, useReducedMotion } from 'motion/react'
import { useEffect, useState } from 'react'

import { Checkbox } from '@/components/ui'
import { cn } from '@/lib/format'
import type { Exercise, WorkoutSet } from '@/lib/types'

import { toReal, toTyped } from './load'

interface Props {
  set: WorkoutSet
  exercise: Exercise
  editable: boolean
  onChange: (patch: { weight?: number; reps?: number; done?: boolean }) => void
  onRemove?: () => void
}

/** Uma linha de série: peso, repetições e o check que dispara o descanso. */
export function SetRow({ set, exercise, editable, onChange, onRemove }: Props) {
  const reduced = useReducedMotion()
  const bodyweight = exercise.load_mode === 'bodyweight'
  const [weight, setWeight] = useState(() => formatInput(set.weight, exercise))
  const [reps, setReps] = useState(() => (set.reps === null ? '' : String(set.reps)))

  // O servidor pode preencher a carga sugerida depois que a tela abriu.
  useEffect(() => {
    setWeight(formatInput(set.weight, exercise))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [set.weight])
  useEffect(() => {
    setReps(set.reps === null ? '' : String(set.reps))
  }, [set.reps])

  function commitWeight() {
    const typed = parseNumber(weight)
    if (typed === null) return
    const real = toReal(exercise, typed)
    if (real !== set.weight) onChange({ weight: real })
  }

  function commitReps() {
    const value = parseNumber(reps)
    if (value === null || value === set.reps) return
    onChange({ reps: Math.round(value) })
  }

  return (
    <m.div
      layout={reduced ? false : 'position'}
      className={cn('flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors', set.done && 'bg-accent-soft')}
    >
      <span className="w-5 shrink-0 text-center text-[12px] font-semibold text-ink-faint tabular-nums">{set.set_number}</span>

      <Field
        value={weight}
        onChange={setWeight}
        onCommit={commitWeight}
        disabled={!editable || bodyweight}
        placeholder={bodyweight ? '—' : '0'}
        suffix="kg"
        done={set.done}
      />
      <span className="text-[13px] text-ink-faint">×</span>
      <Field value={reps} onChange={setReps} onCommit={commitReps} disabled={!editable} placeholder="0" suffix="reps" done={set.done} />

      <Checkbox
        checked={set.done}
        onChange={(next) => onChange({ done: next })}
        label={`Série ${set.set_number} concluída`}
        disabled={!editable}
        size="md"
      />
      {onRemove && editable && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remover série ${set.set_number}`}
          className="px-1 text-ink-faint active:text-danger"
        >
          <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
            <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
          </svg>
        </button>
      )}
    </m.div>
  )
}

function Field({
  value,
  onChange,
  onCommit,
  disabled,
  placeholder,
  suffix,
  done,
}: {
  value: string
  onChange: (v: string) => void
  onCommit: () => void
  disabled?: boolean
  placeholder: string
  suffix: string
  done: boolean
}) {
  return (
    <label
      className={cn(
        'flex min-w-0 flex-1 items-baseline gap-1 rounded-md border px-2.5 py-1.5',
        disabled ? 'border-transparent bg-transparent' : 'border-line bg-surface focus-within:border-accent',
        done && 'border-transparent',
      )}
    >
      <input
        type="text"
        inputMode="decimal"
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value.replace(/[^\d.,]/g, ''))}
        onBlur={onCommit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
        }}
        className="w-full min-w-0 bg-transparent text-[16px] font-semibold tabular-nums outline-none disabled:text-ink-faint"
      />
      <span className="shrink-0 text-[11px] text-ink-faint">{suffix}</span>
    </label>
  )
}

function parseNumber(text: string): number | null {
  const clean = text.replace(',', '.').trim()
  if (clean === '') return null
  const value = Number(clean)
  return Number.isFinite(value) && value >= 0 ? value : null
}

function formatInput(real: number | null, exercise: Pick<Exercise, 'load_mode' | 'bar_weight'>): string {
  if (real === null) return ''
  const typed = toTyped(exercise, real)
  return String(Math.round(typed * 100) / 100).replace('.', ',')
}
