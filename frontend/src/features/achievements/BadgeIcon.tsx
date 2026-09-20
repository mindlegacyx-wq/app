import { cn } from '@/lib/format'

/** Desenhos dos selos. Um traço só, para ficarem irmãos na vitrine. */
const PATHS: Record<string, string> = {
  flame: 'M12 3c1.5 3 4.5 4.5 4.5 8a4.5 4.5 0 0 1-9 0c0-1.6.6-2.7 1.5-3.7.2 1.4.9 2.2 1.8 2.2 1 0 1.6-.9 1.2-2.3-.3-1.3-.5-2.6 0-4.2Z',
  target: 'M12 3a9 9 0 1 0 9 9M12 7a5 5 0 1 0 5 5M12 12l8-8',
  calendar: 'M4 8h16M8 4v4M16 4v4M5 8h14a1 1 0 0 1 1 1v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V9a1 1 0 0 1 1-1Z',
  bolt: 'M13 3 5 13h6l-1 8 8-10h-6l1-8Z',
  shield: 'M12 3 20 6v6c0 5-3.4 8-8 9.5C7.4 20 4 17 4 12V6l8-3Z',
  crown: 'M4 8l3.5 3L12 5l4.5 6L20 8l-1.5 9h-13L4 8Z',
  sun: 'M12 6.5A5.5 5.5 0 1 0 12 17.5 5.5 5.5 0 1 0 12 6.5M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M19 5l-1.5 1.5M6.5 17.5 5 19',
  check: 'M4 12.5l5 5L20 6.5',
  dumbbell: 'M6.5 8v8M17.5 8v8M4 10v4M20 10v4M8 12h8',
  book: 'M4 5.5A1.5 1.5 0 0 1 5.5 4H10a2 2 0 0 1 2 2v14a2 2 0 0 0-2-2H5.5A1.5 1.5 0 0 1 4 16.5zM20 5.5A1.5 1.5 0 0 0 18.5 4H14a2 2 0 0 0-2 2v14a2 2 0 0 1 2-2h4.5a1.5 1.5 0 0 0 1.5-1.5z',
  flag: 'M6 21V4M6 4h11l-2 3.5L17 11H6',
}

export function BadgeIcon({ icon, className }: { icon: string; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={cn('size-6', className)}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d={PATHS[icon] ?? PATHS.check} />
    </svg>
  )
}
