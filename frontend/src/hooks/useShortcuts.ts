import { useEffect } from "react"

type KeyHandler = () => void

/** Map of key -> handler.  Use "ctrl+k" for Ctrl/Cmd+K. */
export type ShortcutMap = Partial<Record<string, KeyHandler>>

const EDITABLE_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT"])

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (EDITABLE_TAGS.has(target.tagName)) return true
  if ((target as HTMLElement).isContentEditable) return true
  return false
}

/**
 * Register keyboard shortcuts.
 * Shortcuts are ignored when focus is inside an input, textarea,
 * select, or contenteditable element (ui-guidelines §8).
 */
export function useShortcuts(shortcuts: ShortcutMap): void {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (isEditableTarget(e.target)) return

      // Ctrl / Cmd + K
      if ((e.metaKey || e.ctrlKey) && !e.altKey && e.key.toLowerCase() === "k") {
        const handler = shortcuts["ctrl+k"]
        if (handler) {
          e.preventDefault()
          handler()
        }
        return
      }

      // Block other combinations with modifier keys
      if (e.metaKey || e.ctrlKey || e.altKey) return

      // Match case-insensitively for letter keys (e.g. "Q" and "q" fire the same handler)
      const handler = shortcuts[e.key] ?? shortcuts[e.key.toUpperCase()]
      if (handler) {
        e.preventDefault()
        handler()
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [shortcuts])
}
