import { apiClient } from "./client"

export interface SearchResult {
  type: "item" | "task" | "meeting"
  id: number
  title: string
  item_type: string | null
  is_archived: boolean
  item_id: number | null
}

export const searchApi = {
  search: (q: string) =>
    apiClient.get<SearchResult[]>("/search", { params: { q } }).then((r) => r.data),
}
