import { MutationCache, QueryClient } from '@tanstack/react-query'
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { domMax, LazyMotion, MotionConfig } from 'motion/react'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router'
import { registerSW } from 'virtual:pwa-register'

import { router } from './app/router'
import './index.css'
import { flushOfflineQueue, onSessionChange } from './lib/api'
import { useAuth } from './lib/auth-store'
import { useOffline } from './lib/offline-queue'

const queryClient: QueryClient = new QueryClient({
  defaultOptions: {
    // gcTime alto para o cache persistido sobreviver ao fechar o app (leitura offline).
    queries: { staleTime: 30_000, gcTime: 24 * 60 * 60_000, retry: 1, refetchOnWindowFocus: true },
  },
  // Qualquer mudança (check, tarefa, acordar, fechar) pode alterar o percentual do dia —
  // e, com ele, o XP do jogador. Invalidar aqui é o que faz a barra subir na hora.
  mutationCache: new MutationCache({
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['progress'] })
      void queryClient.invalidateQueries({ queryKey: ['player'] })
      void queryClient.invalidateQueries({ queryKey: ['league'] })
      void queryClient.invalidateQueries({ queryKey: ['achievements'] })
    },
  }),
})

// Último estado conhecido fica no aparelho: Hoje abre mesmo sem rede.
const persister = createSyncStoragePersister({
  storage: typeof window !== 'undefined' ? window.localStorage : null,
  key: 'disciplina.query-cache',
  throttleTime: 1000,
})

// Sair da conta limpa tudo que estava em cache neste aparelho.
onSessionChange(({ token }) => {
  if (!token) {
    queryClient.clear()
    void persister.removeClient()
  }
})

// Fila offline: reenvia ao voltar a conexão e ao abrir o app.
async function syncQueue() {
  const sent = await flushOfflineQueue()
  if (sent > 0) await queryClient.invalidateQueries()
}
window.addEventListener('online', () => {
  useOffline.getState().setOnline(true)
  void syncQueue()
})
window.addEventListener('offline', () => useOffline.getState().setOnline(false))

registerSW({ immediate: true })

void useAuth
  .getState()
  .bootstrap()
  .then(() => syncQueue())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* domMax e não domAnimation: é o pacote que traz arrastar (notas por área) e as
        animações de reposição, que o domAnimation não inclui. */}
    <LazyMotion features={domMax}>
      <MotionConfig reducedMotion="user">
        <PersistQueryClientProvider
          client={queryClient}
          persistOptions={{
            persister,
            maxAge: 24 * 60 * 60_000,
            buster: __APP_VERSION__,
            dehydrateOptions: { shouldDehydrateQuery: (q) => q.state.status === 'success' },
          }}
        >
          <RouterProvider router={router} />
        </PersistQueryClientProvider>
      </MotionConfig>
    </LazyMotion>
  </StrictMode>,
)
