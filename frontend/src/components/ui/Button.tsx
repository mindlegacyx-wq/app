import type { ButtonHTMLAttributes, ReactNode } from 'react'

import { cn } from '@/lib/format'

import { Spinner } from './Spinner'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'md' | 'lg' | 'sm'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
  full?: boolean
  icon?: ReactNode
}

const variants: Record<Variant, string> = {
  primary:
    'bg-accent text-on-accent hover:brightness-105 active:brightness-95 disabled:bg-elevated disabled:text-ink-faint',
  secondary:
    'bg-elevated text-ink border border-line-strong hover:bg-white/8 active:bg-white/5 disabled:text-ink-faint',
  ghost: 'bg-transparent text-ink-muted hover:text-ink hover:bg-white/5 disabled:text-ink-faint',
  danger: 'bg-danger-soft text-danger border border-danger/30 hover:bg-danger/20 disabled:text-ink-faint',
}

const sizes: Record<Size, string> = {
  sm: 'h-9 px-3 text-[13px] rounded-sm gap-1.5',
  md: 'h-11 px-4 text-[15px] rounded-md gap-2',
  lg: 'h-13 px-5 text-[16px] rounded-lg gap-2',
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  full = false,
  icon,
  className,
  children,
  disabled,
  ...rest
}: Props) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={cn(
        'relative inline-flex select-none items-center justify-center font-semibold tracking-[-0.01em]',
        'transition-[background-color,filter,transform] duration-150 ease-out-quart active:scale-[0.985]',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:active:scale-100',
        variants[variant],
        sizes[size],
        full && 'w-full',
        className,
      )}
    >
      {loading ? (
        <Spinner className="size-4" />
      ) : (
        <>
          {icon}
          {children}
        </>
      )}
    </button>
  )
}
