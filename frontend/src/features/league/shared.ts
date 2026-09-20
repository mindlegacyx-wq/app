import type { Tier } from '@/lib/types'

/** As cinco divisões, do metal mais pobre ao mais nobre. */
export const TIERS: Record<Tier, { label: string; color: string; next: string | null }> = {
  bronze: { label: 'Bronze', color: '#c2814f', next: 'Prata' },
  silver: { label: 'Prata', color: '#b8c3cf', next: 'Ouro' },
  gold: { label: 'Ouro', color: '#f2c14e', next: 'Platina' },
  platinum: { label: 'Platina', color: '#7dd3fc', next: 'Diamante' },
  diamond: { label: 'Diamante', color: '#a78bfa', next: null },
}

export function tierLabel(tier: Tier): string {
  return TIERS[tier].label
}

export function tierColor(tier: Tier): string {
  return TIERS[tier].color
}

export function ordinal(rank: number): string {
  return `${rank}º`
}

/** "termina hoje" · "1 dia" · "3 dias" */
export function daysLeftLabel(days: number): string {
  if (days <= 0) return 'termina hoje'
  return days === 1 ? 'falta 1 dia' : `faltam ${days} dias`
}
