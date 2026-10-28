import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import React from "react"
import { renderHook } from "@testing-library/react"

vi.mock("../hooks/useSettings", () => ({
  useDeadlineThreshold: () => 3,
}))

vi.mock("../api/links", () => ({
  linksApi: {
    listLinks: vi.fn().mockResolvedValue([
      { id: 1, item_id: 1, url: "https://alpha.com", sort_order: 0, created_at: "" },
      { id: 2, item_id: 1, url: "https://beta.com",  sort_order: 1, created_at: "" },
    ]),
    addLink: vi.fn().mockResolvedValue({
      id: 3, item_id: 1, url: "https://new.com", sort_order: 2, created_at: "",
    }),
    deleteLink: vi.fn().mockResolvedValue({}),
    reorderLinks: vi.fn().mockResolvedValue([
      { id: 2, item_id: 1, url: "https://beta.com",  sort_order: 0, created_at: "" },
      { id: 1, item_id: 1, url: "https://alpha.com", sort_order: 1, created_at: "" },
    ]),
  },
}))

import { ReferenceLinksSection } from "../components/items/ReferenceLinksSection"
import { useReorderReferenceLinks } from "../hooks/useLinks"

function makeQC() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
}

function wrapper({ children }: { children: React.ReactNode }) {
  return (
    <MemoryRouter>
      <QueryClientProvider client={makeQC()}>{children}</QueryClientProvider>
    </MemoryRouter>
  )
}

function hookWrapper({ children }: { children: React.ReactNode }) {
  return (
    <MemoryRouter>
      <QueryClientProvider client={makeQC()}>{children}</QueryClientProvider>
    </MemoryRouter>
  )
}

describe("ReferenceLinksSection", () => {
  beforeEach(() => vi.clearAllMocks())

  it("renders existing links from the server", async () => {
    render(<ReferenceLinksSection itemId={1} isArchived={false} />, { wrapper })
    await waitFor(() => {
      expect(screen.getByText("https://alpha.com")).toBeTruthy()
      expect(screen.getByText("https://beta.com")).toBeTruthy()
    })
  })

  it("shows add link form when not archived", () => {
    render(<ReferenceLinksSection itemId={1} isArchived={false} />, { wrapper })
    expect(screen.getByLabelText("Add reference link URL")).toBeTruthy()
  })

  it("hides add link form when archived", () => {
    render(<ReferenceLinksSection itemId={1} isArchived />, { wrapper })
    expect(screen.queryByLabelText("Add reference link URL")).toBeNull()
  })

  it("shows validation error for javascript: URL scheme", async () => {
    const user = userEvent.setup()
    render(<ReferenceLinksSection itemId={1} isArchived={false} />, { wrapper })
    await user.type(screen.getByLabelText("Add reference link URL"), "javascript:alert(1)")
    await user.keyboard("{Enter}")
    await waitFor(() =>
      expect(screen.getByText(/must start with http/i)).toBeTruthy()
    )
    expect(screen.getByRole("alert")).toBeTruthy()
  })

  it("calls addLink when a valid URL is submitted", async () => {
    const { linksApi } = await import("../api/links")
    const user = userEvent.setup()
    render(<ReferenceLinksSection itemId={1} isArchived={false} />, { wrapper })
    await user.type(screen.getByLabelText("Add reference link URL"), "https://new.com")
    await user.keyboard("{Enter}")
    await waitFor(() =>
      expect(vi.mocked(linksApi.addLink)).toHaveBeenCalledWith(1, "https://new.com")
    )
  })

  it("shows reorder handles with correct aria-labels for non-archived items", async () => {
    render(<ReferenceLinksSection itemId={1} isArchived={false} />, { wrapper })
    await waitFor(() => {
      expect(screen.getByLabelText("Reorder link: https://alpha.com")).toBeTruthy()
      expect(screen.getByLabelText("Reorder link: https://beta.com")).toBeTruthy()
    })
  })

  it("hides reorder handles when item is archived", async () => {
    render(<ReferenceLinksSection itemId={1} isArchived />, { wrapper })
    await waitFor(() => screen.getByText("https://alpha.com"))
    expect(screen.queryAllByLabelText(/Reorder link:/i)).toHaveLength(0)
  })

  it("shows drag handle that is keyboard-focusable", async () => {
    render(<ReferenceLinksSection itemId={1} isArchived={false} />, { wrapper })
    await waitFor(() => {
      const handle = screen.getByLabelText("Reorder link: https://alpha.com")
      expect(handle).toBeTruthy()
      // handle should be a button (keyboard-accessible)
      expect((handle as HTMLButtonElement).tagName).toBe("BUTTON")
    })
  })

  it("calls reorderLinks API via hook mutation with correct order", async () => {
    const { linksApi } = await import("../api/links")
    const { result } = renderHook(() => useReorderReferenceLinks(1), {
      wrapper: hookWrapper,
    })
    // Simulate what handleDragEnd does: call mutate with [2, 1] (beta before alpha)
    result.current.mutate([2, 1])
    await waitFor(() =>
      expect(vi.mocked(linksApi.reorderLinks)).toHaveBeenCalledWith(1, [2, 1])
    )
  })
})

describe("useReorderReferenceLinks hook", () => {
  beforeEach(() => vi.clearAllMocks())

  it("calls linksApi.reorderLinks with item id and new order", async () => {
    const { linksApi } = await import("../api/links")
    const { result } = renderHook(() => useReorderReferenceLinks(1), {
      wrapper: hookWrapper,
    })
    result.current.mutate([2, 1])
    await waitFor(() =>
      expect(vi.mocked(linksApi.reorderLinks)).toHaveBeenCalledWith(1, [2, 1])
    )
  })
})
