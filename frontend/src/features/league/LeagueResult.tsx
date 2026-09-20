import { AnimatePresence, m, useReducedMotion } from 'motion/react'
import { useEffect, useState } from 'react'

import { Button } from '@/components/ui'
import { buzz, levelUpSound } from '@/lib/sound'
import type { LeagueResult } from '@/lib/types'

import { useLeague, useMarkResultSeen } from './api'
import { tierLabel } from './shared'
import { TierShield } from './TierShield'

/**
 * Resultado da semana que acabou. Aparece uma vez (o servidor guarda que já foi visto),
 * na primeira vez que o app abre depois da virada de segunda-feira.
 */
export function LeagueResultOverlay() {
  const { data } = useLeague()
  const seen = useMarkResultSeen()
  const reduced = useReducedMotion()
  const [dismissed, setDismissed] = useState(false)
  const result = data?.last_result
  const show = !!result && !result.seen && !dismissed

  useEffect(() => {
    if (show && result?.outcome === 'promoted') {
      levelUpSound()
      buzz([18, 60, 26])
    }
  }, [show, result?.outcome])

  function close() {
    setDismissed(true)
    seen.mutate()
  }

  return (
    <AnimatePresence>
      {show && result && (
        <m.div
          className="fixed inset-0 z-50 grid place-items-center bg-canvas/90 px-8 backdrop-blur-md"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="status"
        >
          <m.div
            className="flex w-full max-w-xs flex-col items-center text-center"
            initial={{ scale: 0.8, y: 14, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 170, damping: 15 }}
          >
            <TierShield tier={result.next_tier} size={104} />
            <p className="mt-6 text-[12px] font-semibold tracking-[0.24em] text-ink-muted uppercase">Semana encerrada</p>
            <p className="mt-2 text-[30px] leading-tight font-semibold tracking-[-0.03em]">{headline(result)}</p>
            <p className="mt-2 text-[15px] leading-relaxed text-ink-muted">{detail(result)}</p>
            <div className="mt-6 flex w-full items-center justify-center gap-6 rounded-lg border border-line px-4 py-3">
              <Stat label="Lugar" value={`${result.rank}º`} />
              <span className="h-8 w-px bg-line" />
              <Stat label="XP na semana" value={result.xp.toLocaleString('pt-BR')} />
            </div>
            <Button className="mt-7" size="lg" full onClick={close}>
              Bora para a nova semana
            </Button>
          </m.div>
        </m.div>
      )}
    </AnimatePresence>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[20px] leading-none font-semibold tabular-nums">{value}</p>
      <p className="mt-1 text-[11px] text-ink-faint">{label}</p>
    </div>
  )
}

function headline(r: LeagueResult): string {
  if (r.outcome === 'promoted') return `Subiu para ${tierLabel(r.next_tier)}!`
  if (r.outcome === 'relegated') return `Caiu para ${tierLabel(r.next_tier)}`
  return `Segue no ${tierLabel(r.next_tier)}`
}

function detail(r: LeagueResult): string {
  if (r.outcome === 'promoted') return `Você fechou em ${r.rank}º na ${tierLabel(r.tier)}. Divisão nova, robôs mais duros.`
  if (r.outcome === 'relegated') return `Terminou em ${r.rank}º. Semana nova, adversários mais tranquilos — dá para voltar.`
  return `Terminou em ${r.rank}º na ${tierLabel(r.tier)}. Nem subiu, nem caiu.`
}
