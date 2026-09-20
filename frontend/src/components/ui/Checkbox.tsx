import { m, useReducedMotion } from 'motion/react'
import { useRef, useState } from 'react'

import { cn } from '@/lib/format'
import { buzz } from '@/lib/sound'

interface CheckboxProps {
  checked: boolean
  onChange: (next: boolean) => void
  label: string
  disabled?: boolean
  size?: 'md' | 'lg'
}

// Direções das partículas do estouro (8 pontos ao redor).
const SPARKS = Array.from({ length: 8 }, (_, i) => {
  const angle = (i / 8) * Math.PI * 2
  return { dx: `${Math.cos(angle) * 26}px`, dy: `${Math.sin(angle) * 26}px`, delay: (i % 3) * 20 }
})

/**
 * Check circular. É o gesto mais repetido do app: precisa ser leve, mas dar recompensa.
 *
 * Ao marcar: o círculo "estoura" (mola), o traço do check é desenhado e saem oito faíscas.
 * Ao desmarcar, nada disso acontece — comemorar o desfazer seria estranho.
 */
export function Checkbox({ checked, onChange, label, disabled, size = 'lg' }: CheckboxProps) {
  const reduced = useReducedMotion()
  const [burst, setBurst] = useState(0)
  const wasChecked = useRef(checked)

  function toggle(e: React.MouseEvent) {
    e.stopPropagation()
    const next = !checked
    if (next) {
      buzz(12)
      if (!reduced) setBurst((n) => n + 1)
    }
    wasChecked.current = next
    onChange(next)
  }

  return (
    <m.button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={toggle}
      whileTap={reduced ? undefined : { scale: 0.88 }}
      animate={checked && !reduced ? { scale: [1, 1.22, 1] } : { scale: 1 }}
      transition={{ duration: 0.34, ease: [0.25, 1, 0.5, 1] }}
      className={cn(
        'relative flex shrink-0 items-center justify-center rounded-full border-2',
        'transition-colors duration-200 ease-out-quart',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50',
        size === 'lg' ? 'size-7' : 'size-5',
        checked
          ? 'border-accent bg-accent text-on-accent shadow-[0_0_14px_-2px_var(--color-accent)]'
          : 'border-line-strong bg-transparent hover:border-ink-faint',
      )}
    >
      <svg
        viewBox="0 0 16 16"
        className={cn(size === 'lg' ? 'size-4' : 'size-3', checked ? 'opacity-100' : 'opacity-0')}
        fill="none"
        stroke="currentColor"
        strokeWidth="2.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        {/* O traço é "desenhado": dasharray do tamanho do caminho, offset indo a zero. */}
        <path
          d="M3.5 8.5l3 3 6-7"
          strokeDasharray={16}
          strokeDashoffset={checked ? 0 : 16}
          style={{ transition: 'stroke-dashoffset 260ms var(--ease-out-quart) 40ms' }}
        />
      </svg>

      {burst > 0 && checked && !reduced && (
        <span key={burst} className="check-burst" aria-hidden>
          {SPARKS.map((s, i) => (
            <span
              key={i}
              style={{
                ['--dx' as string]: s.dx,
                ['--dy' as string]: s.dy,
                animationDelay: `${s.delay}ms`,
              }}
            />
          ))}
        </span>
      )}
    </m.button>
  )
}
