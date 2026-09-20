import { useId, useMemo, useState } from 'react'

import { cn } from '@/lib/format'

export interface ChartPoint {
  x: string // rótulo do eixo (data em ISO)
  y: number
}

interface Props {
  points: ChartPoint[]
  height?: number
  /** Formata o valor no rótulo e no tooltip ("82,5 kg"). */
  format?: (value: number) => string
  /** Formata a data do eixo e do tooltip. */
  formatX?: (x: string) => string
  className?: string
  label?: string // nome da série (o título já diz qual é; vai para o aria-label)
}

const PAD = { top: 16, right: 44, bottom: 20, left: 8 }

/**
 * Gráfico de linha de uma série só — SVG inline, sem biblioteca.
 *
 * Decisões: uma série dispensa legenda (o título nomeia); a grade é recessiva e horizontal;
 * o último ponto recebe rótulo direto (em vez de número em todos); o toque mostra a linha-guia
 * com o valor daquele dia. Em tela escura, a linha usa a cor de destaque do app.
 */
export function LineChart({ points, height = 140, format = String, formatX, className, label }: Props) {
  const gradientId = useId()
  const [active, setActive] = useState<number | null>(null)
  const width = 320 // viewBox fixo; o SVG escala com a largura do cartão

  const geometry = useMemo(() => {
    if (points.length === 0) return null
    const values = points.map((p) => p.y)
    let min = Math.min(...values)
    let max = Math.max(...values)
    if (min === max) {
      // Série plana: dá respiro para a linha não colar na borda
      min -= 1
      max += 1
    }
    const span = max - min
    min -= span * 0.12
    max += span * 0.12
    const innerW = width - PAD.left - PAD.right
    const innerH = height - PAD.top - PAD.bottom
    const step = points.length > 1 ? innerW / (points.length - 1) : 0
    const coords = points.map((p, i) => ({
      x: PAD.left + (points.length > 1 ? i * step : innerW / 2),
      y: PAD.top + innerH - ((p.y - min) / (max - min)) * innerH,
    }))
    return { coords, min, max, innerH }
  }, [points, height])

  if (!geometry || points.length === 0) {
    return (
      <div className={cn('flex items-center justify-center text-[13px] text-ink-faint', className)} style={{ height }}>
        Sem dados ainda.
      </div>
    )
  }

  const { coords } = geometry
  const line = coords.map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(' ')
  const area = `${line} L${coords.at(-1)!.x.toFixed(1)} ${height - PAD.bottom} L${coords[0]!.x.toFixed(1)} ${height - PAD.bottom} Z`
  const last = coords.at(-1)!
  const shown = active ?? points.length - 1

  return (
    <div className={cn('relative', className)}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full touch-none"
        style={{ height }}
        role="img"
        aria-label={label ? `${label}: ${points.length} registros` : `${points.length} registros`}
        onPointerMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect()
          const ratio = ((e.clientX - rect.left) / rect.width) * width
          let nearest = 0
          coords.forEach((c, i) => {
            if (Math.abs(c.x - ratio) < Math.abs(coords[nearest]!.x - ratio)) nearest = i
          })
          setActive(nearest)
        }}
        onPointerLeave={() => setActive(null)}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-accent)" stopOpacity="0.22" />
            <stop offset="100%" stopColor="var(--color-accent)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Grade recessiva: três linhas, sem moldura */}
        {[0, 0.5, 1].map((t) => {
          const y = PAD.top + geometry.innerH * t
          return (
            <line
              key={t}
              x1={PAD.left}
              x2={width - PAD.right}
              y1={y}
              y2={y}
              stroke="currentColor"
              className="text-white/8"
              strokeWidth={1}
            />
          )
        })}

        <path d={area} fill={`url(#${gradientId})`} />
        <path
          d={line}
          fill="none"
          stroke="currentColor"
          className="text-accent"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Linha-guia do ponto tocado */}
        {active !== null && (
          <line
            x1={coords[active]!.x}
            x2={coords[active]!.x}
            y1={PAD.top - 6}
            y2={height - PAD.bottom}
            stroke="currentColor"
            className="text-ink-faint"
            strokeWidth={1}
            strokeDasharray="3 3"
          />
        )}

        {/* Ponto em foco com anel da superfície, para não sumir na linha */}
        <circle cx={coords[shown]!.x} cy={coords[shown]!.y} r={5} className="fill-accent" stroke="var(--color-surface)" strokeWidth={2} />
        {active === null && points.length > 1 && (
          <text x={last.x + 8} y={last.y + 4} className="fill-ink text-[11px] font-semibold" style={{ fontVariantNumeric: 'tabular-nums' }}>
            {format(points.at(-1)!.y)}
          </text>
        )}
      </svg>

      <div className="mt-1 flex items-baseline justify-between text-[11px] text-ink-faint">
        <span>{formatX ? formatX(points[0]!.x) : points[0]!.x}</span>
        {/* O ponto tocado toma o meio; sem toque, só as pontas (nada de número em tudo). */}
        {active !== null && (
          <span className="text-ink-muted tabular-nums">
            {formatX ? formatX(points[shown]!.x) : points[shown]!.x} · {format(points[shown]!.y)}
          </span>
        )}
        <span>{formatX ? formatX(points.at(-1)!.x) : points.at(-1)!.x}</span>
      </div>
    </div>
  )
}
