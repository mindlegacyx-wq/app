import { AnimatePresence, m } from 'motion/react'
import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

interface SheetProps {
  open: boolean
  title?: string
  onClose: () => void
  children: ReactNode
}

/** Bottom sheet para formulários de edição. Esc fecha; toque fora fecha. */
export function Sheet({ open, title, onClose, children }: SheetProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  return createPortal(
    <AnimatePresence>
      {open && (
        <m.div
          className="fixed inset-0 z-40 flex items-end justify-center bg-black/60 backdrop-blur-sm"
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
            className="safe-bottom w-full max-w-lg rounded-t-xl border-t border-line bg-surface shadow-sheet"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ duration: 0.28, ease: [0.25, 1, 0.5, 1] }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-white/15" />
            {title && <h2 className="px-5 pt-4 text-[17px] font-semibold">{title}</h2>}
            <div className="max-h-[80dvh] overflow-y-auto px-5 pt-3 pb-5">{children}</div>
          </m.div>
        </m.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
