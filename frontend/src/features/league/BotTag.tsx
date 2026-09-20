/** Marca visível de que o adversário é um robô. Nada de fingir que é gente. */
export function BotTag() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-white/6 px-1.5 py-0.5 text-[10px] font-medium text-ink-faint">
      <svg viewBox="0 0 24 24" className="size-3" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
        <rect x="4" y="8" width="16" height="12" rx="3" />
        <path d="M12 4v4M9 13h.01M15 13h.01M9 17h6" strokeLinecap="round" />
      </svg>
      robô
    </span>
  )
}
