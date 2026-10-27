import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { MemoryRouter } from "react-router-dom"
import { Toaster } from "sonner"
import React from "react"
import { QuickCaptureDialog } from "../components/capture/QuickCaptureDialog"
import { notify } from "../lib/toast"

// Mock the API so the real useCreateTask hook can resolve
vi.mock("../api/tasks", () => ({
  tasksApi: {
    create: vi.fn().mockResolvedValue({
      id: 1, item_id: null, title: "Test task", is_complete: false,
      sort_order: 0, description: "", notes: "", due_date: null,
      priority: "medium", created_at: "", updated_at: "",
      subtask_count: 0, completed_subtask_count: 0, tags: [],
    }),
    inbox: vi.fn().mockResolvedValue([]),
  },
}))

vi.mock("../api/items", () => ({ itemsApi: { list: vi.fn().mockResolvedValue([]) } }))
vi.mock("../api/settings", () => ({
  settingsApi: { get: vi.fn().mockResolvedValue({ approaching_deadline_threshold: "3" }) },
}))

// Spy on notify.success so we can assert it was called with the action option
vi.mock("../lib/toast", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/toast")>()
  return {
    ...actual,
    notify: {
      success: vi.fn(),
      error: vi.fn(),
      info: vi.fn(),
    },
  }
})

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return (
    <MemoryRouter>
      <QueryClientProvider client={qc}>
        <Toaster />
        {children}
      </QueryClientProvider>
    </MemoryRouter>
  )
}

describe("QuickCaptureDialog", () => {
  beforeEach(() => vi.clearAllMocks())

  it("renders title input when open", () => {
    render(<QuickCaptureDialog open onOpenChange={vi.fn()} />, { wrapper })
    expect(screen.getByRole("textbox", { name: /task title/i })).toBeTruthy()
  })

  it("does not render when closed", () => {
    render(<QuickCaptureDialog open={false} onOpenChange={vi.fn()} />, { wrapper })
    expect(screen.queryByRole("textbox", { name: /task title/i })).toBeNull()
  })

  it("calls tasksApi.create with trimmed title on submit", async () => {
    const user = userEvent.setup()
    const { tasksApi } = await import("../api/tasks")
    render(<QuickCaptureDialog open onOpenChange={vi.fn()} />, { wrapper })
    const input = screen.getByRole("textbox", { name: /task title/i })
    await user.type(input, "My new task")
    await user.keyboard("{Enter}")
    await waitFor(() =>
      expect(vi.mocked(tasksApi.create)).toHaveBeenCalledWith(
        expect.objectContaining({ title: "My new task", priority: "medium" })
      )
    )
  })

  it("submit button is disabled when title is empty", () => {
    render(<QuickCaptureDialog open onOpenChange={vi.fn()} />, { wrapper })
    const btn = screen.getByRole("button", { name: /capture/i })
    expect((btn as HTMLButtonElement).disabled).toBe(true)
  })

  it("shows Added to Inbox toast with View Inbox action after successful capture", async () => {
    const user = userEvent.setup()
    render(<QuickCaptureDialog open onOpenChange={vi.fn()} />, { wrapper })
    const input = screen.getByRole("textbox", { name: /task title/i })
    await user.type(input, "Test task")
    await user.keyboard("{Enter}")
    // Verify notify.success was called with the action option containing "View Inbox"
    await waitFor(() =>
      expect(vi.mocked(notify.success)).toHaveBeenCalledWith(
        "Added to Inbox",
        expect.objectContaining({
          action: expect.objectContaining({ label: "View Inbox" }),
        })
      )
    )
  })
})
