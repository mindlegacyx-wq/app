import { useReducedMotion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'

/**
 * Número que conta até o valor. Usado no percentual do dia: ver 0 → 67 subindo dá a sensação
 * de "o número é seu". Respeita reduced motion (aí o valor aparece direto).
 */
export function CountUp({
  value,
  duration = 700,
  decimals = 0,
}: {
  value: number
  duration?: number
  /** Casas decimais (notas usam 1 ou 2; percentuais, nenhuma). */
  decimals?: number
}) {
  const reduced = useReducedMotion()
  const [shown, setShown] = useState(reduced ? value : 0)
  const from = useRef(0)

  useEffect(() => {
    if (reduced) {
      setShown(value)
      return
    }
    const start = performance.now()
    const origin = from.current
    let raf = 0
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - t, 4) // ease-out-quart, igual ao resto do app
      const step = origin + (value - origin) * eased
      setShown(decimals > 0 ? Number(step.toFixed(decimals)) : Math.round(step))
      if (t < 1) raf = requestAnimationFrame(tick)
      else from.current = value
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value, duration, reduced, decimals])

  return (
    <>
      {decimals > 0
        ? shown.toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
        : shown}
    </>
  )
}
