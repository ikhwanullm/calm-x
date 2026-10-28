import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import React from "react"
import SettingsPage from "../pages/SettingsPage"

vi.mock("../api/tags", () => ({
  tagsApi: {
    list: vi.fn().mockResolvedValue([
      { id: 1, name: "work", created_at: "" },
    ]),
    create: vi.fn().mockResolvedValue({ id: 2, name: "new-tag", created_at: "" }),
    rename: vi.fn().mockResolvedValue({ id: 1, name: "renamed", created_at: "" }),
    delete: vi.fn().mockResolvedValue({}),
  },
}))

vi.mock("../api/tasks", () => ({ tasksApi: { list: vi.fn().mockResolvedValue([]) } }))

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return (
    <MemoryRouter>
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    </MemoryRouter>
  )
}

describe("SettingsPage", () => {
  beforeEach(() => vi.clearAllMocks())

  it("renders existing tags", async () => {
    render(<SettingsPage />, { wrapper })
    await waitFor(() => expect(screen.getByText("#work")).toBeTruthy())
  })

  it("creates a new tag on form submit", async () => {
    const { tagsApi } = await import("../api/tags")
    const user = userEvent.setup()
    render(<SettingsPage />, { wrapper })
    await user.type(screen.getByLabelText("New tag name"), "newtag")
    await user.keyboard("{Enter}")
    await waitFor(() => expect(vi.mocked(tagsApi.create)).toHaveBeenCalledWith({ name: "newtag" }))
  })

  it("shows rename form when Rename clicked", async () => {
    const user = userEvent.setup()
    render(<SettingsPage />, { wrapper })
    await waitFor(() => screen.getByLabelText("Rename tag work"))
    await user.click(screen.getByLabelText("Rename tag work"))
    expect(screen.getByLabelText("Edit tag name")).toBeTruthy()
  })

  it("shows inline error on rename conflict (not toast)", async () => {
    const { tagsApi } = await import("../api/tags")
    vi.mocked(tagsApi.rename).mockRejectedValue(new Error("Tag already exists"))
    const user = userEvent.setup()
    render(<SettingsPage />, { wrapper })
    await waitFor(() => screen.getByLabelText("Rename tag work"))
    await user.click(screen.getByLabelText("Rename tag work"))
    const input = screen.getByLabelText("Edit tag name")
    await user.clear(input)
    await user.type(input, "conflict")
    await user.keyboard("{Enter}")
    await waitFor(() =>
      expect(screen.getAllByRole("alert").length).toBeGreaterThan(0)
    )
  })

  it("shows confirm dialog before delete", async () => {
    const user = userEvent.setup()
    render(<SettingsPage />, { wrapper })
    await waitFor(() => screen.getByLabelText("Delete tag work"))
    await user.click(screen.getByLabelText("Delete tag work"))
    expect(screen.getByRole("alertdialog")).toBeTruthy()
  })
})
