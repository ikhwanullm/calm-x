import { apiClient } from './client'
import type {
  Item,
  ItemType,
  ItemCreatePayload,
  ItemUpdatePayload,
} from '../types/models'

export interface ListItemsParams {
  type?: ItemType
  include_archived?: boolean
  archived?: 'only'
  q?: string
  archived_from?: string  // YYYY-MM-DD
  archived_to?: string    // YYYY-MM-DD
  area_id?: number        // only Projects that belong to this Area
  today?: string          // YYYY-MM-DD; adds `stats` to each Project
}

export const itemsApi = {
  list: (params?: ListItemsParams) =>
    apiClient.get<Item[]>('/items/', { params }).then(r => r.data),

  get: (id: number) =>
    apiClient.get<Item>(`/items/${id}`).then(r => r.data),

  create: (payload: ItemCreatePayload) =>
    apiClient.post<Item>('/items/', payload).then(r => r.data),

  update: (id: number, payload: ItemUpdatePayload) =>
    apiClient.put<Item>(`/items/${id}`, payload).then(r => r.data),

  delete: (id: number) =>
    apiClient.delete(`/items/${id}`),

  archive: (id: number) =>
    apiClient.post<Item>(`/items/${id}/archive`).then(r => r.data),

  restore: (id: number) =>
    apiClient.post<Item>(`/items/${id}/restore`).then(r => r.data),

  completeProject: (id: number) =>
    apiClient.post<Item>(`/items/${id}/complete`).then(r => r.data),

  reopenProject: (id: number) =>
    apiClient.post<Item>(`/items/${id}/reopen`).then(r => r.data),
}
