import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, within } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import DashboardPage from "../pages/DashboardPage"
import type { AttentionProject, DashboardData } from "../types/dashboard"

const EMPTY: DashboardData = {
  inbox_count: 0,
  last_review_date: "2026-10-27",
  days_since_review: 2,
  meetings_to_process: [],
  stale_waiting: [],
  stale_waiting_total: 0,
  attention_projects: [],
  counts: { active_projects: 14, areas: 3, resources: 1, archived: 2, someday: 4 },
}

const state = vi.hoisted(() => ({ data: undefined as unknown, isLoading: false }))
vi.mock("../hooks/useDashboard", () => ({
  useDashboard: () => ({ data: state.data, isLoading: state.isLoading }),
}))

function show(patch: Partial<DashboardData>) {
  state.data = { ...EMPTY, ...patch }
}

function renderPage() {
  return render(<DashboardPage />, { wrapper: ({ children }) => <MemoryRouter>{children}</MemoryRouter> })
}

function project(extra: Partial<AttentionProject> = {}): AttentionProject {
  return {
    id: 1, title: "Migrate CML", reasons: ["overdue_tasks"], overdue_task_count: 2, open_task_count: 3,
    progress_percentage: 20, project_deadline: "2026-11-05", days_inactive: 3, ...extra,
  }
}

