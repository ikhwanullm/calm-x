import { apiClient } from './client'

export interface ReviewStatus {
  last_review_date: string | null
  last_review_days_ago: number | null
}

export interface ReviewTaskItem {
  id: number
  title: string
  description: string
  priority: string
  created_at: string
}

export interface ReviewProjectItem {
  id: number
  title: string
  description: string
  task_count: number
  open_task_count: number
  completed_task_count: number
  progress_percentage: number
  project_deadline: string | null
  project_status: string
  days_since_update: number
  is_stale: boolean
  updated_at: string
}

export interface ReviewAreaItem {
  id: number
  title: string
  description: string
  open_task_count: number
  next_task_title: string | null
  days_since_update: number
  is_stale: boolean
}

export interface ReviewResourceItem {
  id: number
  title: string
  description: string
  days_since_update: number
  is_stale: boolean
  updated_at: string
}

export interface WeeklyReviewRecord {
  id: number
  completed_at: string
  notes: string
}

export interface CompleteReviewPayload {
  notes: string
}

export const reviewApi = {
  getStatus: (today: string) =>
    apiClient.get<ReviewStatus>('/weekly-review/status', { params: { today } }).then(r => r.data),

  getInbox: () =>
    apiClient.get<ReviewTaskItem[]>('/weekly-review/inbox').then(r => r.data),

  getProjects: (today: string, tzOffset?: string) =>
    apiClient.get<ReviewProjectItem[]>('/weekly-review/projects', {
      params: { today, ...(tzOffset ? { tz_offset: tzOffset } : {}) }
    }).then(r => r.data),

  getAreas: (today: string, tzOffset?: string) =>
    apiClient.get<ReviewAreaItem[]>('/weekly-review/areas', {
      params: { today, ...(tzOffset ? { tz_offset: tzOffset } : {}) }
    }).then(r => r.data),

  getResources: (today: string, tzOffset?: string) =>
    apiClient.get<ReviewResourceItem[]>('/weekly-review/resources', {
      params: { today, ...(tzOffset ? { tz_offset: tzOffset } : {}) }
    }).then(r => r.data),

  complete: (payload: CompleteReviewPayload) =>
    apiClient.post<WeeklyReviewRecord>('/weekly-review/complete', payload).then(r => r.data),

  getHistory: () =>
    apiClient.get<{ reviews: WeeklyReviewRecord[]; total: number }>('/weekly-review/history').then(r => r.data),
}
