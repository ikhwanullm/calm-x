import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog"
import { Kbd } from "@/components/common"

const GLOBAL_SHORTCUTS = [
  { key: "Q", description: "Open Quick capture" },
  { key: "/", description: "Open command palette" },
  { key: "Ctrl+K", description: "Open command palette" },
  { key: "?", description: "Show shortcut list" },
  { key: "Esc", description: "Close dialog, drawer or palette" },
  { key: "Enter", description: "Activate focused element / submit form" },
]

const REVIEW_SHORTCUTS = [
  { key: "P", description: "Move to project (Inbox step)" },
  { key: "A", description: "Move to area (Inbox step)" },
  { key: "C", description: "Complete (Inbox step)" },
  { key: "D", description: "Delete (with confirmation)" },
  { key: "S", description: "Skip, keep in Inbox" },
  { key: "\u2192", description: "Go to next step" },
]

interface ShortcutHelpProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** If true, show review-specific shortcuts in addition to global ones */
  reviewMode?: boolean
}

export function ShortcutHelp({ open, onOpenChange, reviewMode = false }: ShortcutHelpProps) {
  const shortcuts = reviewMode
    ? [...GLOBAL_SHORTCUTS, ...REVIEW_SHORTCUTS]
    : GLOBAL_SHORTCUTS

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
        </DialogHeader>

        <ul className="space-y-2 mt-2" aria-label="Keyboard shortcuts">
          {shortcuts.map(({ key, description }) => (
            <li key={key} className="flex items-center justify-between gap-4">
              <span className="text-sm text-text">{description}</span>
              <Kbd>{key}</Kbd>
            </li>
          ))}
        </ul>

        <DialogFooter>
          <DialogClose asChild>
            <button
              type="button"
              className="h-9 px-4 rounded-control border border-border bg-surface text-text text-sm font-medium hover:bg-surface-2"
            >
              Close
            </button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
