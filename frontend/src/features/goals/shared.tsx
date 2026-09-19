import { cn } from '@/lib/format'
import type { GoalArea } from '@/lib/types'

export const areaLabel: Record<GoalArea, string> = {
  health: 'Saúde',
  career: 'Carreira',
  finance: 'Finanças',
  study: 'Estudos',
  personal: 'Pessoal',
  other: 'Outro',
}

export const areas = Object.keys(areaLabel) as GoalArea[]

/** Barra de progresso fina, mesma linguagem do "por área" do fechamento. */
export function ProgressBar({ pct, className }: { pct: number; className?: string }) {
  return (
    <div className={cn('h-1.5 w-full overflow-hidden rounded-full bg-white/8', className)} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <div
        className={cn('h-full rounded-full transition-[width] duration-500 ease-out-quart', pct === 100 ? 'bg-accent' : 'bg-ink-muted')}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

export function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium transition-colors first-letter:uppercase',
        active ? 'border-accent bg-accent-soft text-accent' : 'border-line-strong bg-elevated text-ink-muted hover:text-ink',
      )}
    >
      {children}
    </button>
  )
}
