import { cn } from '@/lib/format'

interface FabProps {
  label: string
  onClick: () => void
  className?: string
}

/** Botão flutuante: fica acima da barra de abas, canto direito. */
export function Fab({ label, onClick, className }: FabProps) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={cn(
        'fixed right-5 z-30 flex size-14 items-center justify-center rounded-full bg-accent text-on-accent shadow-[0_10px_30px_rgb(198_241_53/25%)]',
        'transition-transform duration-150 ease-out-quart hover:brightness-105 active:scale-95',
        'bottom-[calc(env(safe-area-inset-bottom)+5rem)]',
        className,
      )}
    >
      <svg className="size-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
        <path d="M12 5v14M5 12h14" />
      </svg>
    </button>
  )
}
