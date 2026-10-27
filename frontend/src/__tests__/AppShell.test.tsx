import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
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

describe("AppShell", () => {
  it("renders the main nav landmark", () => {
    renderShell()
    expect(screen.getByRole("navigation", { name: "Main" })).toBeTruthy()
  })

  it("renders all primary nav links", () => {
    renderShell()
    expect(screen.getByRole("link", { name: "Dashboard" })).toBeTruthy()
    expect(screen.getByRole("link", { name: "Inbox" })).toBeTruthy()
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
    const mod = await import("../hooks/useTasks")
    vi.mocked(mod.useInboxTasks).mockReturnValueOnce({ data: [
      { id: 1, is_complete: false },
      { id: 2, is_complete: false },
      { id: 3, is_complete: true },
    ] } as any)
    renderShell()
    expect(screen.getByLabelText("2 inbox items")).toBeTruthy()
  })
})
