import { useOffline } from '@/lib/offline-queue'

/** Faixa discreta no topo: sem conexão e/ou ações aguardando envio. */
export function OfflineBanner() {
  const online = useOffline((s) => s.online)
  const pending = useOffline((s) => s.items.length)
  const flushing = useOffline((s) => s.flushing)
  if (online && pending === 0) return null
  const text = !online
    ? pending > 0
      ? `Sem conexão · ${pending} ${pending === 1 ? 'ação pendente' : 'ações pendentes'}`
      : 'Sem conexão · você pode continuar marcando'
    : flushing
      ? `Enviando ${pending} ${pending === 1 ? 'ação' : 'ações'}…`
      : `${pending} ${pending === 1 ? 'ação pendente' : 'ações pendentes'}`
  return (
    <div role="status" className="safe-top sticky top-0 z-40 bg-warning/15 text-center text-[12px] font-semibold text-warning backdrop-blur-md">
      <p className="px-4 py-1.5">{text}</p>
    </div>
  )
}
