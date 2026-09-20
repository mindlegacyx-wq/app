import { AnimatePresence, m, useReducedMotion } from 'motion/react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'

import { buzz } from '@/lib/sound'
import type { Achievement } from '@/lib/types'

import { useLeague } from '@/features/league/api'

import { useAchievements, useMarkAchievementsSeen } from './api'
import { BadgeIcon } from './BadgeIcon'
import { familyColor } from './shared'

/**
 * Aviso de selo novo. Sobe do rodapé, fica alguns segundos e some.
 *
 * O "já vi" fica no servidor, então o mesmo selo não aparece de novo em outro aparelho.
 * Vários de uma vez entram em fila, um a um.
 */
export function AchievementToast() {
  const { data } = useAchievements()
  const league = useLeague()
  const seen = useMarkAchievementsSeen()
  // A tela de resultado da liga ocupa a tela inteira: os selos esperam a vez deles. Enquanto
  // a liga ainda está carregando também se espera — senão o selo aparece e some por baixo dela.
  const blocked = league.isPending || (!!league.data?.last_result && !league.data.last_result.seen)
  const navigate = useNavigate()
  const reduced = useReducedMotion()
  const [current, setCurrent] = useState<Achievement | null>(null)
  const [summary, setSummary] = useState(false)
  const pending = (data?.items ?? []).filter((i) => i.unlocked && !i.seen)

  useEffect(() => {
    if (blocked || current || !pending[0]) return
    // Três ou mais de uma vez (importar histórico, por exemplo) viram um aviso só: uma fila de
    // dez cartões seguidos vira barulho, não recompensa.
    if (pending.length >= 3) {
      setSummary(true)
      setCurrent({ ...pending[0], name: `${pending.length} conquistas desbloqueadas`, hint: 'Toque para ver todas' })
    } else {
      setSummary(false)
      setCurrent(pending[0])
    }
  }, [blocked, current, pending])

  useEffect(() => {
    if (!current) return
    buzz([10, 40, 14])
    const id = window.setTimeout(() => {
      setCurrent(null)
      if (summary || pending.length <= 1) seen.mutate()
    }, 4200)
    return () => window.clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.key, current?.name])

  const color = current ? familyColor(current.family) : undefined

  return (
    <AnimatePresence>
      {current && (
        <m.button
          type="button"
          onClick={() => {
            setCurrent(null)
            seen.mutate()
            navigate('/conquistas')
          }}
          className="safe-bottom fixed inset-x-0 bottom-16 z-40 mx-auto flex w-[calc(100%-2rem)] max-w-sm items-center gap-3 rounded-lg border border-line-strong bg-elevated px-4 py-3 text-left shadow-sheet"
          initial={{ y: 60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 40, opacity: 0 }}
          transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 260, damping: 26 }}
        >
          <span
            className="grid size-11 shrink-0 place-items-center rounded-full"
            style={{ background: `${color}22`, color, boxShadow: `0 0 18px -6px ${color}` }}
          >
            <BadgeIcon icon={current.icon} className="size-6" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[11px] font-semibold tracking-[0.16em] uppercase" style={{ color }}>
              Conquista desbloqueada
            </span>
            <span className="block truncate text-[15px] font-semibold">{current.name}</span>
            <span className="block truncate text-[12px] text-ink-faint">{current.hint}</span>
          </span>
        </m.button>
      )}
    </AnimatePresence>
  )
}
