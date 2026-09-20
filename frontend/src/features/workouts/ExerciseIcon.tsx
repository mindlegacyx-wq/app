import { cn } from '@/lib/format'

/**
 * Ícones dos exercícios, em dois tons: uma forma preenchida (o "corpo" do equipamento) e
 * traços por cima. Dão peso visual sem virar desenho infantil — e todos dividem a mesma grade
 * de 24, então a lista fica alinhada.
 */
interface IconArt {
  fill?: string // caminho preenchido, com opacidade baixa
  stroke: string // caminhos em traço
}

const ART: Record<string, IconArt> = {
  // Barra: anilhas altas e presilhas nas pontas — bem diferente do halter.
  barbell: {
    fill: 'M4.4 7.8h2.4v8.4H4.4zM17.2 7.8h2.4v8.4h-2.4z',
    stroke: 'M1.9 10.2v3.6M22.1 10.2v3.6M4.4 7.8h2.4v8.4H4.4zM17.2 7.8h2.4v8.4h-2.4zM6.8 12h10.4',
  },
  // Halter: cabeças redondas, pega curta.
  dumbbell: {
    fill: 'M5.9 8.2a1.7 1.7 0 0 1 1.7 1.7v4.2a1.7 1.7 0 0 1-3.4 0V9.9a1.7 1.7 0 0 1 1.7-1.7ZM18.1 8.2a1.7 1.7 0 0 1 1.7 1.7v4.2a1.7 1.7 0 0 1-3.4 0V9.9a1.7 1.7 0 0 1 1.7-1.7Z',
    stroke: 'M5.9 8.2a1.7 1.7 0 0 1 1.7 1.7v4.2a1.7 1.7 0 0 1-3.4 0V9.9a1.7 1.7 0 0 1 1.7-1.7ZM18.1 8.2a1.7 1.7 0 0 1 1.7 1.7v4.2a1.7 1.7 0 0 1-3.4 0V9.9a1.7 1.7 0 0 1 1.7-1.7ZM7.6 12h8.8',
  },
  // Máquina: pilha de placas à esquerda, banco à direita.
  machine: {
    fill: 'M3.2 5.6h5.6v12.2H3.2z',
    stroke: 'M3.2 5.6h5.6v12.2H3.2zM4.7 9.4h2.6M4.7 12.8h2.6M8.8 5.6h6.4M15.2 5.6v9.9M12.4 15.5h7.2M19.6 15.5v-4.3',
  },
  // Polia alta: trilho, roldana, cabo e a barra de pegada.
  cable: {
    fill: 'M12 7.1a1.7 1.7 0 1 1 0 3.4 1.7 1.7 0 0 1 0-3.4Z',
    stroke: 'M3.4 4.4h17.2M12 4.4v2.7M12 7.1a1.7 1.7 0 1 1 0 3.4 1.7 1.7 0 0 1 0-3.4ZM12 10.5v3.1M7.2 13.6h9.6M7.9 13.6v2.9M16.1 13.6v2.9',
  },
  // Peso do corpo: barra fixa e o corpo pendurado.
  body: {
    fill: 'M12 8.2a1.6 1.6 0 1 1 0 3.2 1.6 1.6 0 0 1 0-3.2Z',
    stroke: 'M3.4 4.2h17.2M9.4 4.2l1.5 4M14.6 4.2l-1.5 4M12 8.2a1.6 1.6 0 1 1 0 3.2 1.6 1.6 0 0 1 0-3.2ZM12 11.4v4M12 15.4 9.8 20M12 15.4 14.2 20',
  },
  kettlebell: {
    fill: 'M8.6 11.4h6.8c1.3 1.6 2.2 3.9 2.6 7 .1.9-.6 1.6-1.5 1.6H7.5c-.9 0-1.6-.7-1.5-1.6.4-3.1 1.3-5.4 2.6-7Z',
    stroke: 'M9.4 7.6a2.6 2.6 0 0 1 5.2 0M8.6 11.4h6.8c1.3 1.6 2.2 3.9 2.6 7 .1.9-.6 1.6-1.5 1.6H7.5c-.9 0-1.6-.7-1.5-1.6.4-3.1 1.3-5.4 2.6-7Z',
  },
  // Corrida: figura inteira em passada.
  run: {
    fill: 'M15.4 3.2a1.6 1.6 0 1 1 0 3.2 1.6 1.6 0 0 1 0-3.2Z',
    stroke: 'M15.4 3.2a1.6 1.6 0 1 1 0 3.2 1.6 1.6 0 0 1 0-3.2ZM14.6 7.4l-3.4 4.4M14.2 8.8l3.6 1.3M11.9 9.6l-3.5 1.2M11.2 11.8 8.5 15.3 6.3 20M11.2 11.8l3.7 2.3 1 5.7',
  },
  bike: {
    fill: 'M8.4 8.4h2.8v1.4H8.4z',
    stroke: 'M5.8 13.3a3.1 3.1 0 1 0 0 6.2 3.1 3.1 0 0 0 0-6.2M18.2 13.3a3.1 3.1 0 1 0 0 6.2 3.1 3.1 0 0 0 0-6.2M5.8 16.4l3.8-6.6h5.1l3.5 6.6M9.6 9.8l3.2 6.6M14.4 8.2h2.6',
  },
  // Corda naval: duas ondas saindo das pegadas.
  rope: {
    fill: 'M10.4 3.4h3.2v1.6h-3.2z',
    stroke: 'M10.4 3.4h3.2v1.6h-3.2zM7.4 6.2c3.2 1.7 3.2 4.6 0 6.3s-3.2 4.6 0 6.3M16.6 6.2c-3.2 1.7-3.2 4.6 0 6.3s3.2 4.6 0 6.3',
  },
}

