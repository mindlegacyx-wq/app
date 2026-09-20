/** Cores e rótulos das patentes (Fase 13). A cor muda com a faixa — é o "troféu" visual. */

// Escada de prestígio: começa na cor da marca e vai esquentando até o dourado/magenta.
const RANK_COLORS: Record<string, string> = {
  Recruta: '#c6f135',
  Constante: '#38bdf8',
  Focado: '#a78bfa',
  Disciplinado: '#fb923c',
  Implacável: '#f43f5e',
  Inabalável: '#facc15',
  Lenda: '#e879f9',
  Mito: '#22d3ee',
}

export function rankColor(title: string): string {
  return RANK_COLORS[title] ?? '#c6f135'
}

/** 12.480 → "12.5k" (a barra é estreita; o número exato aparece na Evolução). */
export function shortXp(xp: number): string {
  if (xp < 10_000) return xp.toLocaleString('pt-BR')
  return `${(xp / 1000).toFixed(xp < 100_000 ? 1 : 0).replace('.', ',')}k`
}

export function levelPct(into: number, span: number): number {
  if (span <= 0) return 100
  return Math.max(0, Math.min(100, (into / span) * 100))
}
