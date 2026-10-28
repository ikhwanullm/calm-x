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

interface TemplateEditorDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: 'create' | 'edit'
  initialTitle?: string
  initialDescription?: string
  onSave: (title: string, description: string) => Promise<void>
  isPending: boolean
}

export function TemplateEditorDialog({
  open,
  onOpenChange,
  mode,
  initialTitle = '',
  initialDescription = '',
  onSave,
  isPending,
}: TemplateEditorDialogProps) {
  const [title, setTitle] = useState(initialTitle)
  const [description, setDescription] = useState(initialDescription)
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Reset form when dialog opens or initial values change
  useEffect(() => {
    if (open) {
      setTitle(initialTitle)
      setDescription(initialDescription)
      setErrors({})
    }
  }, [open, initialTitle, initialDescription])

  function handleClose() {
    setTitle('')
    setDescription('')
    setErrors({})
    onOpenChange(false)
  }

  function validate(): boolean {
    const newErrors: Record<string, string> = {}
    if (!title.trim()) {
      newErrors.title = 'Title is required'
    } else if (title.trim().length > 100) {
      newErrors.title = 'Title must be 100 characters or less'
    }
    if (description.length > 500) {
      newErrors.description = 'Description must be 500 characters or less'
    }
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return
    try {
      await onSave(title.trim(), description.trim())
      handleClose()
    } catch {
      // Errors handled in parent
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>
            {mode === 'create' ? 'New template' : 'Edit template'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {/* Title field */}
          <div>
            <label htmlFor="template-title" className="block text-sm font-medium text-text mb-1.5">
              Title
            </label>
            <input
              id="template-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Sprint kickoff"
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
            <label htmlFor="template-description" className="block text-sm font-medium text-text mb-1.5">
              Description <span className="font-normal text-muted">(optional)</span>
            </label>
            <textarea
              id="template-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this template for?"
              rows={3}
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

          <DialogFooter>
            <Button variant="secondary" type="button" onClick={handleClose}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" disabled={isPending}>
              {isPending
                ? (mode === 'create' ? 'Creating...' : 'Saving...')
                : (mode === 'create' ? 'Create template' : 'Save changes')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
