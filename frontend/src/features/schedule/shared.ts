import type { BlockKind, ScheduleBlock } from '@/lib/types'

export const kindLabel: Record<BlockKind, string> = {
  class: 'Aula',
  workout: 'Treino',
  study: 'Estudo',
  other: 'Outro',
}
export const KINDS: BlockKind[] = ['class', 'workout', 'study', 'other']

/** Mesma paleta do backend (SUBJECT_COLORS). */
export const SUBJECT_COLORS = ['#C6F135', '#5AC8FA', '#FF9F43', '#B57BFF', '#FF6B8A', '#34D399', '#F5B942', '#9CA3AF']

/** Cor da faixa lateral de um bloco: matéria quando houver; senão, uma cor fixa por tipo. */
const KIND_COLORS: Record<BlockKind, string> = {
  class: '#5AC8FA',
  workout: '#C6F135',
  study: '#B57BFF',
  other: '#9CA3AF',
}
export function blockColor(b: Pick<ScheduleBlock, 'kind' | 'subject_color'>): string {
  return b.subject_color ?? KIND_COLORS[b.kind]
}

/** "07:30:00" → minutos desde 00:00 */
export function toMinutes(hms: string): number {
  const [h, m] = hms.split(':').map(Number) as [number, number]
  return h * 60 + m
}

/** 465 → "07:45" */
export function fromMinutes(min: number): string {
  const h = Math.floor(min / 60) % 24
  return `${String(h).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`
}

export function fmtDuration(min: number): string {
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`
}

/** "HH:MM" atual no fuso do usuário. */
export function nowHm(timezone: string, at = new Date()): string {
  try {
    return new Intl.DateTimeFormat('pt-BR', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).format(at)
  } catch {
    return at.toTimeString().slice(0, 5)
  }
}

/** Sugere um início para um novo bloco: logo depois do último bloco do dia (ou 07:30). */
export function suggestStart(blocks: ScheduleBlock[]): string {
  const last = blocks.filter((b) => b.is_active).at(-1)
  if (!last) return '07:30'
  const end = toMinutes(last.end_time)
  return fromMinutes(Math.min(end, 22 * 60 + 15))
}

export function plusMinutes(hm: string, minutes: number): string {
  return fromMinutes(Math.min(toMinutes(hm) + minutes, 23 * 60 + 59))
}
