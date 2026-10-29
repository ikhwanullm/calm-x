import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/common'
import { cn } from '@/lib/utils'
import type { MeetingActionLine, ProcessActionPayload, TaskPriority } from '@/types/models'

interface RowState {
  checked: boolean
  due_date: string
  priority: TaskPriority
}

const DEFAULT_ROW: RowState = { checked: true, due_date: '', priority: 'medium' }

export interface ProcessActionsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Open action lines, as the server found them in the saved notes. */
  actions: MeetingActionLine[]
  isPending: boolean
  onConfirm: (chosen: ProcessActionPayload[]) => void
}

/** Pick which action lines become tasks, with an optional due date and priority each. */
export function ProcessActionsDialog({ open, onOpenChange, actions, isPending, onConfirm }: ProcessActionsDialogProps) {
  const [rows, setRows] = useState<Record<number, RowState>>({})

  // Start with every line ticked each time the dialog opens
  useEffect(() => {
    if (open) setRows(Object.fromEntries(actions.map((a) => [a.line, { ...DEFAULT_ROW }])))
  }, [open, actions])

  const rowOf = (line: number): RowState => rows[line] ?? DEFAULT_ROW
  const patch = (line: number, change: Partial<RowState>) =>
    setRows((prev) => ({ ...prev, [line]: { ...rowOf(line), ...change } }))
  const chosen = actions.filter((a) => rowOf(a.line).checked)

  function handleConfirm() {
    onConfirm(
      chosen.map((a) => {
        const row = rowOf(a.line)
        return { line: a.line, text: a.text, due_date: row.due_date || null, priority: row.priority }
      })
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Process actions</DialogTitle>
          <DialogDescription>
            Tick the lines to turn into tasks in this project or area. Lines for someone else become
            Waiting-for tasks.
          </DialogDescription>
        </DialogHeader>

        {actions.length === 0 ? (
          <p className="text-sm text-muted">No open action lines. Write <code>[ ] something</code> or <code>@Name: something</code> in the notes.</p>
        ) : (
          <ul className="space-y-2" aria-label="Action lines">
            {actions.map((a) => {
              const row = rowOf(a.line)
              return (
                <li
                  key={a.line}
                  className={cn(
                    'flex flex-wrap items-center gap-2 p-2 rounded-control border border-border',
                    !row.checked && 'opacity-60'
                  )}
                >
                  <input
                    type="checkbox"
                    checked={row.checked}
                    onChange={(e) => patch(a.line, { checked: e.target.checked })}
                    aria-label={`Create task: ${a.text}`}
                    className="h-4 w-4 shrink-0 accent-[var(--accent)]"
                  />
                  <span className="flex-1 min-w-[10rem] text-sm text-text">
                    {a.text}
                    {a.kind === 'waiting' && (
                      <span className="ml-2 inline-flex items-center h-5 px-1.5 rounded-pill bg-surface-2 text-xs text-muted">
                        Waiting · {a.who}
                      </span>
                    )}
                  </span>
                  <input
                    type="date"
                    value={row.due_date}
                    onChange={(e) => patch(a.line, { due_date: e.target.value })}
                    disabled={!row.checked}
                    aria-label={`Due date for: ${a.text}`}
                    className="h-8 px-2 rounded-control border border-border bg-surface text-sm text-text"
                  />
                  <select
                    value={row.priority}
                    onChange={(e) => patch(a.line, { priority: e.target.value as TaskPriority })}
                    disabled={!row.checked}
                    aria-label={`Priority for: ${a.text}`}
                    className="h-8 px-2 rounded-control border border-border bg-surface text-sm text-text"
                  >
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </li>
              )
            })}
          </ul>
        )}

        <DialogFooter>
          <Button type="button" variant="secondary" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={handleConfirm}
            disabled={chosen.length === 0 || isPending}
          >
            Create {chosen.length} {chosen.length === 1 ? 'task' : 'tasks'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
