import { cn } from '@/lib/format'

/** Ícones dos exercícios: um traço só, para todos parecerem da mesma família. */
const PATHS: Record<string, string> = {
  barbell: 'M3 12h18M5.5 8.5v7M8 7v10M16 7v10M18.5 8.5v7',
  dumbbell: 'M6.5 8v8M17.5 8v8M4 10.5v3M20 10.5v3M9 12h6',
  machine: 'M5 4v16M5 7h9a3 3 0 0 1 3 3v2a3 3 0 0 1-3 3H9M17 17v3M14 20h6',
  cable: 'M12 3v5M9 8h6l-1 4H10zM12 12v4M8.5 20h7M12 16l-3.5 4M12 16l3.5 4',
  body: 'M12 4.5a1.6 1.6 0 1 0 0 3.2 1.6 1.6 0 0 0 0-3.2M12 8.5v6M8 10.5l4 1.5 4-1.5M9.5 20l2.5-5.5 2.5 5.5',
  kettlebell: 'M9.5 7.5a2.5 2.5 0 0 1 5 0M7 20h10a1 1 0 0 0 1-1.2c-.5-3.6-1.9-6-3.4-7.3H9.4C7.9 12.8 6.5 15.2 6 18.8A1 1 0 0 0 7 20Z',
  run: 'M13 4.5a1.4 1.4 0 1 0 0 2.8 1.4 1.4 0 0 0 0-2.8M10 20l2.5-4.5-2-3 1-4 3 2 2.5.5M8.5 12l2-1.5M14.5 12.5l2 3 .5 4',
  bike: 'M6.5 18.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6M17.5 18.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6M9 8.5h3.5l3 7M12.5 8.5 9.5 15.5M14.5 5.5h2.5',
  rope: 'M7 5c3 2 3 5 0 7s-3 5 0 7M17 5c-3 2-3 5 0 7s3 5 0 7',
}

export function ExerciseIcon({ icon, className }: { icon?: string | null; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={cn('size-5', className)}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d={PATHS[icon ?? ''] ?? PATHS.dumbbell} />
    </svg>
  )
}
