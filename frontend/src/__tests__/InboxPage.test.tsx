import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import React from "react"
import InboxPage from "../pages/InboxPage"
import type { Task } from "../types/models"

const mockCreate = vi.fn()
const mockComplete = vi.fn()
const mockIncomplete = vi.fn()
const mockMove = vi.fn()

vi.mock("../hooks/useTasks", () => ({
  useInboxTasks: vi.fn(() => ({ data: [], isLoading: false })),
  useCreateTask: vi.fn(() => ({ mutate: mockCreate, isPending: false })),
  useCompleteTask: vi.fn(() => ({ mutate: mockComplete })),
  useIncompleteTask: vi.fn(() => ({ mutate: mockIncomplete })),
  useMoveTask: vi.fn(() => ({ mutate: mockMove })),
}))

vi.mock("../hooks/useItems", () => ({
  useItems: vi.fn(() => ({ data: [] })),
}))

vi.mock("../hooks/useSettings", () => ({
  useDeadlineThreshold: vi.fn().mockReturnValue(3),
}))

vi.mock("../components/tasks/TaskDrawer", () => ({
  TaskDrawer: () => null,
}))

const makeTask = (id: number, is_complete = false): Task => ({
  id, item_id: null, title: `Task ${id}`, description: "", notes: "",
  due_date: null, priority: "medium", is_complete, sort_order: 0,
  created_at: "", updated_at: "", subtask_count: 0, completed_subtask_count: 0, tags: [],
})

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return (
    <MemoryRouter>
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    </MemoryRouter>
  )
}

describe("InboxPage", () => {
  beforeEach(() => vi.clearAllMocks())

  it("shows empty state when no tasks", () => {
    render(<InboxPage />, { wrapper })
    expect(screen.getByText(/Inbox zero/i)).toBeTruthy()
  })

  it("shows task count in header", async () => {
    const { useInboxTasks } = await import("../hooks/useTasks")
    vi.mocked(useInboxTasks).mockReturnValue({ data: [makeTask(1), makeTask(2)], isLoading: false } as any)
    render(<InboxPage />, { wrapper })
    expect(screen.getByText("2")).toBeTruthy()
  })

  it("shows capture input", () => {
    render(<InboxPage />, { wrapper })
    expect(screen.getByRole("textbox", { name: /capture task title/i })).toBeTruthy()
  })

  it("submitting capture calls createTask.mutate", async () => {
    const user = userEvent.setup()
    render(<InboxPage />, { wrapper })
    const input = screen.getByRole("textbox", { name: /capture task title/i })
    await user.type(input, "Buy milk")
    await user.keyboard("{Enter}")
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Buy milk", priority: "medium" }),
      expect.any(Object)
    )
  })

  it("renders task rows when inbox has tasks", async () => {
    const { useInboxTasks } = await import("../hooks/useTasks")
    vi.mocked(useInboxTasks).mockReturnValue({
      data: [makeTask(1), makeTask(2)], isLoading: false
    } as any)
    render(<InboxPage />, { wrapper })
    expect(screen.getByText("Task 1")).toBeTruthy()
    expect(screen.getByText("Task 2")).toBeTruthy()
  })

  it("completed tasks hidden behind Show N completed", async () => {
    const { useInboxTasks } = await import("../hooks/useTasks")
    vi.mocked(useInboxTasks).mockReturnValue({
      data: [makeTask(1), makeTask(2, true)], isLoading: false
    } as any)
    render(<InboxPage />, { wrapper })
    expect(screen.getByText(/Show 1 completed/i)).toBeTruthy()
    expect(screen.queryByText("Task 2")).toBeNull()
  })
})
