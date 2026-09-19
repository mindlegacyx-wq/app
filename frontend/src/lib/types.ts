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
export type AlarmSound = 'classic' | 'soft' | 'pulse'

export interface Alarm {
  id: string
  label: string
  time: string // "HH:MM:SS"
  days_of_week: number[]
  sound: AlarmSound
  requires_confirmation: boolean
  max_snoozes: number
  snooze_minutes: number
  is_active: boolean
  next_ring_at: string | null // ISO UTC
  created_at: string
}

export interface NextRing {
  alarm_id: string
  label: string
  at: string
  sound: AlarmSound
}

export interface AlarmsOverview {
  alarms: Alarm[]
  next: NextRing | null
  push_enabled: boolean
}

export interface WakeAlarm {
  id: string
  label: string
  sound: AlarmSound
  requires_confirmation: boolean
  max_snoozes: number
  snooze_minutes: number
}

export interface WakeDay {
  date: string
  scheduled_time: string | null
  scheduled_at: string | null
  rang_at: string | null
  next_ring_at: string | null
  confirmed_at: string | null
  delay_minutes: number | null
  snooze_count: number
  status: WakeStatus | null
  alarm: WakeAlarm | null
  ringing: boolean
  can_snooze: boolean
  can_confirm: boolean
  can_undo: boolean
}

export interface WakeHistoryDay {
  date: string
  label: string | null
  scheduled_at: string | null
  rang_at: string | null
  confirmed_at: string | null
  delay_minutes: number | null
  snooze_count: number
  status: WakeStatus
}

export interface WakeHistory {
  start: string
  end: string
  days: WakeHistoryDay[]
  confirmed: number
  missed: number
  average_delay_minutes: number | null
}

export interface PushStatus {
  enabled: boolean
  public_key: string | null
  subscriptions: number
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

// --- Evolução ----------------------------------------------------------------------------

export type ScoreComponent = 'wake' | 'routines' | 'tasks' | 'workout' | 'goals'

export interface DayScore {
  date: string
  planned: number
  completed: number
  pct: number
  target: number
  hit_target: boolean
  streak: number
  best_streak: number
  breakdown: Record<ScoreComponent, { planned: number; completed: number }>
  missing: { kind: ScoreComponent; title: string }[]
  is_open: boolean
  closed_at: string | null
  closed_by: 'user' | 'system' | null
  finalized: boolean
  can_close: boolean
  can_reopen: boolean
}

// --- Metas -------------------------------------------------------------------------------

export type GoalArea = 'health' | 'career' | 'finance' | 'study' | 'personal' | 'other'
export type GoalStatus = 'active' | 'completed' | 'archived'

export interface GoalAction {
  id: string
  goal_id: string
  title: string
  due_date: string | null
  is_done: boolean
  done_at: string | null
  sort_order: number
}

export interface Goal {
  id: string
  title: string
  description: string | null
  area: GoalArea
  deadline: string | null
  status: GoalStatus
  completed_at: string | null
  sort_order: number
  actions: GoalAction[]
  actions_total: number
  actions_done: number
  progress_pct: number
}

export interface GoalIn {
  title: string
  description?: string | null
  area?: GoalArea
  deadline?: string | null
}

export interface GoalUpdate {
  title?: string
  description?: string | null
  clear_description?: boolean
  area?: GoalArea
  deadline?: string | null
  clear_deadline?: boolean
  status?: GoalStatus
}

export interface DayGoalAction {
  id: string
  goal_id: string
  goal_title: string
  title: string
  due_date: string
  is_done: boolean
  done_at: string | null
}

export interface GoalsDay {
  date: string
  actions: DayGoalAction[]
  overdue: DayGoalAction[]
  planned: number
  completed: number
}

// --- Treinos -----------------------------------------------------------------------------

export type SessionStatus = 'in_progress' | 'completed' | 'skipped'

export interface Exercise {
  id: string
  name: string
  sets: number | null
  reps: string | null
  load: string | null
  rest_seconds: number | null
  sort_order: number
}

export interface Workout {
  id: string
  name: string
  days_of_week: number[]
  notes: string | null
  is_active: boolean
  sort_order: number
  exercises: Exercise[]
}

export interface WorkoutSession {
  id: string
  workout_id: string
  date: string
  status: SessionStatus
  started_at: string | null
  completed_at: string | null
  notes: string | null
}

export interface DayExercise extends Omit<Exercise, 'sort_order'> {
  completed: boolean
}

export interface DayWorkout {
  workout_id: string
  name: string
  exercises: DayExercise[]
  exercises_done: number
  session: WorkoutSession | null
}

export interface WorkoutsDay {
  date: string
  workouts: DayWorkout[]
  planned: number
  completed: number
}

export interface WorkoutHistoryItem {
  date: string
  workout_id: string
  workout_name: string
  status: SessionStatus
  exercises_done: number
  exercises_total: number
}

export interface WorkoutHistory {
  start: string
  end: string
  items: WorkoutHistoryItem[]
}
