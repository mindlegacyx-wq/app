/**
 * Pilha de camadas sobrepostas (sheets e diálogos).
 * Esc fecha só a camada de cima; Enter confirma só o diálogo de cima.
 */

import { useEffect, useRef } from 'react'

interface Layer {
  onEscape: () => void
  onEnter?: () => void
}

const stack: Layer[] = []
let listening = false

function ensureListener() {
  if (listening) return
  listening = true
  window.addEventListener('keydown', (e: KeyboardEvent) => {
    const top = stack.at(-1)
    if (!top) return
    if (e.key === 'Escape') {
      e.preventDefault()
      top.onEscape()
    } else if (e.key === 'Enter' && top.onEnter) {
      const target = e.target as HTMLElement | null
      // Enter dentro de textarea ou botão tem o comportamento normal.
      if (target && (target.tagName === 'TEXTAREA' || target.tagName === 'BUTTON')) return
      e.preventDefault()
      top.onEnter()
    }
  })
}

export function useLayer(open: boolean, onEscape: () => void, onEnter?: () => void) {
  const latest = useRef<Layer>({ onEscape, onEnter })
  latest.current = { onEscape, onEnter }

  useEffect(() => {
    if (!open) return
    ensureListener()
    const layer: Layer = {
      onEscape: () => latest.current.onEscape(),
      onEnter: onEnter ? () => latest.current.onEnter?.() : undefined,
    }
    stack.push(layer)
    return () => {
      const i = stack.indexOf(layer)
      if (i >= 0) stack.splice(i, 1)
    }
    // onEnter só define se a camada aceita Enter; a função em si vem do ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, Boolean(onEnter)])
}
