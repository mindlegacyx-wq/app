import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from 'react'

import { cn } from '@/lib/format'

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  hint?: string
  error?: string
  trailing?: ReactNode
}

/** Campo de texto com rótulo, dica e erro. */
export const Field = forwardRef<HTMLInputElement, FieldProps>(function Field(
  { label, hint, error, trailing, className, id, ...rest },
  ref,
) {
  const autoId = useId()
  const inputId = id ?? autoId
  const describedBy = error ? `${inputId}-err` : hint ? `${inputId}-hint` : undefined
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={inputId} className="text-[13px] font-medium text-ink-muted">
        {label}
      </label>
      <div className="relative">
        <input
          ref={ref}
          id={inputId}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={describedBy}
          className={cn(
            'h-12 w-full rounded-md border bg-elevated px-4 text-[16px] text-ink placeholder:text-ink-faint',
            'transition-colors duration-150 outline-none focus:border-accent/70 focus:ring-2 focus:ring-accent/20',
            error ? 'border-danger/60' : 'border-line-strong',
            trailing ? 'pr-12' : undefined,
          )}
          {...rest}
        />
        {trailing && <div className="absolute inset-y-0 right-2 flex items-center">{trailing}</div>}
      </div>
      {error ? (
        <p id={`${inputId}-err`} className="text-[13px] text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${inputId}-hint`} className="text-[13px] text-ink-faint">
          {hint}
        </p>
      ) : null}
    </div>
  )
})
