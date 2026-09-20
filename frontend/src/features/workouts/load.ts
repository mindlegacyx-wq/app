import type { Exercise, LoadMode } from '@/lib/types'

/**
 * Conversão entre o que o usuário digita e o peso real.
 *
 * Numa barra, "20" significa 20 kg **de cada lado**: o peso real é 20×2 + a barra (20 kg) = 60.
 * Guardamos sempre o real; a tela mostra no formato do exercício.
 */
export function toReal(exercise: Pick<Exercise, 'load_mode' | 'bar_weight'>, typed: number): number {
  if (exercise.load_mode === 'per_side') return typed * 2 + Number(exercise.bar_weight || 0)
  return typed
}

export function toTyped(exercise: Pick<Exercise, 'load_mode' | 'bar_weight'>, real: number): number {
  if (exercise.load_mode === 'per_side') {
    const side = (real - Number(exercise.bar_weight || 0)) / 2
    return Math.max(0, Math.round(side * 100) / 100)
  }
  return real
}

export function loadLabel(mode: LoadMode): string {
  if (mode === 'per_side') return 'kg por lado'
  if (mode === 'bodyweight') return 'kg extra'
  return 'kg'
}

/** "62,5 kg" · "20 de cada lado (60 kg)" · "corpo" */
export function describeWeight(exercise: Pick<Exercise, 'load_mode' | 'bar_weight'>, real: number | null): string {
  if (real === null || real === 0) return exercise.load_mode === 'bodyweight' ? 'corpo' : '—'
  const total = fmtKg(real)
  if (exercise.load_mode === 'per_side') return `${fmtKg(toTyped(exercise, real))}/lado · ${total}`
  return total
}

export function fmtKg(value: number): string {
  const rounded = Math.round(value * 100) / 100
  return `${rounded.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} kg`
}

/** "60 kg × 10, 10, 8" — o resumo do que foi feito da última vez. */
export function describeLastSets(sets: { weight: number | null; reps: number | null; seconds: number | null }[]): string {
  if (sets.length === 0) return ''
  const weights = [...new Set(sets.map((s) => s.weight).filter((w): w is number => w !== null))]
  const reps = sets.map((s) => s.reps ?? s.seconds ?? 0).join(', ')
  if (weights.length === 0) return reps ? `${reps} reps` : ''
  if (weights.length === 1) return `${fmtKg(weights[0]!)} × ${reps}`
  return sets.map((s) => (s.weight ? `${Math.round(s.weight)}×${s.reps ?? 0}` : `${s.reps ?? 0}`)).join(' · ')
}

export function fmtDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  if (m >= 60) {
    const h = Math.floor(m / 60)
    return `${h}h${String(m % 60).padStart(2, '0')}`
  }
  return `${m}:${String(s).padStart(2, '0')}`
}
