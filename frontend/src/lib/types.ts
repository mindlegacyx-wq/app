/** Contratos da API (espelham os schemas Pydantic do backend). */

export interface UserSettings {
  discipline_target: number
  week_starts_on: number
  notifications_enabled: boolean
  wake_time: string | null // "HH:MM:SS"
  onboarding_completed_at: string | null
}

export interface User {
  id: string
  email: string
  name: string
  timezone: string
  created_at: string
  settings: UserSettings
}

export interface TokenResponse {
  access_token: string
  token_type: 'bearer'
  expires_in: number
  user: User
}

export interface Session {
  id: string
  user_agent: string | null
  ip: string | null
  created_at: string
  last_used_at: string | null
  expires_at: string
  is_current: boolean
}

export interface ApiErrorBody {
  error: {
    code: string
    message: string
    details: Record<string, unknown> & { fields?: { field: string; message: string }[] }
  }
}
