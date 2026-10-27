import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import React from "react"
import { ReferenceLinksSection } from "../components/items/ReferenceLinksSection"

vi.mock("../api/links", () => ({
  linksApi: {
    reorderLinks: vi.fn().mockResolvedValue([]),
    listLinks: vi.fn().mockResolvedValue([
      { id: 1, item_id: 1, url: "https://example.com", sort_order: 0, created_at: "" },
    ]),
    addLink: vi.fn().mockResolvedValue({ id: 2, item_id: 1, url: "https://new.com", sort_order: 1, created_at: "" }),
    deleteLink: vi.fn().mockResolvedValue({}),
  },
}))

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return (
    <MemoryRouter>
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    </MemoryRouter>
  )
}

describe("ReferenceLinksSection", () => {
  beforeEach(() => vi.clearAllMocks())

  it("renders existing links", async () => {
    render(<ReferenceLinksSection itemId={1} isArchived={false} />, { wrapper })
    await waitFor(() => expect(screen.getByText("https://example.com")).toBeTruthy())
  })

  it("shows add link input when not archived", () => {
    render(<ReferenceLinksSection itemId={1} isArchived={false} />, { wrapper })
    expect(screen.getByLabelText("Add reference link URL")).toBeTruthy()
  })

  it("hides add link input when archived", () => {
    render(<ReferenceLinksSection itemId={1} isArchived />, { wrapper })
    expect(screen.queryByLabelText("Add reference link URL")).toBeNull()
  })

  it("validates URL must start with http/https", async () => {
    const user = userEvent.setup()
    render(<ReferenceLinksSection itemId={1} isArchived={false} />, { wrapper })
    const input = screen.getByLabelText("Add reference link URL")
    await user.type(input, "javascript:alert(1)")
    await user.keyboard("{Enter}")
    expect(screen.getByRole("alert")).toBeTruthy()
    expect(screen.getByText(/must start with http/i)).toBeTruthy()
  })

  it("calls addLink on valid URL submit", async () => {
    const user = userEvent.setup()
    const { linksApi } = await import("../api/links")
    render(<ReferenceLinksSection itemId={1} isArchived={false} />, { wrapper })
    const input = screen.getByLabelText("Add reference link URL")
    await user.type(input, "https://new.com")
    await user.keyboard("{Enter}")
    await waitFor(() =>
      expect(vi.mocked(linksApi.addLink)).toHaveBeenCalledWith(1, "https://new.com")
    )
  })

  it("renders with DnD context without errors (reorder feature)", async () => {
    // Verify the component mounts successfully with dnd-kit wrapping
    render(<ReferenceLinksSection itemId={1} isArchived={false} />, { wrapper })
    await waitFor(() => expect(screen.getByText("https://example.com")).toBeTruthy())
    // Add link form still accessible
    expect(screen.getByLabelText("Add reference link URL")).toBeTruthy()
  })

  it("renders with DnD context without errors (reorder feature)", async () => {
    // Verify the component mounts successfully with dnd-kit wrapping
    render(<ReferenceLinksSection itemId={1} isArchived={false} />, { wrapper })
    await waitFor(() => expect(screen.getByText("https://example.com")).toBeTruthy())
    // Add link form still accessible
    expect(screen.getByLabelText("Add reference link URL")).toBeTruthy()
  })
})
