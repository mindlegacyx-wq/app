import { AnimatePresence, m } from 'motion/react'
import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

import { useIsDesktop } from '@/lib/media'

import { useLayer } from './layer-stack'

interface SheetProps {
  open: boolean
  title?: string
  onClose: () => void
  children: ReactNode
}

/**
 * Formulário em camada. No celular sobe de baixo (bottom sheet, o polegar alcança); no PC
 * abre como uma janela no meio da tela. Esc fecha; clique fora fecha.
 */
export function Sheet({ open, title, onClose, children }: SheetProps) {
  const desktop = useIsDesktop()
  useLayer(open, onClose)
  useEffect(() => {
    if (!open) return
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  return createPortal(
    <AnimatePresence>
      {open && (
        <m.div
          className="fixed inset-0 z-40 flex items-end justify-center bg-black/60 backdrop-blur-sm lg:items-center lg:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={onClose}
        >
          <m.div
            role="dialog"
            aria-modal
            aria-label={title}
            className="safe-bottom w-full max-w-lg rounded-t-xl border-t border-line bg-surface shadow-sheet lg:max-w-md lg:rounded-xl lg:border"
            initial={desktop ? { opacity: 0, scale: 0.96 } : { y: '100%' }}
            animate={desktop ? { opacity: 1, scale: 1 } : { y: 0 }}
            exit={desktop ? { opacity: 0, scale: 0.98 } : { y: '100%' }}
            transition={{ duration: desktop ? 0.18 : 0.28, ease: [0.25, 1, 0.5, 1] }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* A alcinha é gesto de celular; no PC a janela fecha no X do fundo ou no Esc. */}
            <div className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-white/15 lg:hidden" />
            {title && <h2 className="px-5 pt-4 text-[17px] font-semibold lg:pt-5">{title}</h2>}
            <div className="max-h-[80dvh] overflow-y-auto px-5 pt-3 pb-5 lg:max-h-[75dvh]">{children}</div>
          </m.div>
        </m.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
