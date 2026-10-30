import { useQuery } from "@tanstack/react-query"
import { tasksApi } from "../api/tasks"
import { getLocalToday } from "../utils/date"

export type TaskStatus = "open" | "completed" | "all"
export type TaskSort = "due" | "priority" | "project" | "created" | "updated"

export interface FilterParams {
  tagIds?: number[]
  priorities?: string[]
  dueStart?: string
  dueEnd?: string
  category?: string
}

/** Everything the All tasks page asks the server for (FilterParams plus search, status, state chips and sort). */
export interface TaskListParams extends FilterParams {
  q?: string
  status?: TaskStatus
  /** Leave Someday and not-yet-started tasks out unless their own chip is on (the Today rules). */
  hideParked?: boolean
  /** Chips: true = only those. */
  waiting?: boolean
  deferred?: boolean
  someday?: boolean
  fromMeeting?: boolean
  sort?: TaskSort
}

export function useFilteredTasks(params: TaskListParams, enabled = true) {
  const tags = params.tagIds?.join(",") ?? undefined
  const priorities = params.priorities?.join(",") ?? undefined
  const today = getLocalToday()
  return useQuery({
    queryKey: ["tasks", "filter", today, params],
    queryFn: () =>
      tasksApi.list({
        scope: "all",  // include Inbox + non-archived items when no category filter
        tags,
        priorities,
        due_start: params.dueStart,
        due_end: params.dueEnd,
        category: params.category,
        q: params.q || undefined,
        status: params.status,
        waiting: params.waiting ? true : undefined,
        someday: params.someday ? true : params.hideParked ? false : undefined,
        deferred: params.deferred ? true : params.hideParked ? false : undefined,
        from_meeting: params.fromMeeting ? true : undefined,
        sort: params.sort,
        today,
      }),
    enabled,
    staleTime: 30 * 1000,
  })
}
