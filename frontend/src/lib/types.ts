/** Contratos da API (espelham os schemas Pydantic do backend). */

export interface UserSettings {
  discipline_target: number
  week_starts_on: number
  notifications_enabled: boolean
  wake_time: string | null // "HH:MM:SS"
  onboarding_completed_at: string | null
  passing_grade: number // média mínima da escola (Fase 11)
  periods_per_year: number // 2 = semestres · 3 = trimestres · 4 = bimestres
  grade_max: number // topo da escala (10 ou 100)
}

export interface User {
  id: string
  email: string
  name: string
  timezone: string
  created_at: string
  settings: UserSettings
}

export interface SignupPolicy {
  invite_required: boolean
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

export type ScoreComponent = 'wake' | 'routines' | 'tasks' | 'workout' | 'goals' | 'study'

export interface DayScore {
  date: string
  planned: number
  completed: number
  pct: number
  target: number
  hit_target: boolean
  streak: number
  best_streak: number
  xp: number
  breakdown: Record<ScoreComponent, { planned: number; completed: number }>
  missing: { kind: ScoreComponent; title: string }[]
  is_open: boolean
  closed_at: string | null
  closed_by: 'user' | 'system' | null
  finalized: boolean
  can_close: boolean
  can_reopen: boolean
}

/** Estado do jogador (Fase 13): nível, patente e XP. */
export interface Player {
  level: number
  title: string
  total_xp: number
  into_level: number
  level_span: number
  to_next: number
  xp_today: number
  max_level: boolean
}

// --- Liga (Fase 14) ----------------------------------------------------------------------

export type Tier = 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond'
export type LeagueOutcome = 'promoted' | 'stayed' | 'relegated'

export interface LeagueMember {
  key: string
  name: string
  is_bot: boolean
  tagline: string | null
  xp: number
  rank: number
  is_you: boolean
}

export interface LeagueResult {
  week_start: string
  tier: Tier
  rank: number
  xp: number
  outcome: LeagueOutcome
  next_tier: Tier
  seen: boolean
}

export interface League {
  tier: Tier
  week_start: string
  week_end: string
  days_left: number
  members: LeagueMember[]
  your_rank: number
  your_xp: number
  promotion_slots: number
  relegation_slots: number
  can_promote: boolean
  can_relegate: boolean
  to_next_rank: number | null
  last_result: LeagueResult | null
}

export interface HistoryDay {
  date: string
  planned: number
  completed: number
  pct: number
  target: number
  hit_target: boolean
  streak: number
  closed_by: 'user' | 'system' | null
  finalized: boolean
  live: boolean
}

export interface ProgressHistory {
  start: string
  end: string
  first_day: string
  days: HistoryDay[]
}

export interface AreaStat {
  kind: ScoreComponent
  planned: number
  completed: number
  pct: number | null
}

export interface WindowStat {
  days: number
  tracked: number
  average_pct: number | null
  hit_days: number
}

export interface ProgressSummary {
  today: string
  first_day: string
  streak: number
  streak_before_today: number
  best_streak: number
  today_hit: boolean
  week: WindowStat
  month: WindowStat
  areas: AreaStat[]
  closed_days: number
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

// --- Agenda semanal (Fase 9) -------------------------------------------------------------

export type BlockKind = 'class' | 'workout' | 'study' | 'other'

export interface Subject {
  id: string
  name: string
  color: string
  teacher: string | null
  is_active: boolean
  sort_order: number
}

export interface ScheduleBlock {
  id: string
  title: string
  kind: BlockKind
  subject_id: string | null
  subject_name: string | null
  subject_color: string | null
  workout_id: string | null
  weekday: number
  start_time: string // "HH:MM:SS"
  end_time: string
  duration_minutes: number
  location: string | null
  is_active: boolean
}

export interface ScheduleWeek {
  days: { weekday: number; blocks: ScheduleBlock[]; total_minutes: number }[]
  subjects: Subject[]
}

export interface ScheduleDay {
  date: string
  weekday: number
  blocks: ScheduleBlock[]
  free: { start: string; end: string; minutes: number }[]
}

// --- Provas, trabalhos e sessões de estudo (Fase 10) ------------------------------------

export type ExamKind = 'exam' | 'assignment'
export type ExamStatus = 'open' | 'done'
export type StudySessionStatus = 'in_progress' | 'completed' | 'skipped'

export interface ExamTopic {
  id: string
  exam_id: string
  title: string
  is_done: boolean
  sort_order: number
}

export interface Exam {
  id: string
  title: string
  kind: ExamKind
  subject_id: string | null
  subject_name: string | null
  subject_color: string | null
  date: string
  lead_days: number
  minutes_per_day: number
  notes: string | null
  status: ExamStatus
  done_at: string | null
  days_until: number
  study_from: string
  sessions_total: number
  sessions_done: number
  topics_total: number
  topics_done: number
  topics: ExamTopic[]
}

export interface StudySession {
  id: string | null // null = planejada, ainda sem registro
  exam_id: string
  exam_title: string
  exam_kind: ExamKind
  exam_date: string
  subject_name: string | null
  subject_color: string | null
  date: string
  status: StudySessionStatus | null
  planned_minutes: number
  focused_seconds: number
  started_at: string | null
  completed_at: string | null
  suggested_start: string | null
  suggested_end: string | null
  topics_total: number
  topics_done: number
}

export interface ExamDetail extends Exam {
  sessions: StudySession[]
}

export interface StudyDay {
  date: string
  sessions: StudySession[]
  planned: number
  completed: number
  total_minutes: number
}

// --- Notas (Fase 11) --------------------------------------------------------------------

export interface Grade {
  id: string
  subject_id: string
  exam_id: string | null
  year: number
  period: number
  title: string | null
  value: number
  weight: number
}

export interface PeriodGrades {
  period: number
  grades: Grade[]
  average: number | null
}

export type SubjectGradeStatus = 'approved' | 'on_track' | 'at_risk' | 'failing' | 'no_grades' | 'closed_failed'

export interface SubjectGrades {
  subject_id: string
  name: string
  color: string
  periods: PeriodGrades[]
  year_average: number | null
  projected_final: number | null
  remaining_periods: number
  needed_average: number | null
  status: SubjectGradeStatus
}

export interface GradesSummary {
  year: number
  years: number[]
  passing_grade: number
  periods_per_year: number
  grade_max: number
  subjects: SubjectGrades[]
}

// --- Estudos com IA (Fase 12) ---------------------------------------------------------------

export type MaterialSource = 'photo' | 'text'
export type ArtifactKind = 'theory' | 'solutions' | 'mindmap' | 'quiz'
export type ArtifactStatus = 'queued' | 'running' | 'done' | 'failed'

export interface AIStatus {
  configured: boolean
  model: string | null
  vision_model: string | null
}

export interface StudyMaterial {
  id: string
  exam_id: string
  title: string | null
  source: MaterialSource
  content: string
  created_at: string
  updated_at: string
}

export interface MindMapNode {
  title: string
  note?: string
  children: MindMapNode[]
}

export interface QuizQuestion {
  question: string
  options: string[]
  answer: number
  explanation: string
}

export interface StudyArtifact {
  kind: ArtifactKind
  status: ArtifactStatus
  content_md: string | null
  content_json: MindMapNode | { questions: QuizQuestion[] } | null
  error: string | null
  model: string | null
  stale: boolean
  updated_at: string | null
}

export interface ExamAI {
  configured: boolean
  materials: StudyMaterial[]
  artifacts: StudyArtifact[]
  can_generate: boolean
}
