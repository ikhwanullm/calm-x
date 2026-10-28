import { apiClient } from './client'

export interface Settings {
  approaching_deadline_threshold: string
  theme?: string
  [key: string]: string | undefined
}

export interface SettingsUpdatePayload {
  approaching_deadline_threshold?: string
  theme?: string
}

export const settingsApi = {
  get: () => apiClient.get<Settings>('/settings').then((r) => r.data),
  update: (payload: SettingsUpdatePayload) =>
    apiClient.put<Settings>('/settings', payload).then((r) => r.data),
}
