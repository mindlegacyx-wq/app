import { NavLink } from 'react-router'

import { cn } from '@/lib/format'

import { NAV_TABS } from './nav-items'

/**
 * Menu lateral do PC (a partir de 1024 px). No celular quem manda é a barra de baixo —
 * é o mesmo app e as mesmas abas, só o formato muda com a largura da janela.
 */
export function SideNav() {
  return (
    <nav
      aria-label="Principal"
      className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-line bg-canvas/80 px-3 py-5 backdrop-blur-xl lg:flex"
    >
      <p className="px-3 pb-5 text-[17px] font-semibold tracking-[-0.02em]">Disciplina</p>

      <ul className="flex flex-1 flex-col gap-1">
        {NAV_TABS.map(({ to, label, icon: Icon }) => (
          <li key={to}>
            <NavLink
              to={to}
              className={({ isActive }) =>
                cn(
                  'flex h-11 items-center gap-3 rounded-md px-3 text-[15px] font-medium transition-colors',
                  isActive ? 'bg-accent-soft text-accent' : 'text-ink-muted hover:bg-white/5 hover:text-ink',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Icon active={isActive} />
                  <span>{label}</span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>

      <NavLink
        to="/configuracoes"
        className={({ isActive }) =>
          cn(
            'flex h-11 items-center gap-3 rounded-md px-3 text-[15px] font-medium transition-colors',
            isActive ? 'bg-accent-soft text-accent' : 'text-ink-faint hover:bg-white/5 hover:text-ink',
          )
        }
      >
        <svg className="size-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <circle cx="12" cy="12" r="3.2" />
          <path d="M19.4 14.5a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.03 1.56V21a2 2 0 1 1-4 0v-.11a1.7 1.7 0 0 0-1.11-1.56 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.56-1.03H3a2 2 0 1 1 0-4h.11A1.7 1.7 0 0 0 4.67 8.6a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34H9a1.7 1.7 0 0 0 1-1.56V3a2 2 0 1 1 4 0v.11a1.7 1.7 0 0 0 1.03 1.56 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87V9a1.7 1.7 0 0 0 1.56 1H21a2 2 0 1 1 0 4h-.11a1.7 1.7 0 0 0-1.49 1.5Z" />
        </svg>
        <span>Configurações</span>
      </NavLink>
    </nav>
  )
}
