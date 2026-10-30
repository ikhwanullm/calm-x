export interface MeetingToProcess {
  id: number
  title: string
  held_at: string            // ISO datetime (UTC)
  item_id: number
  item_title: string
  item_type: string
  open_action_count: number
}

export interface StaleWaiting {
  id: number
  title: string
  waiting_for: string
  waiting_days: number
  item_id: number | null
  item_title: string | null
  item_type: string | null   // "project" | "area" | null (Inbox)
}

export type AttentionReason = "overdue_tasks" | "deadline_passed" | "deadline_soon" | "stale" | "no_open_tasks"

export interface AttentionProject {
  id: number
  title: string
  reasons: AttentionReason[]
  overdue_task_count: number
  open_task_count: number
  progress_percentage: number
  project_deadline: string | null
  days_inactive: number
}

export interface DashboardCounts {
  active_projects: number
  areas: number
  resources: number
  archived: number
  someday: number
}

export interface DashboardData {
  inbox_count: number
  last_review_date: string | null
  days_since_review: number | null
  meetings_to_process: MeetingToProcess[]
  stale_waiting: StaleWaiting[]
  stale_waiting_total: number
  attention_projects: AttentionProject[]
  counts: DashboardCounts
}
