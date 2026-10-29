import { apiClient } from './client'
import type {
  Meeting,
  MeetingActions,
  MeetingCarryOver,
  MeetingCreatePayload,
  MeetingSummary,
  MeetingUpdatePayload,
  ProcessActionPayload,
  ProcessResult,
} from '../types/models'

export const meetingsApi = {
  list: (q?: string) =>
    apiClient.get<MeetingSummary[]>('/meetings', { params: q ? { q } : undefined }).then(r => r.data),

  listForItem: (itemId: number) =>
    apiClient.get<MeetingSummary[]>(`/items/${itemId}/meetings`).then(r => r.data),

  carryOver: (itemId: number) =>
    apiClient.get<MeetingCarryOver | null>(`/items/${itemId}/meetings/carry-over`).then(r => r.data),

  get: (id: number) =>
    apiClient.get<Meeting>(`/meetings/${id}`).then(r => r.data),

  create: (itemId: number, payload: MeetingCreatePayload) =>
    apiClient.post<Meeting>(`/items/${itemId}/meetings`, payload).then(r => r.data),

  update: (id: number, payload: MeetingUpdatePayload) =>
    apiClient.put<Meeting>(`/meetings/${id}`, payload).then(r => r.data),

  delete: (id: number) =>
    apiClient.delete(`/meetings/${id}`),

  restore: (id: number) =>
    apiClient.post<Meeting>(`/meetings/${id}/restore`).then(r => r.data),

  actions: (id: number) =>
    apiClient.get<MeetingActions>(`/meetings/${id}/actions`).then(r => r.data),

  process: (id: number, actions: ProcessActionPayload[]) =>
    apiClient.post<ProcessResult>(`/meetings/${id}/process`, { actions }).then(r => r.data),
}
