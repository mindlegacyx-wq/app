import { create } from 'zustand'

import { api, onSessionChange, refreshSession, setSession } from './api'
import type { TokenResponse, User } from './types'

type Status = 'booting' | 'anon' | 'authed'

interface AuthState {
  status: Status
  user: User | null
  bootstrap: () => Promise<void>
  login: (email: string, password: string) => Promise<User>
  register: (name: string, email: string, password: string) => Promise<User>
  logout: () => Promise<void>
  setUser: (user: User) => void
}

export const useAuth = create<AuthState>((set) => {
  onSessionChange(({ token, user }) => {
    if (!token) set({ status: 'anon', user: null })
    else if (user) set({ status: 'authed', user })
  })

  return {
    status: 'booting',
    user: null,

    async bootstrap() {
      const ok = await refreshSession()
      if (!ok) set({ status: 'anon', user: null })
    },

    async login(email, password) {
      const data = await api<TokenResponse>('/auth/login', {
        method: 'POST',
        body: { email, password },
        auth: false,
      })
      setSession(data)
      return data.user
    },

    async register(name, email, password) {
      const data = await api<TokenResponse>('/auth/register', {
        method: 'POST',
        body: { name, email, password },
        auth: false,
      })
      setSession(data)
      return data.user
    },

    async logout() {
      try {
        await api<void>('/auth/logout', { method: 'POST', auth: false })
      } finally {
        setSession(null)
      }
    },

    setUser(user) {
      set({ user })
    },
  }
})

export const isOnboarded = (u: User | null) => Boolean(u?.settings.onboarding_completed_at)
