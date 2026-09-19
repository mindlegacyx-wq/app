import { AnimatePresence, m } from 'motion/react'
import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

import { Button } from './Button'

interface DialogProps {
  open: boolean
  title: string
  description?: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
  loading?: boolean
  onConfirm: () => void
  onCancel: () => void
}

/**
 * Diálogo de confirmação próprio (nunca `window.confirm`).
 * Enter confirma, Esc cancela.
 */
export function Dialog({
  open,
  title,
  description,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  danger = false,
  loading = false,
  onConfirm,
  onCancel,
}: DialogProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
      if (e.key === 'Enter' && !loading) onConfirm()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, loading, onCancel, onConfirm])

  return createPortal(
    <AnimatePresence>
      {open && (
        <m.div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 backdrop-blur-sm sm:items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={onCancel}
        >
          <m.div
            role="alertdialog"
            aria-modal
            aria-labelledby="dlg-title"
            className="w-full max-w-sm rounded-xl border border-line bg-surface p-5 shadow-sheet"
            initial={{ y: 24, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 16, opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.22, ease: [0.25, 1, 0.5, 1] }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="dlg-title" className="text-[17px] font-semibold">
              {title}
            </h2>
            {description && <div className="mt-1.5 text-[14px] leading-relaxed text-ink-muted">{description}</div>}
            <div className="mt-5 flex gap-2">
              <Button variant="secondary" full onClick={onCancel} disabled={loading}>
                {cancelLabel}
              </Button>
              <Button variant={danger ? 'danger' : 'primary'} full onClick={onConfirm} loading={loading} autoFocus>
                {confirmLabel}
              </Button>
            </div>
          </m.div>
        </m.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
