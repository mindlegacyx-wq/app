import { Link } from 'react-router'

import { useAuth } from '@/lib/auth-store'
import { cn } from '@/lib/format'

interface TopBarProps {
  title?: string
  subtitle?: string
  /** true na tela Hoje: saudação grande em vez de título */
  hero?: boolean
}

export function TopBar({ title, subtitle, hero = false }: TopBarProps) {
  const user = useAuth((s) => s.user)
  const initial = (user?.name?.trim()[0] ?? '?').toUpperCase()

  return (
    <header className="safe-top sticky top-0 z-20 bg-canvas/85 backdrop-blur-xl">
      {/* No PC o cabeçalho acompanha a largura do conteúdo (o `main` já dá o respiro das bordas);
          no celular continua com a margem própria. */}
      <div
        className={cn(
          'mx-auto flex max-w-lg items-center justify-between px-5 lg:max-w-none lg:px-0',
          hero ? 'pt-2 pb-3' : 'h-14',
        )}
      >
        <div className="min-w-0">
          {subtitle && <p className="truncate text-[13px] text-ink-muted first-letter:uppercase">{subtitle}</p>}
          {title && (
            <h1 className={cn('truncate font-semibold tracking-[-0.02em]', hero ? 'text-[26px]' : 'text-[20px]')}>
              {title}
            </h1>
          )}
        </div>
        <Link
          to="/configuracoes"
          aria-label="Configurações"
          className="flex size-9 shrink-0 items-center justify-center rounded-full border border-line-strong bg-elevated text-[14px] font-semibold text-ink transition-colors hover:bg-white/8"
        >
          {initial}
        </Link>
      </div>
    </header>
  )
}
