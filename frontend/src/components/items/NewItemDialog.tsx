import { useState } from 'react'
import { Button } from '@/components/common/Button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { useCreateItem } from '@/hooks/useItems'
import { extractApiError } from '@/api/client'
import type { ItemType } from '@/types/models'
import { cn } from '@/lib/utils'

interface NewItemDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Pre-select a type (optional) */
  defaultType?: ItemType
  onCreated?: (id: number) => void
}

const TYPE_OPTIONS: { value: ItemType; label: string; description: string }[] = [
  { value: 'project', label: 'Project', description: 'Has tasks, deadline, and progress' },
  { value: 'area', label: 'Area', description: 'Ongoing responsibility to maintain' },
  { value: 'resource', label: 'Resource', description: 'Reference material or information' },
]

export function NewItemDialog({
  open,
  onOpenChange,
  defaultType = 'project',
  onCreated,
}: NewItemDialogProps) {
  const [type, setType] = useState<ItemType>(defaultType)
  const [title, setTitle] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const createItem = useCreateItem()

  function handleClose() {
    setTitle('')
    setErrors({})
    setType(defaultType)
    onOpenChange(false)
  }

  function validate(): boolean {
    const newErrors: Record<string, string> = {}
    if (!title.trim()) {
      newErrors.title = 'Title is required'
    } else if (title.trim().length > 200) {
      newErrors.title = 'Title must be 200 characters or less'
    }
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return
    try {
      const item = await createItem.mutateAsync({ type, title: title.trim() })
      onCreated?.(item.id)
      handleClose()
    } catch (err) {
      const apiErr = extractApiError(err)
      if (apiErr.fields) {
        // Show server validation errors inline under the relevant fields
        const newErrors: Record<string, string> = {}
        for (const [field, messages] of Object.entries(apiErr.fields)) {
          newErrors[field === '' ? 'title' : field] = messages[0] ?? 'Invalid'
        }
        setErrors(newErrors)
      }
      // notify.error is called by useCreateItem.onError for non-field errors
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New item</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} noValidate>
          {/* Type selection */}
          <fieldset className="mb-5">
            <legend className="text-sm font-semibold text-text mb-2">Type</legend>
            <div className="flex flex-col gap-2">
              {TYPE_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  className={cn(
                    'flex items-start gap-3 p-3 rounded-control border cursor-pointer',
                    'transition-colors duration-150',
                    type === opt.value
                      ? 'border-accent bg-accent-soft'
                      : 'border-border hover:bg-surface-2'
                  )}
                >
                  <input
                    type="radio"
                    name="type"
                    value={opt.value}
                    checked={type === opt.value}
                    onChange={() => setType(opt.value)}
                    className="mt-0.5 accent-[var(--accent)]"
                  />
                  <span>
                    <span className="text-sm font-medium text-text">{opt.label}</span>
                    <span className="block text-xs text-muted mt-0.5">{opt.description}</span>
                    {opt.value === 'project' && (
                      <span className="block text-xs text-muted mt-1 italic">
                        Start from template — coming soon
                      </span>
                    )}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          {/* Title field */}
          <div className="mb-5">
            <label htmlFor="new-item-title" className="block text-sm font-medium text-text mb-1.5">
              Title <span className="text-danger-fg" aria-hidden="true">*</span>
            </label>
            <input
              id="new-item-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
              maxLength={200}
              placeholder={`${TYPE_OPTIONS.find(o => o.value === type)?.label} title`}
              aria-required="true"
              aria-invalid={!!errors.title}
              aria-describedby={errors.title ? 'title-error' : undefined}
              className={cn(
                'w-full h-10 px-3 rounded-control border bg-surface text-text text-sm',
                'focus:outline-2 focus:outline-accent focus:outline-offset-0',
                'placeholder:text-muted',
                errors.title ? 'border-danger-fg' : 'border-border'
              )}
            />
            {errors.title && (
              <p id="title-error" role="alert" className="mt-1 text-xs text-danger-fg">
                {errors.title}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={handleClose}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={createItem.isPending}
            >
              {createItem.isPending ? 'Creating…' : `Create ${TYPE_OPTIONS.find(o => o.value === type)?.label.toLowerCase()}`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
