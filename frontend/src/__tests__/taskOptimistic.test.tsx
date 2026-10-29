import { describe, it, expect, vi } from "vitest"
import { renderHook, act, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import React from "react"
import { useCompleteTask, taskKeys } from "../hooks/useTasks"
import type { Task } from "../types/models"

vi.mock("../api/tasks", () => ({
  tasksApi: {
    complete: vi.fn(),
    incomplete: vi.fn(),
    inbox: vi.fn().mockResolvedValue([]),
    listForItem: vi.fn().mockResolvedValue([]),
    get: vi.fn(),
  },
}))

vi.mock("../hooks/useSettings", () => ({
  useDeadlineThreshold: () => 3,
}))

import { tasksApi } from "../api/tasks"

const makeTask = (overrides: Partial<Task> = {}): Task => ({
  id: 99,
  item_id: 5,
  title: "Write report",
  description: "",
  notes: "",
  due_date: null,
  priority: "medium",
  is_complete: false,
  sort_order: 0,
  created_at: "",
  updated_at: "",
  subtask_count: 0,
  completed_subtask_count: 0,
  tags: [],
  focus_date: null, waiting_for: null, waiting_since: null, defer_until: null, is_someday: false, item_title: null, item_type: null,
  ...overrides,
})

describe("Fix 4: optimistic complete without detail cache", () => {
  it("updates forItem list cache immediately even when detail cache is absent", async () => {
    const task = makeTask()
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    })

    // Pre-populate forItem list cache (no detail cache)
    qc.setQueryData(taskKeys.forItem(5), [task])

    // mutationFn resolves after we can check optimistic state
    let resolveComplete!: (v: Task) => void
    vi.mocked(tasksApi.complete).mockReturnValue(
      new Promise<Task>((res) => { resolveComplete = res })
    )

    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: qc }, children)

    const { result } = renderHook(() => useCompleteTask(), { wrapper })

    // Fire mutation (no await - we check before it resolves)
    act(() => { result.current.mutate(task.id) })

    // Optimistic update should already be in the cache
    await waitFor(() => {
      const cached = qc.getQueryData<Task[]>(taskKeys.forItem(5))
      expect(cached?.[0]?.is_complete).toBe(true)
    })

    // Cleanup: resolve the pending mutation
    resolveComplete({ ...task, is_complete: true })
  })
})
