import { useMemo, useState } from 'react'
import { AnimatePresence, m } from 'motion/react'

import { Sheet, Spinner } from '@/components/ui'
import { cn } from '@/lib/format'
import type { LibraryExercise } from '@/lib/types'

import { useExerciseLibrary } from './api'
import { ExerciseIcon, MuscleIcon } from './ExerciseIcon'

interface Props {
  open: boolean
  onClose: () => void
  onPick: (exercise: LibraryExercise | null) => void // null = "criar do meu jeito"
}

/** Escolha do exercício: busca, grupos musculares e um ícone para cada um. */
export function ExercisePicker({ open, onClose, onPick }: Props) {
  const { data, isPending } = useExerciseLibrary()
  const [query, setQuery] = useState('')
  const [muscle, setMuscle] = useState<string | null>(null)

  const groups = useMemo(() => {
    if (!data) return []
    const term = normalize(query)
    return data.groups
      .filter((g) => !muscle || g.muscle === muscle)
      .map((g) => ({
        ...g,
        exercises: term ? g.exercises.filter((e) => normalize(e.name).includes(term)) : g.exercises,
      }))
      .filter((g) => g.exercises.length > 0)
  }, [data, query, muscle])

  return (
    <Sheet open={open} onClose={onClose} title="Escolher exercício">
      <div className="flex flex-col gap-3">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar (supino, agachamento…)"
          className="w-full rounded-md border border-line bg-surface px-3.5 py-2.5 text-[15px] outline-none focus:border-accent"
          aria-label="Buscar exercício"
        />

        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
          <Pill active={muscle === null} onClick={() => setMuscle(null)}>
            Todos
          </Pill>
          {data?.groups.map((g) => (
            <Pill key={g.muscle} active={muscle === g.muscle} onClick={() => setMuscle(g.muscle)}>
              <MuscleIcon muscle={g.muscle} className="size-4" />
              {g.label}
            </Pill>
          ))}
        </div>

        {isPending ? (
          <div className="flex justify-center py-10">
            <Spinner className="size-5 text-ink-faint" />
          </div>
        ) : (
          <div className="max-h-[52vh] overflow-y-auto pr-1">
            <AnimatePresence mode="popLayout" initial={false}>
              {groups.map((g) => (
                <m.section
                  key={g.muscle}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.18, ease: 'easeOut' }}
                  className="mb-4"
                >
                  <h3 className="flex items-center gap-1.5 px-0.5 text-[11px] tracking-[0.14em] text-ink-faint uppercase">
                    <MuscleIcon muscle={g.muscle} className="size-5 text-accent" />
                    {g.label}
                  </h3>
                  <ul className="mt-1.5 flex flex-col gap-1">
                    {g.exercises.map((e, i) => (
                      <m.li
                        key={e.key}
                        initial={{ opacity: 0, x: -6 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: Math.min(i, 8) * 0.018, duration: 0.16 }}
                      >
                        <button
                          type="button"
                          onClick={() => onPick(e)}
                          className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left transition-colors active:bg-surface"
                        >
                          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-white/6 text-ink-muted">
                            <ExerciseIcon icon={e.icon} />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[15px]">{e.name}</span>
                            <span className="block text-[11px] text-ink-faint">
                              {e.load_mode === 'per_side'
                                ? `barra de ${e.bar_weight} kg · peso por lado`
                                : e.load_mode === 'bodyweight'
                                  ? 'peso do corpo'
                                  : 'peso total'}
                              {e.rest ? ` · ${e.rest}s de descanso` : ''}
                            </span>
                          </span>
                        </button>
                      </m.li>
                    ))}
                  </ul>
                </m.section>
              ))}
            </AnimatePresence>
            {groups.length === 0 && <p className="py-6 text-center text-[14px] text-ink-faint">Nada com esse nome na lista.</p>}
          </div>
        )}

        <button
          type="button"
          onClick={() => onPick(null)}
          className="rounded-md border border-dashed border-line-strong py-2.5 text-[14px] font-medium text-ink-muted active:bg-surface"
        >
          Criar um exercício do meu jeito
        </button>
      </div>
    </Sheet>
  )
}

function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors',
        active ? 'bg-accent text-on-accent' : 'bg-surface text-ink-muted active:bg-elevated',
      )}
    >
      {children}
    </button>
  )
}

function normalize(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}
