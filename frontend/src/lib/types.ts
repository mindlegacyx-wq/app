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

// --- Rotinas -----------------------------------------------------------------------------

export type RoutineKind = 'morning' | 'evening' | 'custom'

export interface RoutineItem {
  id: string
  title: string
  duration_minutes: number | null
  sort_order: number
  is_active: boolean
}

export interface Routine {
  id: string
  name: string
  kind: RoutineKind
  start_time: string | null // "HH:MM:SS"
  days_of_week: number[] // 0 = segunda … 6 = domingo
  is_active: boolean
  sort_order: number
  items: RoutineItem[]
}

export interface RoutineIn {
  name: string
  kind?: RoutineKind
  start_time?: string | null
  days_of_week?: number[]
}

export interface DayItem {
  id: string
  title: string
  duration_minutes: number | null
  completed_at: string | null
}

export interface DayRoutine {
  id: string
  name: string
  kind: RoutineKind
  start_time: string | null
  items: DayItem[]
  planned: number
  completed: number
}

export interface RoutinesDay {
  date: string
  routines: DayRoutine[]
  planned: number
  completed: number
}

// --- Acordar -----------------------------------------------------------------------------

export type WakeStatus = 'pending' | 'confirmed' | 'missed' | 'manual'

export interface WakeDay {
  date: string
  scheduled_time: string | null
  scheduled_at: string | null
  confirmed_at: string | null
  delay_minutes: number | null
  status: WakeStatus | null
  can_undo: boolean
}

// --- Tarefas -----------------------------------------------------------------------------

export type TaskPriority = 'low' | 'medium' | 'high'
export type TaskStatus = 'pending' | 'done' | 'cancelled'

export interface TaskCategory {
  id: string
  name: string
  color: string
  sort_order: number
}

export interface Task {
  id: string
  title: string
  notes: string | null
  date: string
  priority: TaskPriority
  status: TaskStatus
  category_id: string | null
  completed_at: string | null
  sort_order: number
}

export interface TaskIn {
  title: string
  notes?: string | null
  date?: string
  priority?: TaskPriority
  category_id?: string | null
}

export interface TaskUpdate {
  title?: string
  notes?: string | null
  date?: string
  priority?: TaskPriority
  category_id?: string | null
  status?: TaskStatus
  clear_category?: boolean
  clear_notes?: boolean
}

export interface TasksDay {
  date: string
  tasks: Task[]
  overdue: Task[]
  planned: number
  completed: number
}
