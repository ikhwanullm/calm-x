export interface DeadlineItem {
  id: number
  type: "project" | "task"
  title: string
  deadline: string   // YYYY-MM-DD
  is_overdue: boolean
  item_id: number | null
}

export interface ProjectSummary {
  id: number
  title: string
  task_count: number
  completed_task_count: number
  progress_percentage: number
  project_deadline: string | null
}

export interface DashboardData {
  inbox_count: number
  active_projects_count: number
  active_task_count: number
  areas_count: number
  area_task_count: number
  resources_count: number
  archives_count: number
  overall_progress: number | null
  upcoming_deadlines: DeadlineItem[]
  active_projects: ProjectSummary[]
  last_review_date: string | null
}
