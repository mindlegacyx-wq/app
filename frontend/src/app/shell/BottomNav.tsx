import { NavLink } from 'react-router'

import { cn } from '@/lib/format'

const tabs = [
  { to: '/hoje', label: 'Hoje', icon: TodayIcon },
  { to: '/rotina', label: 'Rotina', icon: RoutineIcon },
  { to: '/estudos', label: 'Estudos', icon: StudyIcon },
  { to: '/metas', label: 'Metas', icon: GoalsIcon },
  { to: '/treinos', label: 'Treinos', icon: WorkoutIcon },
  { to: '/evolucao', label: 'Evolução', icon: ProgressIcon },
] as const

export function BottomNav() {
  return (
    <nav
      aria-label="Principal"
      className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-line bg-canvas/85 backdrop-blur-xl"
    >
      <ul className="mx-auto grid max-w-lg grid-cols-6">
        {tabs.map(({ to, label, icon: Icon }) => (
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

type IconProps = { active: boolean }
const base = 'size-6'
const sw = 1.8

function TodayIcon({ active }: IconProps) {
  return (
    <svg className={base} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" fill={active ? 'currentColor' : 'none'} fillOpacity={active ? 0.15 : 0} />
      <path d="M12 7v5l3 2" />
    </svg>
  )
}

function RoutineIcon({ active }: IconProps) {
  return (
    <svg className={base} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="4" width="16" height="16" rx="4" fill={active ? 'currentColor' : 'none'} fillOpacity={active ? 0.15 : 0} />
      <path d="M8 12h8M8 8.5h5M8 15.5h6" />
    </svg>
  )
}

function StudyIcon({ active }: IconProps) {
  return (
    <svg className={base} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H10a2 2 0 0 1 2 2v14a2 2 0 0 0-2-2H5.5A1.5 1.5 0 0 1 4 16.5z" fill={active ? 'currentColor' : 'none'} fillOpacity={active ? 0.15 : 0} />
      <path d="M20 5.5A1.5 1.5 0 0 0 18.5 4H14a2 2 0 0 0-2 2v14a2 2 0 0 1 2-2h4.5a1.5 1.5 0 0 0 1.5-1.5z" fill={active ? 'currentColor' : 'none'} fillOpacity={active ? 0.15 : 0} />
    </svg>
  )
}

function GoalsIcon({ active }: IconProps) {
  return (
    <svg className={base} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" fill={active ? 'currentColor' : 'none'} fillOpacity={active ? 0.15 : 0} />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1.2" fill="currentColor" />
    </svg>
  )
}

function WorkoutIcon({ active }: IconProps) {
  return (
    <svg className={base} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 9v6M17 9v6M4 10.5v3M20 10.5v3M7 12h10" />
      <rect x="6" y="8" width="2" height="8" rx="1" fill={active ? 'currentColor' : 'none'} />
      <rect x="16" y="8" width="2" height="8" rx="1" fill={active ? 'currentColor' : 'none'} />
    </svg>
  )
}

function ProgressIcon({ active }: IconProps) {
  return (
    <svg className={base} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19h16" />
      <path d="M6 15l4-5 4 3 4-7" />
      {active && <circle cx="18" cy="6" r="2" fill="currentColor" stroke="none" />}
    </svg>
  )
}
