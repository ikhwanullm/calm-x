import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, useLocation } from "react-router-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import React from "react"
import { CommandPalette } from "../components/search/CommandPalette"
import { searchApi } from "../api/search"

// Mock cmdk entirely to avoid jsdom browser API issues
vi.mock("cmdk", () => {
  const Root = ({ children, ...p }: any) => <div role="menu" {...p}>{children}</div>
  Root.Input = ({ "aria-label": a, value, onValueChange, ...p }: any) =>
    <input aria-label={a} value={value ?? ""} onChange={(e) => onValueChange?.(e.target.value)} {...p} />
  Root.List = ({ children, ...p }: any) => <ul {...p}>{children}</ul>
  Root.Group = ({ heading, children }: any) => <li><span>{heading}</span>{children}</li>
  Root.Item = ({ children, onSelect, value, ...p }: any) =>
    <button type="button" onClick={() => onSelect?.(value ?? "")} {...p}>{children}</button>
  Root.Empty = ({ children }: any) => <li>{children}</li>
  Root.Loading = ({ children }: any) => <li>{children}</li>
  return { Command: Root }
})

vi.mock("../api/search", () => ({
  searchApi: {
    search: vi.fn().mockResolvedValue([
      { id: 1, type: "item", item_type: "project", title: "Alpha project", is_archived: false, item_id: null },
      { id: 2, type: "task", item_type: null, title: "My task", is_archived: false, item_id: 1 },
    ]),
  },
}))

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <MemoryRouter><QueryClientProvider client={qc}>{children}</QueryClientProvider></MemoryRouter>
}

describe("CommandPalette", () => {
  beforeEach(() => vi.clearAllMocks())

  it("renders when open", () => {
    render(<CommandPalette open onOpenChange={vi.fn()} />, { wrapper })
    expect(screen.getAllByLabelText("Command palette").length).toBeGreaterThan(0)
  })

  it("renders search input", () => {
    render(<CommandPalette open onOpenChange={vi.fn()} />, { wrapper })
    expect(screen.getByRole("textbox", { name: "Search query" })).toBeTruthy()
  })

  it("does not render when closed", () => {
    render(<CommandPalette open={false} onOpenChange={vi.fn()} />, { wrapper })
    expect(screen.queryByLabelText("Command palette")).toBeNull()
  })

  it("shows Quick capture and New project actions", async () => {
    render(<CommandPalette open onOpenChange={vi.fn()} />, { wrapper })
    await waitFor(() => {
      expect(screen.getByText("Quick capture")).toBeTruthy()
      expect(screen.getByText("New project")).toBeTruthy()
    })
  })

  it("calls onQuickCapture when Quick capture is clicked", async () => {
    const user = userEvent.setup()
    const onCapture = vi.fn()
    render(<CommandPalette open onOpenChange={vi.fn()} onQuickCapture={onCapture} />, { wrapper })
    await waitFor(() => screen.getByText("Quick capture"))
    await user.click(screen.getByText("Quick capture"))
    expect(onCapture).toHaveBeenCalled()
  })

  it("shows grouped search results after typing (Projects, Tasks)", async () => {
    const user = userEvent.setup()
    render(<CommandPalette open onOpenChange={vi.fn()} />, { wrapper })
    const input = screen.getByRole("textbox", { name: "Search query" })
    await user.type(input, "alpha")
    await waitFor(() => {
      expect(screen.getByText("Alpha project")).toBeTruthy()
      expect(screen.getByText("Projects")).toBeTruthy()
      expect(screen.getByText("Tasks")).toBeTruthy()
    }, { timeout: 1500 })
  })

  it("finds meetings and opens one", async () => {
    vi.mocked(searchApi.search).mockResolvedValueOnce([
      { id: 5, type: "meeting", item_type: "project", title: "Firewall sync", is_archived: false, item_id: 3 },
    ])
    const user = userEvent.setup()
    function Where() { return <p data-testid="where">{useLocation().pathname}</p> }
    render(<><CommandPalette open onOpenChange={vi.fn()} /><Where /></>, { wrapper })
    await user.type(screen.getByRole("textbox", { name: "Search query" }), "firewall")
    await waitFor(() => expect(screen.getByText("Meetings", { selector: "span" })).toBeTruthy(), { timeout: 1500 })
    await user.click(screen.getByText("Firewall sync"))
    expect(screen.getByTestId("where").textContent).toBe("/meetings/5")
  })

  it("sidebar navigate items are all present", async () => {
    render(<CommandPalette open onOpenChange={vi.fn()} />, { wrapper })
    await waitFor(() => {
      expect(screen.getByText("Resources")).toBeTruthy()
      expect(screen.getByText("Archive")).toBeTruthy()
      expect(screen.getByText("Weekly review")).toBeTruthy()
      expect(screen.getByText("Someday")).toBeTruthy()
      expect(screen.getByText("Meetings")).toBeTruthy()
    })
  })
})
