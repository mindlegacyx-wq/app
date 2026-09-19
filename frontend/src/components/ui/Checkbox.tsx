import { cn } from '@/lib/format'

interface CheckboxProps {
  checked: boolean
  onChange: (next: boolean) => void
  label: string
  disabled?: boolean
  size?: 'md' | 'lg'
}

/** Check circular com animação curta. É o gesto mais repetido do app: precisa ser leve. */
export function Checkbox({ checked, onChange, label, disabled, size = 'lg' }: CheckboxProps) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation()
        if ('vibrate' in navigator && !checked) navigator.vibrate?.(10)
        onChange(!checked)
      }}
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full border-2 transition-all duration-200 ease-out-quart',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50',
        size === 'lg' ? 'size-7' : 'size-5',
        checked ? 'scale-100 border-accent bg-accent text-on-accent' : 'border-line-strong bg-transparent hover:border-ink-faint',
      )}
    >
      <svg
        viewBox="0 0 16 16"
        className={cn(
          'transition-all duration-200 ease-out-quart',
          size === 'lg' ? 'size-4' : 'size-3',
          checked ? 'scale-100 opacity-100' : 'scale-50 opacity-0',
        )}
        fill="none"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M3.5 8.5l3 3 6-7" />
      </svg>
    </button>
  )
}
