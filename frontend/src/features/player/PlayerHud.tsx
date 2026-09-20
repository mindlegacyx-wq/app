import { AnimatePresence, m, useReducedMotion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'

import { buzz, levelUpSound } from '@/lib/sound'
import type { Player } from '@/lib/types'

import { usePlayer } from './api'
import { LevelBadge } from './LevelBadge'
import { levelPct, rankColor, shortXp } from './shared'

interface Gain {
  id: number
  amount: number
}

/**
 * HUD do jogador: barra de XP fixa no topo + "+XP" flutuante + festa ao subir de nível.
 *
 * O XP vem do servidor (derivado do dia). Aqui só comparamos o valor novo com o anterior:
 * se subiu, mostra o ganho; se o nível mudou, abre a comemoração. Nada é guardado no
 * aparelho, então o mesmo ganho não aparece duas vezes ao trocar de tela.
 */
export function PlayerHud() {
  const { data } = usePlayer()
  const reduced = useReducedMotion()
  const previous = useRef<Player | null>(null)
  const [gains, setGains] = useState<Gain[]>([])
  const [celebrate, setCelebrate] = useState<Player | null>(null)

  useEffect(() => {
    if (!data) return
    const before = previous.current
    previous.current = data
    if (!before) return // primeira carga: sem festa
    const delta = data.total_xp - before.total_xp
    if (delta > 0) {
      const gain = { id: Date.now() + Math.random(), amount: delta }
      setGains((g) => [...g.slice(-2), gain])
      window.setTimeout(() => setGains((g) => g.filter((x) => x.id !== gain.id)), 1500)
    }
    if (data.level > before.level) {
      setCelebrate(data)
      levelUpSound()
      buzz([18, 60, 26])
    }
  }, [data])

  if (!data) return null

  const pct = levelPct(data.into_level, data.level_span)
  const color = rankColor(data.title)
  const gain = gains[gains.length - 1]

  return (
    <>
      <div className="safe-top sticky top-0 z-20 border-b border-line bg-canvas/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-lg items-center gap-3 px-5 py-2 lg:max-w-4xl lg:px-8">
          <LevelBadge level={data.level} title={data.title} />
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-2 text-[11px] leading-none">
              <span className="truncate font-semibold tracking-wide" style={{ color }}>
                {data.title}
              </span>
              {/* O ganho toma o lugar do contador por um instante: sem sobreposição. */}
              <AnimatePresence mode="wait" initial={false}>
                {gain ? (
                  <m.span
                    key={gain.id}
                    initial={{ opacity: 0, y: 6, scale: 0.8 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: reduced ? 0 : 0.28, ease: [0.25, 1, 0.5, 1] }}
                    className="shrink-0 rounded-full px-2 py-0.5 text-[12px] font-semibold tabular-nums"
                    style={{ color, background: `${color}24` }}
                  >
                    +{gain.amount} XP
                  </m.span>
                ) : (
                  <m.span
                    key="counter"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: reduced ? 0 : 0.2 }}
                    className="shrink-0 tabular-nums text-ink-faint"
                  >
                    {data.max_level ? `${shortXp(data.total_xp)} XP` : `${shortXp(data.into_level)}/${shortXp(data.level_span)}`}
                  </m.span>
                )}
              </AnimatePresence>
            </div>
            <div
              className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/8 transition-shadow duration-300"
              style={gain && !reduced ? { boxShadow: `0 0 12px -1px ${color}` } : undefined}
            >
              <m.div
                className="relative h-full rounded-full"
                style={{ background: `linear-gradient(90deg, ${color}99, ${color})` }}
                initial={false}
                animate={{ width: `${pct}%` }}
                transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 120, damping: 20 }}
              >
                {!reduced && <span className="xp-shimmer absolute inset-0 rounded-full" aria-hidden />}
              </m.div>
            </div>
          </div>
        </div>
      </div>

      <LevelUpOverlay player={celebrate} onClose={() => setCelebrate(null)} />
    </>
  )
}

function LevelUpOverlay({ player, onClose }: { player: Player | null; onClose: () => void }) {
  const reduced = useReducedMotion()

  useEffect(() => {
    if (!player) return
    const id = window.setTimeout(onClose, 4000)
    return () => window.clearTimeout(id)
  }, [player, onClose])

  return (
    <AnimatePresence>
      {player && (
        <m.div
          className="fixed inset-0 z-50 grid place-items-center bg-canvas/85 px-8 backdrop-blur-md"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          onClick={onClose}
          role="status"
        >
          {!reduced && <Shockwave color={rankColor(player.title)} />}
          <m.div
            className="relative flex flex-col items-center text-center"
            initial={{ scale: 0.7, y: 12, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 180, damping: 14 }}
          >
            {!reduced && <Sparks color={rankColor(player.title)} />}
            <LevelBadge level={player.level} title={player.title} size={132} glow />
            <p className="mt-6 text-[12px] font-semibold tracking-[0.24em] text-ink-muted uppercase">Subiu de nível</p>
            <p className="mt-1 text-[40px] leading-none font-semibold tracking-[-0.03em]">Nível {player.level}</p>
            <p className="mt-2 text-[17px] font-semibold tracking-wide" style={{ color: rankColor(player.title) }}>
              {player.title}
            </p>
            <p className="mt-4 text-[14px] text-ink-muted">
              {player.max_level
                ? 'Nível máximo. Nada mal.'
                : `Faltam ${player.to_next.toLocaleString('pt-BR')} XP para o nível ${player.level + 1}.`}
            </p>
            <p className="mt-8 text-[12px] text-ink-faint">Toque para continuar</p>
          </m.div>
        </m.div>
      )}
    </AnimatePresence>
  )
}

/** Anéis de choque saindo do emblema. */
function Shockwave({ color }: { color: string }) {
  return (
    <div className="pointer-events-none absolute inset-0 grid place-items-center" aria-hidden>
      {[0, 0.25, 0.5].map((delay, i) => (
        <m.span
          key={i}
          className="absolute size-40 rounded-full border-2"
          style={{ borderColor: color }}
          initial={{ opacity: 0.55, scale: 0.35 }}
          animate={{ opacity: 0, scale: 3.2 }}
          transition={{ duration: 1.6, delay, ease: 'easeOut' }}
        />
      ))}
      <m.span
        className="absolute size-72 rounded-full blur-3xl"
        style={{ background: color }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.22 }}
        transition={{ duration: 0.7 }}
      />
    </div>
  )
}

/** Doze faíscas saindo do centro. Puro enfeite — escondido com reduced motion. */
function Sparks({ color }: { color: string }) {
  return (
    <div className="pointer-events-none absolute inset-0 grid place-items-center" aria-hidden>
      {Array.from({ length: 12 }, (_, i) => (
        <m.span
          key={i}
          className="absolute size-1.5 rounded-full"
          style={{ background: color }}
          initial={{ opacity: 1, x: 0, y: 0, scale: 1 }}
          animate={{
            opacity: 0,
            scale: 0.4,
            x: Math.cos((i / 12) * Math.PI * 2) * 150,
            y: Math.sin((i / 12) * Math.PI * 2) * 150,
          }}
          transition={{ duration: 1.1, delay: 0.1 + (i % 4) * 0.05, ease: 'easeOut' }}
        />
      ))}
    </div>
  )
}
