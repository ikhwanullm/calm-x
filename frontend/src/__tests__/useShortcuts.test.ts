import { describe, it, expect, vi } from "vitest"
import { renderHook } from "@testing-library/react"
import { useShortcuts } from "../hooks/useShortcuts"

function fireKey(key: string, opts: KeyboardEventInit = {}) {
  document.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, ...opts }))
}

describe("useShortcuts", () => {
  it("calls handler for registered key", () => {
    const handler = vi.fn()
    renderHook(() => useShortcuts({ Q: handler }))
    fireKey("Q")
    expect(handler).toHaveBeenCalledOnce()
  })

  it("ignores events from INPUT elements", () => {
    const handler = vi.fn()
    renderHook(() => useShortcuts({ Q: handler }))
    const input = document.createElement("input")
    document.body.appendChild(input)
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Q", bubbles: true }))
    expect(handler).not.toHaveBeenCalled()
    document.body.removeChild(input)
  })

  it("ignores events from TEXTAREA elements", () => {
    const handler = vi.fn()
    renderHook(() => useShortcuts({ Q: handler }))
    const ta = document.createElement("textarea")
    document.body.appendChild(ta)
    ta.dispatchEvent(new KeyboardEvent("keydown", { key: "Q", bubbles: true }))
    expect(handler).not.toHaveBeenCalled()
    document.body.removeChild(ta)
  })

  it("handles ctrl+k shortcut", () => {
    const handler = vi.fn()
    renderHook(() => useShortcuts({ "ctrl+k": handler }))
    fireKey("k", { ctrlKey: true })
    expect(handler).toHaveBeenCalledOnce()
  })

  it("does not call handler when modifier key is held (except ctrl+k)", () => {
    const handler = vi.fn()
    renderHook(() => useShortcuts({ Q: handler }))
    fireKey("Q", { ctrlKey: true })
    expect(handler).not.toHaveBeenCalled()
  })
})
