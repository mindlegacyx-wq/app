import type { Exercise } from '@/lib/types'

/** "4 × 8-10 · 60kg · 90s" a partir dos campos opcionais do exercício. */
export function exerciseMeta(e: Pick<Exercise, 'sets' | 'reps' | 'load' | 'rest_seconds'>): string {
  const parts: string[] = []
  if (e.sets && e.reps) parts.push(`${e.sets} × ${e.reps}`)
  else if (e.sets) parts.push(`${e.sets} séries`)
  else if (e.reps) parts.push(e.reps)
  if (e.load) parts.push(e.load)
  if (e.rest_seconds) parts.push(`${e.rest_seconds}s`)
  return parts.join(' · ')
}