export function ExerciseIcon({ icon, className }: { icon?: string | null; className?: string }) {
  const art = ART[icon ?? ''] ?? ART.dumbbell!
  return (
    <svg viewBox="0 0 24 24" className={cn('size-6', className)} fill="none" aria-hidden>
      {art.fill && <path d={art.fill} fill="currentColor" fillOpacity={0.24} />}
      <path
        d={art.stroke}
        stroke="currentColor"
        strokeWidth={1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/**
 * Grupo muscular como mapa do corpo: a mesma silhueta em todos, com a região trabalhada
 * acesa. Desenho abstrato de músculo vira borrão em 16 px; "onde no corpo" se entende sempre.
 */
const BODY = 'M12 1.6a2.1 2.1 0 1 1 0 4.2 2.1 2.1 0 0 1 0-4.2M8.7 6.6h6.6l1 6.6-1.1.7H8.8l-1.1-.7zM8.9 6.9 6.2 13.4M15.1 6.9l2.7 6.5M9.6 13.9 8.9 21.4M14.4 13.9l.7 7.5'

const HIGHLIGHT: Record<string, string> = {
  chest: 'M9.1 7.6h5.8v2.9H9.1z',
  back: 'M8.6 7.9h1.9v4.3H8.6zM13.5 7.9h1.9v4.3h-1.9z',
  shoulders: 'M8.5 6.1a1.6 1.6 0 1 1 0 3.2 1.6 1.6 0 0 1 0-3.2M15.5 6.1a1.6 1.6 0 1 1 0 3.2 1.6 1.6 0 0 1 0-3.2',
  biceps: 'M6.6 8.8a1.3 1.6 0 1 1 0 3.2 1.3 1.6 0 0 1 0-3.2M17.4 8.8a1.3 1.6 0 1 1 0 3.2 1.3 1.6 0 0 1 0-3.2',
  triceps: 'M6.1 10.6a1.2 1.5 0 1 1 0 3 1.2 1.5 0 0 1 0-3M17.9 10.6a1.2 1.5 0 1 1 0 3 1.2 1.5 0 0 1 0-3',
  legs: 'M9 15h1.9v5.4H9zM13.1 15H15v5.4h-1.9z',
  glutes: 'M8.6 12.6h6.8v2.2H8.6z',
  core: 'M9.6 10.2h4.8v3.3H9.6z',
  cardio: 'M12 12.6s-3-1.9-3-3.9a1.7 1.7 0 0 1 3-1.1 1.7 1.7 0 0 1 3 1.1c0 2-3 3.9-3 3.9Z',
  full: 'M8.7 6.6h6.6l1 6.6-1.1.7H8.8l-1.1-.7z',
}

export function MuscleIcon({ muscle, className }: { muscle: string; className?: string }) {
  const highlight = HIGHLIGHT[muscle] ?? HIGHLIGHT.full!
  return (
    <svg viewBox="0 0 24 24" className={cn('size-4', className)} fill="none" aria-hidden>
      <path
        d={BODY}
        stroke="currentColor"
        strokeOpacity={0.45}
        strokeWidth={1.3}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d={highlight} fill="currentColor" fillOpacity={0.95} />
    </svg>
  )
}
