import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

vi.mock("../lib/toast", () => ({ notify: { success: vi.fn(), error: vi.fn() } }))

vi.mock("../api/links", () => ({
  linksApi: {
    listLinkedResources: vi.fn(),
    linkResource: vi.fn().mockResolvedValue({}),
    unlinkResource: vi.fn().mockResolvedValue({}),
  },
}))

vi.mock("../api/items", () => ({
  itemsApi: {
    list: vi.fn().mockResolvedValue([
      { id: 10, type: "resource", title: "Runbook" },
      { id: 11, type: "resource", title: "Vendor docs" },
    ]),
  },
}))

import { linksApi } from "../api/links"
import { itemsApi } from "../api/items"
import { LinkedResourcesSection } from "../components/items/LinkedResourcesSection"

function renderSection(isArchived = false) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <MemoryRouter>
      <QueryClientProvider client={qc}>
        <LinkedResourcesSection itemId={5} isArchived={isArchived} />
      </QueryClientProvider>
    </MemoryRouter>
  )
}

describe("LinkedResourcesSection", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(linksApi.listLinkedResources).mockResolvedValue([
      { id: 10, type: "resource", title: "Runbook", archived_at: null },
    ])
  })

  it("lists linked resources as links to the resource page", async () => {
    renderSection()
    const link = await screen.findByRole("link", { name: "Runbook" })
    expect(link.getAttribute("href")).toBe("/resources/10")
    expect(linksApi.listLinkedResources).toHaveBeenCalledWith(5)
    expect(itemsApi.list).toHaveBeenCalledWith({ type: "resource" })
  })

  it("offers only resources that are not linked yet", async () => {
    renderSection()
    const select = await screen.findByRole("combobox", { name: /link a resource/i })
    await waitFor(() =>
      expect([...select.querySelectorAll("option")].map((o) => o.textContent)).toEqual([
        "Link a resource…",
        "Vendor docs",
      ])
    )
  })

  it("links the chosen resource to this item", async () => {
    const user = userEvent.setup()
    renderSection()
    const select = await screen.findByRole("combobox", { name: /link a resource/i })
    await screen.findByRole("option", { name: "Vendor docs" })
    await user.selectOptions(select, "11")
    await waitFor(() => expect(linksApi.linkResource).toHaveBeenCalledWith(11, 5))
  })

  it("unlinks a resource from this item", async () => {
    const user = userEvent.setup()
    renderSection()
    await user.click(await screen.findByRole("button", { name: "Unlink Runbook" }))
    await waitFor(() => expect(linksApi.unlinkResource).toHaveBeenCalledWith(10, 5))
  })

  it("is read-only for archived items", async () => {
    renderSection(true)
    await screen.findByRole("link", { name: "Runbook" })
    expect(screen.queryByRole("combobox", { name: /link a resource/i })).toBeNull()
    expect(screen.queryByRole("button", { name: /unlink/i })).toBeNull()
  })

  it("shows an empty state when nothing is linked", async () => {
    vi.mocked(linksApi.listLinkedResources).mockResolvedValue([])
    renderSection()
    expect(await screen.findByText("No linked resources yet.")).toBeTruthy()
  })
})
