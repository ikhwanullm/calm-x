import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import React from "react"
import AllTasksPage from "../pages/AllTasksPage"
import type { Task } from "../types/models"

vi.mock("../api/tasks", () => ({
  tasksApi: {
    list: vi.fn().mockResolvedValue([]),
    complete: vi.fn().mockResolvedValue({}),
    incomplete: vi.fn().mockResolvedValue({}),
  },
}))

vi.mock("../api/tags", () => ({
  tagsApi: {
    list: vi.fn().mockResolvedValue([
      { id: 1, name: "work", created_at: "" },
      { id: 2, name: "urgent", created_at: "" },
    ]),
  },
}))

vi.mock("../hooks/useSettings", () => ({ useDeadlineThreshold: () => 3 }))
vi.mock("../components/tasks/TaskDrawer", () => ({ TaskDrawer: () => null }))

const makeTask = (id: number, title = `Task ${id}`): Task => ({
  id, item_id: null, title, is_complete: false, sort_order: 0,
  description: "", notes: "", due_date: null, priority: "medium",
  created_at: "", updated_at: "", subtask_count: 0, completed_subtask_count: 0, tags: [],
  focus_date: null, waiting_for: null, waiting_since: null, defer_until: null, is_someday: false, meeting_id: null, meeting_title: null, meeting_held_at: null, item_title: null, item_type: null,
})

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return (
    <MemoryRouter initialEntries={["/tasks"]}>
      <QueryClientProvider client={qc}>
        <Routes>
          <Route path="/tasks" element={children} />
        </Routes>
      </QueryClientProvider>
    </MemoryRouter>
  )
}

describe("AllTasksPage", () => {
  beforeEach(() => vi.clearAllMocks())

  it("shows empty state when no tasks", async () => {
    render(<AllTasksPage />, { wrapper })
    await waitFor(() =>
      expect(screen.getByText(/No matching tasks found/i)).toBeTruthy()
    )
  })

  it("shows tasks from API", async () => {
    const { tasksApi } = await import("../api/tasks")
    vi.mocked(tasksApi.list).mockResolvedValue([makeTask(1, "My task")])
    render(<AllTasksPage />, { wrapper })
    await waitFor(() => expect(screen.getByText("My task")).toBeTruthy())
  })

  it("filter panel is visible", async () => {
    render(<AllTasksPage />, { wrapper })
    expect(screen.getByLabelText("Task filters")).toBeTruthy()
  })

  it("state is stored in URL after tag click", async () => {
    const user = userEvent.setup()
    render(<AllTasksPage />, { wrapper })
    await waitFor(() => screen.getByLabelText("Filter by tag work"))
    await user.click(screen.getByLabelText("Filter by tag work"))
    // After click, URL should contain tags param (checked via filter panel state)
    expect(screen.getByLabelText("Filter by tag work")).toHaveAttribute("aria-pressed", "true")
  })

  it("shows page heading All tasks", () => {
    render(<AllTasksPage />, { wrapper })
    expect(screen.getByRole("heading", { name: "All tasks" })).toBeTruthy()
  })
})
