import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { MemoryRouter } from "react-router-dom"
import React from "react"
import { QuickCaptureDialog } from "../components/capture/QuickCaptureDialog"

const mockMutate = vi.fn()

vi.mock("../hooks/useTasks", () => ({
  useCreateTask: vi.fn(() => ({ mutate: mockMutate, isPending: false })),
}))

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return (
    <MemoryRouter>
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
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

  it("calls createTask.mutate with trimmed title on submit", async () => {
    const user = userEvent.setup()
    render(<QuickCaptureDialog open onOpenChange={vi.fn()} />, { wrapper })
    const input = screen.getByRole("textbox", { name: /task title/i })
    await user.type(input, "My new task")
    await user.keyboard("{Enter}")
    expect(mockMutate).toHaveBeenCalledWith(
      expect.objectContaining({ title: "My new task", priority: "medium" }),
      expect.any(Object)
    )
  })

  it("submit button is disabled when title is empty", () => {
    render(<QuickCaptureDialog open onOpenChange={vi.fn()} />, { wrapper })
    const btn = screen.getByRole("button", { name: /capture/i })
    expect((btn as HTMLButtonElement).disabled).toBe(true)
  })
})
