import { m } from 'motion/react'

import { cn } from '@/lib/format'
import type { TrainingGoal } from '@/lib/types'

interface Props {
  goals: TrainingGoal[]
  value: string | null
  onChange: (goal: TrainingGoal | null) => void
  className?: string
}

/**
 * Objetivo do treino. Cada faixa vem das diretrizes de treino de força: força usa carga alta e
 * poucas repetições, hipertrofia fica no meio, resistência/definição usa mais repetições com
 * descanso curto. Trocar aqui preenche séries, repetições e descanso — e tudo continua editável.
 */
export function GoalChips({ goals, value, onChange, className }: Props) {
  const current = goals.find((g) => g.key === value) ?? null
  return (
    <div className={className}>
      <div className="grid grid-cols-2 gap-2">
        {goals.map((goal) => {
          const active = goal.key === value
          return (
            <button
              key={goal.key}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(active ? null : goal)}
              className={cn(
                'relative overflow-hidden rounded-md border px-3 py-2 text-left transition-colors',
                active ? 'border-accent text-accent' : 'border-line bg-surface text-ink-muted',
              )}
            >
              {active && (
                <m.span
                  layoutId="goal-fill"
                  className="absolute inset-0 -z-10 bg-accent-soft"
                  transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                />
              )}
              <span className="block text-[14px] font-semibold">{goal.label}</span>
              <span className="block text-[11px] opacity-80">
                {goal.reps} reps · {goal.rest}s
              </span>
            </button>
          )
        })}
      </div>
      {current && <p className="mt-1.5 text-[12px] text-ink-faint">{current.hint}.</p>}
    </div>
  )
}
