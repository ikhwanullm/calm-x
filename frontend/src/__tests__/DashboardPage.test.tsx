import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import React from "react"
import DashboardPage from "../pages/DashboardPage"
import type { DashboardData } from "../types/dashboard"

const mockDashboard: DashboardData = {
  inbox_count: 4,
  active_projects_count: 2,
  active_task_count: 8,
  areas_count: 3,
  area_task_count: 5,
  resources_count: 1,
  archives_count: 2,
  reference_link_count: 0,
  overall_progress: 60,
  nearest_deadline_project: null,
  upcoming_deadlines: [],
  active_projects: [],
  last_review_date: null,
}

vi.mock("../hooks/useDashboard", () => ({
  useDashboard: vi.fn(() => ({ data: mockDashboard, isLoading: false })),
}))

vi.mock("../hooks/useSettings", () => ({
  useDeadlineThreshold: vi.fn().mockReturnValue(3),
}))

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return (
    <MemoryRouter>
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    </MemoryRouter>
  )
}

describe("DashboardPage", () => {
  beforeEach(() => vi.clearAllMocks())

  it("renders Dashboard heading", () => {
    render(<DashboardPage />, { wrapper })
    expect(screen.getByRole("heading", { name: /dashboard/i, level: 1 })).toBeTruthy()
  })

  it("shows inbox count card", () => {
    render(<DashboardPage />, { wrapper })
    expect(screen.getByText("Inbox")).toBeTruthy()
    expect(screen.getByText("4")).toBeTruthy()
  })

  it("shows overall progress card", () => {
    render(<DashboardPage />, { wrapper })
    expect(screen.getByText("Overall progress")).toBeTruthy()
    expect(screen.getByRole("progressbar")).toBeTruthy()
  })

  it("shows empty needs attention when none", () => {
    render(<DashboardPage />, { wrapper })
    expect(screen.getByText(/Nothing overdue/i)).toBeTruthy()
  })

  it("shows needs attention item when overdue project", async () => {
    const { useDashboard } = await import("../hooks/useDashboard")
    vi.mocked(useDashboard).mockReturnValueOnce({
      data: {
        ...mockDashboard,
        upcoming_deadlines: [{
          id: 1, type: "project", title: "Late project",
          deadline: "2020-01-01", is_overdue: true, item_id: null,
        }],
      },
      isLoading: false,
    } as any)
    render(<DashboardPage />, { wrapper })
    expect(screen.getByText("Late project")).toBeTruthy()
  })

  it("shows Start weekly review button", () => {
    render(<DashboardPage />, { wrapper })
    expect(screen.getByRole("link", { name: /weekly review/i })).toBeTruthy()
  })

  it("shows no reviews yet when last_review_date is null", () => {
    render(<DashboardPage />, { wrapper })
    expect(screen.getByText(/No reviews yet/i)).toBeTruthy()
  })

  it("threshold=7 shows approaching badge for item 5 days away", async () => {
    const { useDeadlineThreshold } = await import("../hooks/useSettings")
    vi.mocked(useDeadlineThreshold).mockReturnValueOnce(7)
    const today = new Date()
    const in5 = new Date(today)
    in5.setDate(today.getDate() + 5)
    const in5str = in5.toISOString().split("T")[0]
    const { useDashboard } = await import("../hooks/useDashboard")
    vi.mocked(useDashboard).mockReturnValueOnce({
      data: {
        ...mockDashboard,
        upcoming_deadlines: [{
          id: 2, type: "project", title: "Approaching P",
          deadline: in5str, is_overdue: false, item_id: null,
        }],
      },
      isLoading: false,
    } as any)
    render(<DashboardPage />, { wrapper })
    expect(screen.getByText("Approaching P")).toBeTruthy()
    // Badge "Due soon" should appear
    expect(screen.getByText("Due soon")).toBeTruthy()
  })
})
