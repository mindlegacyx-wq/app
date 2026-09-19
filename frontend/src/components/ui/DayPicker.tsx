import { WEEKDAYS_LONG, WEEKDAYS_SHORT, cn } from '@/lib/format'

interface DayPickerProps {
  value: number[]
  onChange: (days: number[]) => void
  label?: string
}

/** Seletor de dias da semana (0 = segunda … 6 = domingo). */
export function DayPicker({ value, onChange, label = 'Dias da semana' }: DayPickerProps) {
  const toggle = (d: number) => {
    const next = value.includes(d) ? value.filter((x) => x !== d) : [...value, d]
    onChange(next.sort((a, b) => a - b))
  }
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[13px] font-medium text-ink-muted">{label}</span>
      <div className="grid grid-cols-7 gap-1.5" role="group" aria-label={label}>
        {WEEKDAYS_SHORT.map((short, d) => {
          const on = value.includes(d)
          return (
            <button
              key={d}
              type="button"
              aria-pressed={on}
              aria-label={WEEKDAYS_LONG[d]}
              onClick={() => toggle(d)}
              className={cn(
                'h-10 rounded-sm border text-[14px] font-semibold transition-colors',
                on ? 'border-accent bg-accent-soft text-accent' : 'border-line-strong bg-elevated text-ink-faint hover:text-ink',
              )}
            >
              {short}
            </button>
          )
        })}
      </div>
    </div>
  )
}
