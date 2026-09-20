import { NavLink } from 'react-router'

import { cn } from '@/lib/format'

import { NAV_TABS } from './nav-items'

/** Barra de abas do celular. No PC (>= 1024 px) ela some e entra o menu lateral. */
export function BottomNav() {
  return (
    <nav
      aria-label="Principal"
      className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-line bg-canvas/85 backdrop-blur-xl lg:hidden"
    >
      <ul className="mx-auto grid max-w-lg grid-cols-6">
        {NAV_TABS.map(({ to, label, icon: Icon }) => (
          <li key={to}>
            <NavLink
              to={to}
              className={({ isActive }) =>
                cn(
                  'flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors',
                  isActive ? 'text-accent' : 'text-ink-faint hover:text-ink-muted',
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
    </nav>
  )
}
