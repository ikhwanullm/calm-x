import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { Toaster } from "sonner"
import React from "react"
import InboxPage from "../pages/InboxPage"
import type { Task } from "../types/models"

// Mock the API layer directly (not the hooks)
vi.mock("../api/tasks", () => ({
  tasksApi: {
    inbox: vi.fn().mockResolvedValue([]),
    move: vi.fn().mockResolvedValue({ id: 1, item_id: 10, title: "Task 1", is_complete: false, sort_order: 0, description: "", notes: "", due_date: null, priority: "medium", created_at: "", updated_at: "", subtask_count: 0, completed_subtask_count: 0, tags: [] }),
    complete: vi.fn().mockResolvedValue({ id: 1, is_complete: true }),
    incomplete: vi.fn().mockResolvedValue({ id: 1, is_complete: false }),
    create: vi.fn().mockResolvedValue({ id: 99, item_id: null, title: "New", is_complete: false, sort_order: 0, description: "", notes: "", due_date: null, priority: "medium", created_at: "", updated_at: "", subtask_count: 0, completed_subtask_count: 0, tags: [] }),
  },
}))

vi.mock("../api/items", () => ({
  itemsApi: {
    list: vi.fn().mockResolvedValue([
      { id: 10, type: "project", title: "Work", archived_at: null, created_at: "", updated_at: "", description: "", notes: "", task_count: 0, completed_task_count: 0, progress_percentage: 0, project_goal: null, project_deadline: null, project_status: "active", project_completed_at: null },
    ]),
  },
}))

vi.mock("../hooks/useSettings", () => ({
  useDeadlineThreshold: () => 3,
}))

vi.mock("../components/tasks/TaskDrawer", () => ({
  TaskDrawer: () => null,
}))

const baseTask = (id: number, title = `Task ${id}`): Task => ({
  id, item_id: null, title, is_complete: false, sort_order: id - 1,
  description: "", notes: "", due_date: null, priority: "medium",
  created_at: "", updated_at: "", subtask_count: 0, completed_subtask_count: 0, tags: [],
})

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <MemoryRouter>
        <QueryClientProvider client={qc}>
          <Toaster />
          {children}
        </QueryClientProvider>
      </MemoryRouter>
    )
  }
}

describe("InboxPage", () => {
  beforeEach(() => vi.clearAllMocks())

  it("shows empty state when no tasks", async () => {
    const { tasksApi } = await import("../api/tasks")
    vi.mocked(tasksApi.inbox).mockResolvedValue([])
    render(<InboxPage />, { wrapper: makeWrapper() })
    await waitFor(() => expect(screen.getByText(/Inbox zero/i)).toBeTruthy())
  })

  it("shows task count in header", async () => {
    const { tasksApi } = await import("../api/tasks")
    vi.mocked(tasksApi.inbox).mockResolvedValue([baseTask(1), baseTask(2)])
    render(<InboxPage />, { wrapper: makeWrapper() })
    await waitFor(() => expect(screen.getByText("2")).toBeTruthy())
  })

  it("shows capture input", async () => {
    render(<InboxPage />, { wrapper: makeWrapper() })
    expect(screen.getByRole("textbox", { name: /capture task title/i })).toBeTruthy()
  })

  it("submitting capture calls tasksApi.create", async () => {
    const user = userEvent.setup()
    const { tasksApi } = await import("../api/tasks")
    vi.mocked(tasksApi.inbox).mockResolvedValue([])
    render(<InboxPage />, { wrapper: makeWrapper() })
    const input = screen.getByRole("textbox", { name: /capture task title/i })
    await user.type(input, "Buy milk")
    await user.keyboard("{Enter}")
    await waitFor(() =>
      expect(vi.mocked(tasksApi.create)).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Buy milk", priority: "medium" })
      )
    )
  })

  it("renders task rows when inbox has tasks", async () => {
    const { tasksApi } = await import("../api/tasks")
    vi.mocked(tasksApi.inbox).mockResolvedValue([baseTask(1), baseTask(2)])
    render(<InboxPage />, { wrapper: makeWrapper() })
    await waitFor(() => {
      expect(screen.getByText("Task 1")).toBeTruthy()
      expect(screen.getByText("Task 2")).toBeTruthy()
    })
  })

  it("completed tasks hidden behind Show N completed", async () => {
    const { tasksApi } = await import("../api/tasks")
    vi.mocked(tasksApi.inbox).mockResolvedValue([
      baseTask(1),
      { ...baseTask(2), is_complete: true },
    ])
    render(<InboxPage />, { wrapper: makeWrapper() })
    await waitFor(() => expect(screen.getByText(/Show 1 completed/i)).toBeTruthy())
    expect(screen.queryByText("Task 2")).toBeNull()
  })

  it("shows select-all checkbox when open tasks exist", async () => {
    const { tasksApi } = await import("../api/tasks")
    vi.mocked(tasksApi.inbox).mockResolvedValue([baseTask(1), baseTask(2)])
    render(<InboxPage />, { wrapper: makeWrapper() })
    await waitFor(() => expect(screen.getByLabelText("Select all open tasks")).toBeTruthy())
  })

  it("bulk move: selects tasks, shows action bar, calls move API, shows toast, clears selection", async () => {
    const user = userEvent.setup()
    const { tasksApi } = await import("../api/tasks")
    vi.mocked(tasksApi.inbox).mockResolvedValue([baseTask(1, "Write report"), baseTask(2, "Call client")])
    render(<InboxPage />, { wrapper: makeWrapper() })

    // Wait for tasks to load
    await waitFor(() => expect(screen.getByText("Write report")).toBeTruthy())

    // Select both tasks
    await user.click(screen.getByLabelText("Select task: Write report"))
    await user.click(screen.getByLabelText("Select task: Call client"))

    // Bulk action bar should appear
    await waitFor(() => expect(screen.getByText("2 tasks selected")).toBeTruthy())

    // Select the destination in bulk move select
    const bulkSelect = screen.getByLabelText("Move selected tasks to")
    await user.selectOptions(bulkSelect, "10")

    // move API should have been called twice
    await waitFor(() =>
      expect(vi.mocked(tasksApi.move)).toHaveBeenCalledTimes(2)
    )

    // Toast "Moved 2 tasks to Work" should appear
    await waitFor(() =>
      expect(screen.getByText(/Moved 2 tasks to Work/i)).toBeTruthy(),
      { timeout: 3000 }
    )

    // Selection bar should be gone
    await waitFor(() =>
      expect(screen.queryByText(/tasks selected/i)).toBeNull()
    )
  })
})
