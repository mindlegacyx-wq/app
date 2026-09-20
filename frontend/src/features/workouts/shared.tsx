import type { Exercise } from '@/lib/types'

import { describeWeight } from './load'

/** "4 × 8-10 · 22,5/lado · 65 kg · 90s" a partir dos campos do exercício. */
export function exerciseMeta(
  e: Pick<Exercise, 'sets' | 'reps' | 'load' | 'rest_seconds'> & Partial<Pick<Exercise, 'load_mode' | 'bar_weight' | 'start_weight'>>,
): string {
  const parts: string[] = []
  if (e.sets && e.reps) parts.push(`${e.sets} × ${e.reps}`)
  else if (e.sets) parts.push(`${e.sets} séries`)
  else if (e.reps) parts.push(e.reps)
  if (e.load) parts.push(e.load)
  else if (e.start_weight != null && e.load_mode)
    parts.push(describeWeight({ load_mode: e.load_mode, bar_weight: e.bar_weight ?? 0 }, e.start_weight))
  if (e.rest_seconds) parts.push(`${e.rest_seconds}s`)
  return parts.join(' · ')
}
