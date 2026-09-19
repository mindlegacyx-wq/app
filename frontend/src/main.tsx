import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { domAnimation, LazyMotion } from 'motion/react'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router'
import { registerSW } from 'virtual:pwa-register'

import { router } from './app/router'
import './index.css'
import { useAuth } from './lib/auth-store'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: true },
  },
})

registerSW({ immediate: true })

void useAuth.getState().bootstrap()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LazyMotion features={domAnimation}>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </LazyMotion>
  </StrictMode>,
)
