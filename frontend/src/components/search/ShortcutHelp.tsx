import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogFooter,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog"
import { Kbd } from "@/components/common"

const SHORTCUTS = [
  { key: "Q", description: "Open Quick capture" },
  { key: "/", description: "Open command palette" },
  { key: "Ctrl+K", description: "Open command palette" },
  { key: "?", description: "Show shortcut list" },
  { key: "Esc", description: "Close dialog, drawer or palette" },
  { key: "Enter", description: "Activate focused element / submit form" },
]

interface ShortcutHelpProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ShortcutHelp({ open, onOpenChange }: ShortcutHelpProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="sm:max-w-sm">
        <AlertDialogHeader>
          <AlertDialogTitle>Keyboard shortcuts</AlertDialogTitle>
        </AlertDialogHeader>

        <ul className="space-y-2 mt-2" aria-label="Keyboard shortcuts">
          {SHORTCUTS.map(({ key, description }) => (
            <li key={key} className="flex items-center justify-between gap-4">
              <span className="text-sm text-text">{description}</span>
              <Kbd>{key}</Kbd>
            </li>
          ))}
        </ul>

        <AlertDialogFooter>
          <AlertDialogCancel>Close</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
