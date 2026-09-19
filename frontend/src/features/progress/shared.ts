import type { ScoreComponent } from '@/lib/types'

export const kindLabel: Record<ScoreComponent, string> = {
  wake: 'Acordar',
  routines: 'Rotinas',
  tasks: 'Tarefas',
  workout: 'Treino',
  goals: 'Metas',
  study: 'Estudos',
}

export const KINDS: ScoreComponent[] = ['wake', 'routines', 'tasks', 'workout', 'goals', 'study']

/** Tom do mapa de calor pela faixa do percentual (0 = sem registro). */
export function heatClass(pct: number | null, hit: boolean): string {
  if (pct === null) return 'bg-white/4 text-ink-faint'
  if (hit) return 'bg-accent text-on-accent'
  if (pct >= 60) return 'bg-accent/45 text-ink'
  if (pct >= 30) return 'bg-accent/22 text-ink'
  if (pct > 0) return 'bg-accent/10 text-ink-muted'
  return 'bg-white/8 text-ink-faint'
}
