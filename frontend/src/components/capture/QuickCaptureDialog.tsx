import { useNavigate } from "react-router-dom"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Kbd } from "@/components/common"
import { CaptureBox, describeAdded } from "@/components/capture/CaptureBox"
import { notify } from "@/lib/toast"

interface QuickCaptureDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function QuickCaptureDialog({ open, onOpenChange }: QuickCaptureDialogProps) {
  const navigate = useNavigate()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg" aria-label="Quick capture">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">Quick capture</DialogTitle>
        </DialogHeader>
        <div className="mt-2">
          <CaptureBox
            inputLabel="Task title"
            submitLabel="Capture"
            autoFocus
            notifyAdded={(created) =>
              notify.success(describeAdded(created), {
                description: "Priority is Medium unless you add !high or !low.",
                ...(created.some((t) => t.item_id === null)
                  ? { action: { label: "View Inbox", onClick: () => navigate("/inbox") } }
                  : {}),
              })
            }
            onAdded={() => onOpenChange(false)}
          />
          <p className="mt-2 text-xs text-muted">
            Press <Kbd>Enter</Kbd> to capture, <Kbd>Shift</Kbd>+<Kbd>Enter</Kbd> for a new line.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
