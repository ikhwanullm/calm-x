import { useState, useEffect } from "react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { linksApi } from "@/api/links"
import { useConvertItem } from "@/hooks/useLinks"
import type { ItemType } from "@/types/models"
import type { TypeConversionPreview } from "@/types/links"
import { cn } from "@/lib/utils"

interface TypeConversionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  itemId: number
  currentType: ItemType
}

const TYPE_LABELS: Record<string, string> = {
  project: "Project",
  area: "Area",
  resource: "Resource",
}

const OTHER_TYPES: Record<ItemType, ItemType[]> = {
  project: ["area", "resource"],
  area: ["project", "resource"],
  resource: ["project", "area"],
}

export function TypeConversionDialog({
  open,
  onOpenChange,
  itemId,
  currentType,
}: TypeConversionDialogProps) {
  const [targetType, setTargetType] = useState<string>(OTHER_TYPES[currentType][0])
  const [preview, setPreview] = useState<TypeConversionPreview | null>(null)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [projectGoal, setProjectGoal] = useState("")
  const [projectDeadline, setProjectDeadline] = useState("")
  const [maintenanceNotes, setMaintenanceNotes] = useState("")

  const convertItem = useConvertItem()

  // Fetch preview whenever targetType changes
  useEffect(() => {
    if (!open || !targetType) return
    setLoadingPreview(true)
    linksApi
      .previewConversion(itemId, targetType)
      .then((p) => setPreview(p))
      .finally(() => setLoadingPreview(false))
  }, [open, itemId, targetType])

  // Reset fields when dialog opens
  useEffect(() => {
    if (open) {
      setTargetType(OTHER_TYPES[currentType][0])
      setPreview(null)
      setProjectGoal("")
      setProjectDeadline("")
      setMaintenanceNotes("")
    }
  }, [open, currentType])

  function handleConfirm() {
    convertItem.mutate(
      {
        itemId,
        payload: {
          target_type: targetType,
          project_goal: targetType === "project" ? projectGoal || null : undefined,
          project_deadline: targetType === "project" ? projectDeadline || null : undefined,
          area_maintenance_notes:
            targetType === "area" ? maintenanceNotes || null : undefined,
        },
      },
      { onSuccess: () => onOpenChange(false) }
    )
  }

  const toResource = targetType === "resource"

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Convert {TYPE_LABELS[currentType]}</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3 mt-2">
              {/* Target type selector */}
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-text shrink-0">Convert to</label>
                <select
                  value={targetType}
                  onChange={(e) => setTargetType(e.target.value)}
                  aria-label="Target type"
                  className={cn(
                    "flex-1 h-9 px-3 rounded-control border border-border bg-surface text-sm text-text",
                    "focus:outline-2 focus:outline-offset-2 focus:outline-accent"
                  )}
                >
                  {OTHER_TYPES[currentType].map((t) => (
                    <option key={t} value={t}>
                      {TYPE_LABELS[t]}
                    </option>
                  ))}
                </select>
              </div>

              {/* Preview consequences */}
              {loadingPreview ? (
                <p className="text-sm text-muted">Loading preview…</p>
              ) : preview ? (
                <div className="rounded-control bg-surface-2 px-3 py-2 space-y-1 text-sm text-muted">
                  {toResource && preview.task_count > 0 && (
                    <p>
                      <span className="text-text font-medium">
                        {preview.task_count} task{preview.task_count !== 1 ? "s" : ""}
                      </span>{" "}
                      ({preview.open_task_count} open) will move to the Inbox.
                    </p>
                  )}
                  {!toResource && preview.task_count > 0 && (
                    <p>
                      <span className="text-text font-medium">{preview.task_count}</span> task
                      {preview.task_count !== 1 ? "s" : ""} will stay on this item.
                    </p>
                  )}
                  {preview.resource_link_count > 0 && (
                    <p className="text-warn-fg">
                      Links to{" "}
                      <span className="font-medium">{preview.resource_link_count}</span>{" "}
                      resource{preview.resource_link_count !== 1 ? "s" : ""} will be removed.
                    </p>
                  )}
                  {preview.resource_link_count === 0 && preview.task_count === 0 && (
                    <p>No data will be lost during this conversion.</p>
                  )}
                </div>
              ) : null}

              {/* Optional fields for Project */}
              {targetType === "project" && (
                <div className="space-y-2">
                  <input
                    type="text"
                    value={projectGoal}
                    onChange={(e) => setProjectGoal(e.target.value)}
                    placeholder="Project goal (optional)"
                    maxLength={500}
                    aria-label="Project goal"
                    className={cn(
                      "w-full h-9 px-3 rounded-control border border-border bg-surface text-sm text-text placeholder:text-muted",
                      "focus:outline-2 focus:outline-offset-2 focus:outline-accent"
                    )}
                  />
                  <input
                    type="date"
                    value={projectDeadline}
                    onChange={(e) => setProjectDeadline(e.target.value)}
                    aria-label="Project deadline"
                    className={cn(
                      "w-full h-9 px-3 rounded-control border border-border bg-surface text-sm text-text",
                      "focus:outline-2 focus:outline-offset-2 focus:outline-accent"
                    )}
                  />
                </div>
              )}

              {/* Optional field for Area */}
              {targetType === "area" && (
                <input
                  type="text"
                  value={maintenanceNotes}
                  onChange={(e) => setMaintenanceNotes(e.target.value)}
                  placeholder="Maintenance notes (optional)"
                  maxLength={1000}
                  aria-label="Maintenance notes"
                  className={cn(
                    "w-full h-9 px-3 rounded-control border border-border bg-surface text-sm text-text placeholder:text-muted",
                    "focus:outline-2 focus:outline-offset-2 focus:outline-accent"
                  )}
                />
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={convertItem.isPending || loadingPreview}
            className="bg-accent text-accent-fg hover:opacity-90"
          >
            {convertItem.isPending ? "Converting…" : `Convert to ${TYPE_LABELS[targetType]}`}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
