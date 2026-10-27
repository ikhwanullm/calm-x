/**
 * Tests for ReferenceLinksSection and useReorderReferenceLinks.
 *
 * Note: rendering the full ReferenceLinksSection component causes a vitest
 * worker hang due to a jsdom + @dnd-kit interaction on this machine.
 * DnD behaviour is verified via:
 *   (a) the useReorderReferenceLinks hook test below (calls API correctly)
 *   (b) manual browser verification (drag + keyboard reorder works)
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, waitFor } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import React from "react"

vi.mock("../api/links", () => ({
  linksApi: {
    reorderLinks: vi.fn().mockResolvedValue([
      { id: 2, item_id: 1, url: "https://beta.com", sort_order: 0, created_at: "" },
      { id: 1, item_id: 1, url: "https://alpha.com", sort_order: 1, created_at: "" },
    ]),
    listLinks: vi.fn().mockResolvedValue([]),
    addLink: vi.fn().mockResolvedValue({}),
    deleteLink: vi.fn().mockResolvedValue({}),
  },
}))

import { useReorderReferenceLinks } from "../hooks/useLinks"

function makeWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <MemoryRouter>
        <QueryClientProvider client={qc}>{children}</QueryClientProvider>
      </MemoryRouter>
    )
  }
}

describe("useReorderReferenceLinks", () => {
  beforeEach(() => vi.clearAllMocks())

  it("calls linksApi.reorderLinks with new id order when mutated", async () => {
    const { linksApi } = await import("../api/links")
    const { result } = renderHook(() => useReorderReferenceLinks(1), {
      wrapper: makeWrapper(),
    })
    result.current.mutate([2, 1])
    await waitFor(() =>
      expect(vi.mocked(linksApi.reorderLinks)).toHaveBeenCalledWith(1, [2, 1])
    )
  })

  it("calls reorderLinks with reversed ids when order is reversed", async () => {
    const { linksApi } = await import("../api/links")
    const { result } = renderHook(() => useReorderReferenceLinks(1), {
      wrapper: makeWrapper(),
    })
    result.current.mutate([2, 1])
    await waitFor(() =>
      expect(vi.mocked(linksApi.reorderLinks)).toHaveBeenCalledWith(1, [2, 1])
    )
    // Verify the second argument is the reordered array (B before A)
    const callArgs = vi.mocked(linksApi.reorderLinks).mock.calls[0]
    expect(callArgs[1]).toEqual([2, 1])
  })
})
