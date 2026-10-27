import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import React from "react"
import { TypeConversionDialog } from "../components/items/TypeConversionDialog"

vi.mock("../api/links", () => ({
  linksApi: {
    previewConversion: vi.fn().mockResolvedValue({
      current_type: "project",
      target_type: "area",
      task_count: 3,
      open_task_count: 2,
      resource_link_count: 0,
    }),
    convert: vi.fn().mockResolvedValue({ id: 1, type: "area", title: "P" }),
  },
}))

vi.mock("../hooks/useItems", () => ({ useItems: vi.fn(() => ({ data: [] })) }))
vi.mock("../hooks/useTasks", () => ({ taskKeys: { all: ["tasks"] } }))
vi.mock("../hooks/useDashboard", () => ({ dashboardKeys: { all: ["dashboard"] } }))

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return (
    <MemoryRouter>
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    </MemoryRouter>
  )
}

describe("TypeConversionDialog", () => {
  beforeEach(() => vi.clearAllMocks())

  it("renders when open", () => {
    render(
      <TypeConversionDialog open onOpenChange={vi.fn()} itemId={1} currentType="project" />,
      { wrapper }
    )
    expect(screen.getByText("Convert Project")).toBeTruthy()
  })

  it("shows target type selector with other types", () => {
    render(
      <TypeConversionDialog open onOpenChange={vi.fn()} itemId={1} currentType="project" />,
      { wrapper }
    )
    const sel = screen.getByLabelText("Target type") as HTMLSelectElement
    const options = Array.from(sel.options).map((o) => o.value)
    expect(options).toContain("area")
    expect(options).toContain("resource")
  })

  it("fetches preview when opened", async () => {
    const { linksApi } = await import("../api/links")
    render(
      <TypeConversionDialog open onOpenChange={vi.fn()} itemId={1} currentType="project" />,
      { wrapper }
    )
    await waitFor(() => expect(vi.mocked(linksApi.previewConversion)).toHaveBeenCalledWith(1, "area"))
  })

  it("calls linksApi.convert with correct payload on confirm", async () => {
    const user = userEvent.setup()
    const { linksApi } = await import("../api/links")
    render(
      <TypeConversionDialog open onOpenChange={vi.fn()} itemId={1} currentType="project" />,
      { wrapper }
    )
    const btn = await screen.findByRole("button", { name: /Convert to Area/i }, { timeout: 3000 })
    await user.click(btn)
    await waitFor(() =>
      expect(vi.mocked(linksApi.convert)).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ target_type: "area" })
      )
    )
  })
})
