import { useQuery } from "@tanstack/react-query"
import { tasksApi } from "../api/tasks"

export interface FilterParams {
  tagIds?: number[]
  priorities?: string[]
  dueStart?: string
  dueEnd?: string
  category?: string
}

export function useFilteredTasks(params: FilterParams, enabled = true) {
  const tags = params.tagIds?.join(",") ?? undefined
  const priorities = params.priorities?.join(",") ?? undefined
  return useQuery({
    queryKey: ["tasks", "filter", params],
    queryFn: () =>
      tasksApi.list({
        scope: "all",  // include Inbox + non-archived items when no category filter
        tags,
        priorities,
        due_start: params.dueStart,
        due_end: params.dueEnd,
        category: params.category,
      }),
    enabled,
    staleTime: 30 * 1000,
  })
}
