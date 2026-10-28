import { useState, useEffect } from 'react'
import { Button } from '@/components/common/Button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import type { Priority } from '@/types/models'

interface TemplateTaskDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: 'create' | 'edit'
  initialTitle?: string
  initialDescription?: string
  initialPriority?: Priority
  initialRelativeDays?: number
  onSave: (title: string, description: string, priority: Priority, relativeDays: number) => Promise<void>
  isPending: boolean
}

const PRIORITY_OPTIONS: { value: Priority; label: string }[] = [
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
]

export function TemplateTaskDialog({
  open,
  onOpenChange,
  mode,
  initialTitle = '',
  initialDescription = '',
  initialPriority = 'medium',
  initialRelativeDays = 0,
  onSave,
  isPending,
}: TemplateTaskDialogProps) {
  const [title, setTitle] = useState(initialTitle)
  const [description, setDescription] = useState(initialDescription)
  const [priority, setPriority] = useState<Priority>(initialPriority)
  const [relativeDays, setRelativeDays] = useState(initialRelativeDays)
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Reset form when dialog opens or initial values change
  useEffect(() => {
    if (open) {
      setTitle(initialTitle)
      setDescription(initialDescription)
      setPriority(initialPriority)
      setRelativeDays(initialRelativeDays)
      setErrors({})
    }
  }, [open, initialTitle, initialDescription, initialPriority, initialRelativeDays])

  function handleClose() {
    setTitle('')
    setDescription('')
    setPriority('medium')
    setRelativeDays(0)
    setErrors({})
    onOpenChange(false)
  }

  function validate(): boolean {
    const newErrors: Record<string, string> = {}
    if (!title.trim()) {
      newErrors.title = 'Title is required'
    } else if (title.trim().length > 200) {
      newErrors.title = 'Title must be 200 characters or less'
    }
    if (description.length > 5000) {
      newErrors.description = 'Description must be 5000 characters or less'
    }
    if (relativeDays < 0 || relativeDays > 365) {
      newErrors.relativeDays = 'Day offset must be between 0 and 365'
    }
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return
    try {
      await onSave(title.trim(), description.trim(), priority, relativeDays)
      handleClose()
    } catch {
      // Errors handled in parent
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>
            {mode === 'create' ? 'Add task to template' : 'Edit task'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {/* Title field */}
          <div>
            <label htmlFor="task-title" className="block text-sm font-medium text-text mb-1.5">
              Title
            </label>
            <input
              id="task-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Define requirements"
              autoFocus
              className={cn(
                'w-full h-10 px-3 rounded-control border bg-surface text-text text-sm',
                'focus:outline-2 focus:outline-accent focus:outline-offset-0',
                'placeholder:text-muted',
                errors.title ? 'border-danger-fg' : 'border-border'
              )}
            />
            {errors.title && (
              <p className="mt-1 text-xs text-danger-fg">{errors.title}</p>
            )}
          </div>

          {/* Description field */}
          <div>
            <label htmlFor="task-description" className="block text-sm font-medium text-text mb-1.5">
              Description <span className="font-normal text-muted">(optional)</span>
            </label>
            <textarea
              id="task-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What needs to be done?"
              rows={2}
              className={cn(
                'w-full px-3 py-2 rounded-control border bg-surface text-text text-sm resize-none',
                'focus:outline-2 focus:outline-accent focus:outline-offset-0',
                'placeholder:text-muted',
                errors.description ? 'border-danger-fg' : 'border-border'
              )}
            />
            {errors.description && (
              <p className="mt-1 text-xs text-danger-fg">{errors.description}</p>
            )}
          </div>

          {/* Priority and Relative Days row */}
          <div className="grid grid-cols-2 gap-4">
            {/* Priority */}
            <div>
              <label htmlFor="task-priority" className="block text-sm font-medium text-text mb-1.5">
                Priority
              </label>
              <select
                id="task-priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value as Priority)}
                className={cn(
                  'w-full h-10 px-3 rounded-control border border-border bg-surface text-text text-sm',
                  'focus:outline-2 focus:outline-accent focus:outline-offset-0'
                )}
              >
                {PRIORITY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Relative days */}
            <div>
              <label htmlFor="task-relative-days" className="block text-sm font-medium text-text mb-1.5">
                Day offset
              </label>
              <input
                id="task-relative-days"
                type="number"
                min={0}
                max={365}
                value={relativeDays}
                onChange={(e) => setRelativeDays(Math.max(0, Math.min(365, parseInt(e.target.value) || 0)))}
                className={cn(
                  'w-full h-10 px-3 rounded-control border bg-surface text-text text-sm',
                  'focus:outline-2 focus:outline-accent focus:outline-offset-0',
                  errors.relativeDays ? 'border-danger-fg' : 'border-border'
                )}
              />
              {errors.relativeDays ? (
                <p className="mt-1 text-xs text-danger-fg">{errors.relativeDays}</p>
              ) : (
                <p className="mt-1 text-xs text-muted">
                  Days after project start date (0-365)
                </p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="secondary" type="button" onClick={handleClose}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" disabled={isPending}>
              {isPending
                ? (mode === 'create' ? 'Adding...' : 'Saving...')
                : (mode === 'create' ? 'Add task' : 'Save changes')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