describe("DashboardPage", () => {
  beforeEach(() => {
    state.isLoading = false
    show({})
  })

  it("renders the heading", () => {
    renderPage()
    expect(screen.getByRole("heading", { level: 1, name: "Dashboard" })).toBeTruthy()
  })

  it("shows loading placeholders instead of numbers", () => {
    state.isLoading = true
    state.data = undefined
    renderPage()
    expect(screen.queryByText("Process inbox →")).toBeNull()
    expect(screen.queryByRole("navigation", { name: "Shortcuts" })).toBeNull()
  })

  it("does not repeat Today: no due dates, deadlines or Needs attention list", () => {
    renderPage()
    const headings = screen.queryAllByRole("heading").map((h) => h.textContent)
    expect(headings.join("|")).not.toMatch(/needs attention|overall progress|active projects/i)
  })

  describe("to process", () => {
    it("inbox count with a link to process it", () => {
      show({ inbox_count: 4 })
      renderPage()
      expect(screen.getByText("4")).toBeTruthy()
      expect(screen.getByRole("link", { name: "Process inbox →" }).getAttribute("href")).toBe("/inbox")
    })

    it("lists meetings with actions left, each linking to its meeting", () => {
      show({
        meetings_to_process: [
          { id: 7, title: "Weekly sync", held_at: "2026-10-28T03:00:00Z", item_id: 3, item_title: "Migrate CML", item_type: "project", open_action_count: 3 },
          { id: 8, title: "Kickoff", held_at: "2026-10-27T03:00:00Z", item_id: 3, item_title: "Migrate CML", item_type: "project", open_action_count: 1 },
        ],
      })
      renderPage()
      const list = screen.getByRole("list", { name: "Meetings to process" })
      const link = within(list).getByRole("link", { name: /Weekly sync/ })
      expect(link.getAttribute("href")).toBe("/meetings/7")
      expect(link.textContent).toContain("3 actions")
      expect(within(list).getByRole("link", { name: /Kickoff/ }).textContent).toContain("1 action")
    })

    it("says so when no meeting has actions waiting", () => {
      renderPage()
      expect(screen.getByText(/No actions waiting from this week/)).toBeTruthy()
      expect(screen.queryByRole("list", { name: "Meetings to process" })).toBeNull()
    })

    it("weekly review: how long ago, highlighted only when it is due", () => {
      show({ days_since_review: 2 })
      const first = renderPage()
      expect(screen.getByText("Last review 2 days ago")).toBeTruthy()
      expect(screen.getByRole("link", { name: "Start weekly review" }).className).not.toContain("bg-accent ")
      first.unmount()

      show({ days_since_review: 9, last_review_date: "2026-10-20" })
      const second = renderPage()
      expect(screen.getByText("Last review 9 days ago").className).toContain("text-warn-fg")
      expect(screen.getByRole("link", { name: "Start weekly review" }).className).toContain("bg-accent")
      second.unmount()

      show({ days_since_review: null, last_review_date: null })
      renderPage()
      expect(screen.getByText("No review yet").className).toContain("text-warn-fg")
    })

    it("reviewed today and one day ago read naturally", () => {
      show({ days_since_review: 0 })
      const first = renderPage()
      expect(screen.getByText("Reviewed today")).toBeTruthy()
      first.unmount()
      show({ days_since_review: 1 })
      renderPage()
      expect(screen.getByText("Last review 1 day ago")).toBeTruthy()
    })
  })

  describe("waiting too long", () => {
    const waits = [
      { id: 5, title: "UAT sign-off", waiting_for: "Budi", waiting_days: 12, due_date: null, item_id: 3, item_title: "Migrate CML", item_type: "project" },
      { id: 6, title: "Room booking", waiting_for: "Sari", waiting_days: 8, due_date: null, item_id: 4, item_title: "Work", item_type: "area" },
      { id: 7, title: "Loose end", waiting_for: "Rudi", waiting_days: 7, due_date: null, item_id: null, item_title: null, item_type: null },
    ]

    it("shows who and how long, linking to the task in its project or area (Inbox for loose ones)", () => {
      show({ stale_waiting: waits, stale_waiting_total: 3 })
      renderPage()
      const list = screen.getByRole("list", { name: "Waiting for too long" })
      const [first, second, third] = within(list).getAllByRole("link")
      expect(first.textContent).toContain("UAT sign-off")
      expect(first.textContent).toContain("Waiting · Budi")
      expect(first.textContent).toContain("12 days")
      expect(first.getAttribute("href")).toBe("/projects/3?task=5")
      expect(second.getAttribute("href")).toBe("/areas/4?task=6")
      expect(third.getAttribute("href")).toBe("/inbox")
      expect(third.textContent).toContain("Inbox")
    })

    it("mentions how many more there are when the list is capped", () => {
      show({ stale_waiting: waits, stale_waiting_total: 14 })
      renderPage()
      expect(screen.getByText(/And 11 more/)).toBeTruthy()
      expect(screen.getByRole("link", { name: /Today → Waiting for/ }).getAttribute("href")).toBe("/today")
    })

    it("has no section when nothing waits too long", () => {
      renderPage()
      expect(screen.queryByRole("heading", { name: /Waiting too long/ })).toBeNull()
    })
  })

  describe("projects needing attention", () => {
    it("shows each problem as a chip, red for overdue and passed deadlines", () => {
      show({
        attention_projects: [
          project({ reasons: ["overdue_tasks", "deadline_passed", "stale", "no_open_tasks", "deadline_soon"], project_deadline: "2026-10-01", days_inactive: 45 }),
        ],
      })
      renderPage()
      const row = screen.getByRole("link", { name: /Migrate CML/ })
      expect(row.getAttribute("href")).toBe("/projects/1")
      expect(within(row).getByText("2 overdue tasks").className).toContain("danger")
      expect(within(row).getByText(/^Deadline passed/).className).toContain("danger")
      expect(within(row).getByText("No activity for 45 days").className).toContain("warn")
      expect(within(row).getByText("No open tasks").className).toContain("warn")
      expect(within(row).getByText(/^Due .*, 20% done$/).className).toContain("warn")
    })

    it("singular wording for one overdue task", () => {
      show({ attention_projects: [project({ overdue_task_count: 1 })] })
      renderPage()
      expect(screen.getByText("1 overdue task")).toBeTruthy()
    })

    it("shows at most eight and points to Projects for the rest", () => {
      show({ attention_projects: Array.from({ length: 11 }, (_, i) => project({ id: i + 1, title: `P${i + 1}` })) })
      renderPage()
      expect(within(screen.getByRole("list", { name: "Projects needing attention" })).getAllByRole("link")).toHaveLength(8)
      expect(screen.getByText(/And 3 more in/)).toBeTruthy()
    })

    it("has no section when every project is fine", () => {
      renderPage()
      expect(screen.queryByRole("heading", { name: /Projects needing attention/ })).toBeNull()
    })
  })

  describe("all clear", () => {
    it("says nothing needs attention when there is nothing to flag, and points to Today", () => {
      renderPage()
      expect(screen.getByText("Nothing needs your attention.")).toBeTruthy()
      expect(screen.getByText(/See Today for what to do now/)).toBeTruthy()
    })

    it("does not say so when something is flagged", () => {
      show({ attention_projects: [project()] })
      renderPage()
      expect(screen.queryByText("Nothing needs your attention.")).toBeNull()
    })
  })

  it("shortcuts show the counts and link to each list", () => {
    renderPage()
    const nav = screen.getByRole("navigation", { name: "Shortcuts" })
    const hrefs = Object.fromEntries(within(nav).getAllByRole("link").map((a) => [a.textContent, a.getAttribute("href")]))
    expect(hrefs).toEqual({
      "14 active projects": "/projects", "3 areas": "/areas", "1 resource": "/resources",
      "4 someday": "/someday", "2 archived": "/archive",
    })
  })
})
