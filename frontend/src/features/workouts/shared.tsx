import type { Exercise } from '@/lib/types'

import { describeWeight, fmtKg, toTyped } from './load'

/** "4 × 8-10 · 22,5/lado · 65 kg · 90s" a partir dos campos do exercício. */
export function exerciseMeta(
  e: Pick<Exercise, 'sets' | 'reps' | 'load' | 'rest_seconds'> & Partial<Pick<Exercise, 'load_mode' | 'bar_weight' | 'start_weight'>>,
): string {
  const parts: string[] = []
  // "4 séries" por extenso: "4 × 8-12" não diz o que é 4 para quem está começando.
  if (e.sets && e.reps) parts.push(`${e.sets} séries · ${e.reps} reps`)
  else if (e.sets) parts.push(`${e.sets} séries`)
  else if (e.reps) parts.push(`${e.reps} reps`)
  if (e.load) parts.push(e.load)
  else if (e.start_weight != null && e.load_mode) {
    // Na lista basta o que se digita ("22,5 kg/lado"); o total aparece na hora do treino.
    const ex = { load_mode: e.load_mode, bar_weight: e.bar_weight ?? 0 }
    parts.push(
      e.load_mode === 'per_side'
        ? `${fmtKg(toTyped(ex, e.start_weight))}/lado`
        : describeWeight(ex, e.start_weight),
    )
  }
  if (e.rest_seconds) parts.push(`${e.rest_seconds}s`)
  return parts.join(' · ')
}
