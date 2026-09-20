import { AnimatePresence, m, useReducedMotion } from 'motion/react'
import { useEffect, useState } from 'react'

import { Checkbox } from '@/components/ui'
import { cn } from '@/lib/format'
import type { Exercise, LoadMode, WorkoutSet } from '@/lib/types'

import { fmtKg, toReal, toTyped } from './load'

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
  const perSide = exercise.load_mode === 'per_side'
  const [weight, setWeight] = useState(() => formatInput(set.weight, exercise))
  const [reps, setReps] = useState(() => (set.reps === null ? '' : String(set.reps)))
  const [editing, setEditing] = useState(false)

  // O servidor pode preencher a carga sugerida depois que a tela abriu.
  useEffect(() => {
    setWeight(formatInput(set.weight, exercise))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [set.weight])
  useEffect(() => {
    setReps(set.reps === null ? '' : String(set.reps))
  }, [set.reps])

  function commitWeight() {
    setEditing(false)
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

  // "22,5 de cada lado = 65 kg na barra": a conta na frente de quem digita.
  const typedNow = parseNumber(weight)
  const hint = perSide && typedNow !== null ? `${trim(typedNow)} de cada lado = ${fmtKg(toReal(exercise, typedNow))} na barra` : null

  return (
    <m.div layout={reduced ? false : 'position'} className="relative">
      <div className="relative overflow-hidden rounded-md">
        {/* preenchimento suave quando a série é marcada (fica atrás do conteúdo, que é relative) */}
        <AnimatePresence>
          {set.done && (
            <m.span
              className="absolute inset-0 origin-left bg-accent-soft"
              initial={reduced ? { opacity: 0 } : { scaleX: 0, opacity: 0.6 }}
              animate={reduced ? { opacity: 1 } : { scaleX: 1, opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              aria-hidden
            />
          )}
        </AnimatePresence>

        <div className="relative flex items-center gap-2 px-2 py-1.5">
        <span className="w-5 shrink-0 text-center text-[12px] font-semibold text-ink-faint tabular-nums">{set.set_number}</span>

        <Field
          value={weight}
          onChange={setWeight}
          onFocus={() => setEditing(true)}
          onCommit={commitWeight}
          disabled={!editable || bodyweight}
          placeholder={bodyweight ? '—' : '0'}
          suffix={suffixFor(exercise.load_mode)}
          done={set.done}
          label={`Peso da série ${set.set_number}`}
          className="flex-[1.35]"
        />
        <span className="text-[13px] text-ink-faint">×</span>
        <Field
          value={reps}
          onChange={setReps}
          onCommit={commitReps}
          disabled={!editable}
          placeholder="0"
          suffix="reps"
          done={set.done}
          label={`Repetições da série ${set.set_number}`}
        />

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
        </div>
      </div>

      <AnimatePresence initial={false}>
        {editing && hint && (
          <m.p
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="overflow-hidden pl-9 text-[11px] text-ink-faint"
          >
            {hint}
          </m.p>
        )}
      </AnimatePresence>
    </m.div>
  )
}

function Field({
  value,
  onChange,
  onCommit,
  onFocus,
  disabled,
  placeholder,
  suffix,
  done,
  label,
  className,
}: {
  value: string
  onChange: (v: string) => void
  onCommit: () => void
  onFocus?: () => void
  disabled?: boolean
  placeholder: string
  suffix: string
  done: boolean
  label: string
  className?: string
}) {
  return (
    <label
      aria-label={label}
      className={cn(
        'flex min-w-0 flex-1 items-baseline gap-1 rounded-md border px-2 py-1.5 transition-colors',
        disabled ? 'border-transparent bg-transparent' : 'border-line bg-surface focus-within:border-accent',
        done && !disabled && 'border-transparent',
        className,
      )}
    >
      <input
        type="text"
        inputMode="decimal"
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        onFocus={onFocus}
        onChange={(e) => onChange(e.target.value.replace(/[^\d.,]/g, ''))}
        onBlur={onCommit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
        }}
        className="w-full min-w-0 bg-transparent text-[16px] font-semibold tabular-nums outline-none disabled:text-ink-faint"
      />
      <span className="shrink-0 text-[10px] whitespace-nowrap text-ink-faint">{suffix}</span>
    </label>
  )
}

function suffixFor(mode: LoadMode): string {
  if (mode === 'per_side') return 'kg/lado'
  if (mode === 'bodyweight') return 'corpo'
  return 'kg'
}

function trim(value: number): string {
  return (Math.round(value * 100) / 100).toLocaleString('pt-BR', { maximumFractionDigits: 2 })
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
