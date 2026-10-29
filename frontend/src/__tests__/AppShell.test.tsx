import { describe, it, expect, vi, afterEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createMemoryRouter, RouterProvider } from "react-router-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import React from "react"
import { AppShell } from "../components/layout/AppShell"

vi.mock("../hooks/useTasks", () => ({
  useInboxTasks: vi.fn(() => ({ data: [] })),
  useCreateTask: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
}))

vi.mock("../hooks/useShortcuts", () => ({
  useShortcuts: vi.fn(),
}))

vi.mock("../components/capture/QuickCaptureDialog", () => ({
  QuickCaptureDialog: () => null,
}))

function renderShell(path = "/") {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const testRouter = createMemoryRouter(
    [
      {
        element: <AppShell />,
        children: [
          { path: "/", element: <div>Dashboard content</div> },
          { path: "/inbox", element: <div>Inbox content</div> },
        ],
      },
    ],
    { initialEntries: [path] }
  )
  return render(
    React.createElement(QueryClientProvider, { client: qc },
      React.createElement(RouterProvider, { router: testRouter })
    )
  )
}

const originalMatchMedia = window.matchMedia

function setWide(wide: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: wide, media: query, addEventListener: () => {}, removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia
}

afterEach(() => {
  window.matchMedia = originalMatchMedia
  localStorage.clear()
})

describe("AppShell", () => {
  it("renders the main nav landmark", () => {
    renderShell()
    expect(screen.getByRole("navigation", { name: "Main" })).toBeTruthy()
  })

  it("renders all primary nav links", () => {
    renderShell()
    expect(screen.getByRole("link", { name: "Dashboard" })).toBeTruthy()
    expect(screen.getByRole("link", { name: "Inbox" })).toBeTruthy()
    expect(screen.getByRole("link", { name: "Someday" })).toBeTruthy()
    expect(screen.getByRole("link", { name: "Meetings" })).toBeTruthy()
    expect(screen.getByRole("link", { name: "Projects" })).toBeTruthy()
    expect(screen.getByRole("link", { name: "Areas" })).toBeTruthy()
    expect(screen.getByRole("link", { name: "Resources" })).toBeTruthy()
    expect(screen.getByRole("link", { name: "Archive" })).toBeTruthy()
  })

  it("renders secondary nav links", () => {
    renderShell()
    expect(screen.getByRole("link", { name: "Templates" })).toBeTruthy()
    expect(screen.getByRole("link", { name: "Weekly review" })).toBeTruthy()
    expect(screen.getByRole("link", { name: "Settings" })).toBeTruthy()
  })

  it("renders header with search and quick capture", () => {
    renderShell()
    expect(screen.getByRole("banner")).toBeTruthy()
    expect(screen.getByRole("button", { name: "Quick capture" })).toBeTruthy()
  })

  it("renders the page content outlet", () => {
    renderShell("/")
    expect(screen.getByText("Dashboard content")).toBeTruthy()
  })

  it("active dashboard link has aria-current=page", () => {
    renderShell("/")
    const link = screen.getByRole("link", { name: "Dashboard" })
    expect(link.getAttribute("aria-current")).toBe("page")
  })

  it("shows inbox count pill when inbox has open tasks", async () => {
    setWide(true)  // the count pill is only drawn in the expanded sidebar
    const mod = await import("../hooks/useTasks")
    vi.mocked(mod.useInboxTasks).mockReturnValueOnce({ data: [
      { id: 1, is_complete: false },
      { id: 2, is_complete: false },
      { id: 3, is_complete: true },
    ] } as any)
    renderShell()
    expect(screen.getByLabelText("2 inbox items")).toBeTruthy()
  })

  describe("sidebar toggle", () => {
    const sidebar = () => screen.getByRole("complementary", { name: "Sidebar" })

    it("wide screen: starts expanded, collapses to icons and remembers it", async () => {
      setWide(true)
      const user = userEvent.setup()
      const { unmount } = renderShell()
      expect(sidebar().textContent).toContain("Calm-X")
      expect(sidebar().textContent).toContain("Dashboard")
      await user.click(screen.getByRole("button", { name: "Collapse sidebar" }))
      expect(sidebar().textContent).not.toContain("Dashboard")
      expect(screen.getByRole("link", { name: "Dashboard" })).toBeTruthy()  // still reachable by its icon
      unmount()
      renderShell()
      expect(screen.getByRole("button", { name: "Expand sidebar" }).getAttribute("aria-expanded")).toBe("false")
    })

    it("narrow screen: icons only, the button opens a full sidebar that closes after a click", async () => {
      setWide(false)
      const user = userEvent.setup()
      renderShell()
      expect(sidebar().textContent).not.toContain("Dashboard")
      await user.click(screen.getByRole("button", { name: "Expand sidebar" }))
      expect(sidebar().textContent).toContain("Dashboard")
      await user.click(screen.getByRole("link", { name: "Inbox" }))
      expect(sidebar().textContent).not.toContain("Dashboard")
      expect(await screen.findByText("Inbox content")).toBeTruthy()
    })

    it("narrow screen: Escape closes the open sidebar and nothing is remembered", async () => {
      setWide(false)
      const user = userEvent.setup()
      renderShell()
      await user.click(screen.getByRole("button", { name: "Expand sidebar" }))
      fireEvent.keyDown(window, { key: "Escape" })
      expect(screen.getByRole("button", { name: "Expand sidebar" })).toBeTruthy()
      expect(localStorage.getItem("calmx.sidebar.collapsed")).toBeNull()
    })
  })
})
