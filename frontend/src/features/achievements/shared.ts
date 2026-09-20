import type { AchievementFamily } from '@/lib/types'

/** Cada família tem a sua cor — é o que dá variedade à vitrine de selos. */
export const FAMILY: Record<AchievementFamily, { label: string; color: string }> = {
  streak: { label: 'Sequência', color: '#fb923c' },
  perfect: { label: 'Dias', color: '#c6f135' },
  level: { label: 'Nível', color: '#38bdf8' },
  league: { label: 'Liga', color: '#a78bfa' },
  area: { label: 'Hábitos', color: '#f472b6' },
}

export const FAMILY_ORDER: AchievementFamily[] = ['streak', 'perfect', 'level', 'league', 'area']

export function familyColor(family: AchievementFamily): string {
  return FAMILY[family].color
}

export function unlockedLabel(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}
