import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import React from "react"
import { ShortcutHelp } from "../components/search/ShortcutHelp"

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient()
  return <MemoryRouter><QueryClientProvider client={qc}>{children}</QueryClientProvider></MemoryRouter>
}

describe("ShortcutHelp", () => {
  it("renders shortcut list when open", () => {
    render(<ShortcutHelp open onOpenChange={vi.fn()} />, { wrapper })
    expect(screen.getByRole("list", { name: "Keyboard shortcuts" })).toBeTruthy()
    expect(screen.getAllByText(/Q|Ctrl\+K|Escape|\?/).length).toBeGreaterThan(0)
  })

  it("calls onOpenChange(false) on Close button", async () => {
    const onChange = vi.fn()
    render(<ShortcutHelp open onOpenChange={onChange} />, { wrapper })
    const closeBtn = screen.getByRole("button", { name: /close/i })
    closeBtn.click()
    expect(onChange).toHaveBeenCalledWith(false)
  })

  it("does not render when closed", () => {
    render(<ShortcutHelp open={false} onOpenChange={vi.fn()} />, { wrapper })
    expect(screen.queryByRole("list", { name: "Keyboard shortcuts" })).toBeNull()
  })
})
