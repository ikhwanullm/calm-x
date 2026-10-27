import { useRef, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Kbd } from "@/components/common"
import { useCreateTask } from "@/hooks/useTasks"
import { notify } from "@/lib/toast"
import { cn } from "@/lib/utils"

interface QuickCaptureDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function QuickCaptureDialog({ open, onOpenChange }: QuickCaptureDialogProps) {
  const [title, setTitle] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)
  const createTask = useCreateTask()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = title.trim()
    if (!trimmed) return
    createTask.mutate(
      { title: trimmed, priority: "medium" },
      {
        onSuccess: () => {
          notify.success("Added to Inbox", "Task captured with Medium priority.")
          setTitle("")
          onOpenChange(false)
        },
        onError: (err: Error) => {
          notify.error("Could not capture task.", err.message)
        },
      }
    )
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      setTitle("")
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) setTitle(""); onOpenChange(v) }}>
      <DialogContent
        className="sm:max-w-md"
        aria-label="Quick capture"
        onOpenAutoFocus={(e) => { e.preventDefault(); inputRef.current?.focus() }}
      >
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">Quick capture</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="mt-2">
          <input
            ref={inputRef}
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Task title?"
            maxLength={200}
            aria-label="Task title"
            className={cn(
              "w-full h-11 px-4 rounded-control border border-border bg-bg",
              "text-sm text-text placeholder:text-muted",
              "focus:outline-2 focus:outline-offset-2 focus:outline-accent"
            )}
          />
          <div className="flex items-center justify-between mt-3">
            <p className="text-xs text-muted">
              Saves to Inbox with Medium priority. Press <Kbd>Enter</Kbd> to capture.
            </p>
            <button
              type="submit"
              disabled={!title.trim() || createTask.isPending}
              className={cn(
                "h-9 px-4 rounded-control bg-accent text-accent-fg text-sm font-medium",
                "hover:opacity-90 disabled:opacity-50 transition-opacity"
              )}
            >
              {createTask.isPending ? "Capturing?" : "Capture"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
