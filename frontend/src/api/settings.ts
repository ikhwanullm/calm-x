import { apiClient } from './client'

export interface Settings {
  approaching_deadline_threshold: string
  [key: string]: string
}

export const settingsApi = {
  get: () => apiClient.get<Settings>('/settings').then((r) => r.data),
}
