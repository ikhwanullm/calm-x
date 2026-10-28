import { useState, useEffect } from 'react'
import { format, addDays, parseISO } from 'date-fns'
import { Button } from '@/components/common/Button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { useCreateItem } from '@/hooks/useItems'
import { useTemplates, useTemplate, useCreateProjectFromTemplate } from '@/hooks/useTemplates'
import { extractApiError } from '@/api/client'
import type { ItemType } from '@/types/models'
import { cn } from '@/lib/utils'
import { getLocalToday } from '@/utils/date'

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

type ProjectMode = 'blank' | 'template'

export function NewItemDialog({
  open,
  onOpenChange,
  defaultType = 'project',
  onCreated,
}: NewItemDialogProps) {
  const [type, setType] = useState<ItemType>(defaultType)
  const [title, setTitle] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Project-specific state for blank projects
  const [projectGoal, setProjectGoal] = useState('')
  const [projectDeadline, setProjectDeadline] = useState('')

  // Project-specific state for templates
  const [projectMode, setProjectMode] = useState<ProjectMode>('blank')
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null)
  const [startDate, setStartDate] = useState(getLocalToday())

  const createItem = useCreateItem()
  const createFromTemplate = useCreateProjectFromTemplate()
  const { data: templates } = useTemplates()
  const { data: selectedTemplate } = useTemplate(selectedTemplateId ?? 0)

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setType(defaultType)
      setTitle('')
      setErrors({})
      setProjectGoal('')
      setProjectDeadline('')
      setProjectMode('blank')
      setSelectedTemplateId(null)
      setStartDate(getLocalToday())
    }
  }, [open, defaultType])

  // Auto-fill title from template when selected
  useEffect(() => {
    if (selectedTemplate && !title) {
      setTitle(selectedTemplate.title)
    }
  }, [selectedTemplate]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleClose() {
    setTitle('')
    setErrors({})
    setType(defaultType)
    setProjectGoal('')
    setProjectDeadline('')
    setProjectMode('blank')
    setSelectedTemplateId(null)
    setStartDate(getLocalToday())
    onOpenChange(false)
  }

  function validate(): boolean {
    const newErrors: Record<string, string> = {}
    if (!title.trim()) {
      newErrors.title = 'Title is required'
    } else if (title.trim().length > 200) {
      newErrors.title = 'Title must be 200 characters or less'
    }
    if (type === 'project' && projectMode === 'template' && !selectedTemplateId) {
      newErrors.template = 'Select a template'
    }
    if (type === 'project' && projectDeadline) {
      const d = new Date(projectDeadline)
      if (isNaN(d.getTime())) {
        newErrors.projectDeadline = 'Enter a valid date'
      }
    }
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return

    try {
      if (type === 'project' && projectMode === 'template' && selectedTemplateId) {
        // Create from template
        const project = await createFromTemplate.mutateAsync({
          templateId: selectedTemplateId,
          payload: {
            title: title.trim(),
            start_date: startDate,
            project_goal: projectGoal.trim() || undefined,
            project_deadline: projectDeadline || undefined,
          },
        })
        onCreated?.(project.id)
      } else {
        // Create blank item (project_goal and project_deadline only for projects)
        const item = await createItem.mutateAsync({
          type,
          title: title.trim(),
          ...(type === 'project' && {
            project_goal: projectGoal.trim() || undefined,
            project_deadline: projectDeadline || undefined,
          }),
        })
        onCreated?.(item.id)
      }
      handleClose()
    } catch (err) {
      const apiErr = extractApiError(err)
      if (apiErr.fields) {
        const newErrors: Record<string, string> = {}
        for (const [field, messages] of Object.entries(apiErr.fields)) {
          newErrors[field === '' ? 'title' : field] = messages[0] ?? 'Invalid'
        }
        setErrors(newErrors)
      }
    }
  }

  const isPending = createItem.isPending || createFromTemplate.isPending
  const hasTemplates = templates && templates.length > 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
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
                    onChange={() => {
                      setType(opt.value)
                      // Reset template mode when switching away from project
                      if (opt.value !== 'project') {
                        setProjectMode('blank')
                        setSelectedTemplateId(null)
                      }
                    }}
                    className="mt-0.5 accent-[var(--accent)]"
                  />
                  <span>
                    <span className="text-sm font-medium text-text">{opt.label}</span>
                    <span className="block text-xs text-muted mt-0.5">{opt.description}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          {/* Project mode selection (only when Project is selected) */}
          {type === 'project' && (
            <fieldset className="mb-5">
              <legend className="text-sm font-semibold text-text mb-2">Start from</legend>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setProjectMode('blank')
                    setSelectedTemplateId(null)
                    setTitle('')
                  }}
                  className={cn(
                    'flex-1 py-2 px-3 rounded-control border text-sm font-medium',
                    'transition-colors duration-150',
                    projectMode === 'blank'
                      ? 'border-accent bg-accent-soft text-accent-text'
                      : 'border-border text-muted hover:bg-surface-2'
                  )}
                >
                  Blank project
                </button>
                <button
                  type="button"
                  onClick={() => setProjectMode('template')}
                  disabled={!hasTemplates}
                  className={cn(
                    'flex-1 py-2 px-3 rounded-control border text-sm font-medium',
                    'transition-colors duration-150',
                    projectMode === 'template'
                      ? 'border-accent bg-accent-soft text-accent-text'
                      : 'border-border text-muted hover:bg-surface-2',
                    !hasTemplates && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  From template {!hasTemplates && '(none available)'}
                </button>
              </div>
            </fieldset>
          )}

          {/* Template selection (when mode is template) */}
          {type === 'project' && projectMode === 'template' && hasTemplates && (
            <div className="mb-5">
              <label htmlFor="template-select" className="block text-sm font-medium text-text mb-1.5">
                Template <span className="text-danger-fg" aria-hidden="true">*</span>
              </label>
              <select
                id="template-select"
                value={selectedTemplateId ?? ''}
                onChange={(e) => {
                  const id = e.target.value ? Number(e.target.value) : null
                  setSelectedTemplateId(id)
                  // Clear title when template changes so it auto-fills
                  if (id) setTitle('')
                }}
                aria-invalid={!!errors.template}
                className={cn(
                  'w-full h-10 px-3 rounded-control border bg-surface text-text text-sm',
                  'focus:outline-2 focus:outline-accent focus:outline-offset-0',
                  errors.template ? 'border-danger-fg' : 'border-border'
                )}
              >
                <option value="">Select a template...</option>
                {templates?.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title} ({t.task_count} tasks)
                  </option>
                ))}
              </select>
              {errors.template && (
                <p role="alert" className="mt-1 text-xs text-danger-fg">
                  {errors.template}
                </p>
              )}
            </div>
          )}

          {/* Start date (when using template) */}
          {type === 'project' && projectMode === 'template' && selectedTemplateId && (
            <div className="mb-5">
              <label htmlFor="start-date" className="block text-sm font-medium text-text mb-1.5">
                Start date
              </label>
              <input
                id="start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                aria-label="Project start date"
                className={cn(
                  'w-full h-10 px-3 rounded-control border border-border bg-surface text-text text-sm',
                  'focus:outline-2 focus:outline-accent focus:outline-offset-0'
                )}
              />
              <p className="mt-1 text-xs text-muted">
                Task due dates will be calculated from this date
              </p>
            </div>
          )}

          {/* Live preview of due dates */}
          {type === 'project' && projectMode === 'template' && selectedTemplate && selectedTemplate.tasks.length > 0 && (
            <div className="mb-5 p-3 rounded-control bg-surface-2 border border-border">
              <p className="text-xs font-medium text-text mb-2">Task preview</p>
              <ul className="space-y-1.5 max-h-32 overflow-y-auto">
                {selectedTemplate.tasks.slice(0, 5).map((task) => {
                  const dueDate = addDays(parseISO(startDate), task.relative_days)
                  return (
                    <li key={task.id} className="flex items-center justify-between text-xs">
                      <span className="text-muted truncate mr-2">{task.title}</span>
                      <span className="text-text shrink-0">{format(dueDate, 'MMM d, yyyy')}</span>
                    </li>
                  )
                })}
                {selectedTemplate.tasks.length > 5 && (
                  <li className="text-xs text-muted">
                    + {selectedTemplate.tasks.length - 5} more tasks
                  </li>
                )}
              </ul>
            </div>
          )}

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

          {/* Project-specific fields: Goal + Deadline */}
          {type === 'project' && (
            <>
              <div className="mb-5">
                <label htmlFor="project-goal" className="block text-sm font-medium text-text mb-1.5">
                  Goal <span className="font-normal text-muted">(optional)</span>
                </label>
                <input
                  id="project-goal"
                  type="text"
                  value={projectGoal}
                  onChange={(e) => setProjectGoal(e.target.value)}
                  maxLength={500}
                  placeholder="What does success look like?"
                  className={cn(
                    'w-full h-10 px-3 rounded-control border border-border bg-surface text-text text-sm',
                    'focus:outline-2 focus:outline-accent focus:outline-offset-0',
                    'placeholder:text-muted'
                  )}
                />
              </div>

              <div className="mb-5">
                <label htmlFor="project-deadline" className="block text-sm font-medium text-text mb-1.5">
                  Deadline <span className="font-normal text-muted">(optional)</span>
                </label>
                <input
                  id="project-deadline"
                  type="date"
                  value={projectDeadline}
                  onChange={(e) => {
                    setProjectDeadline(e.target.value)
                    if (errors.projectDeadline) setErrors(prev => ({ ...prev, projectDeadline: '' }))
                  }}
                  aria-label="Project deadline"
                  aria-invalid={!!errors.projectDeadline}
                  aria-describedby={errors.projectDeadline ? 'deadline-error' : undefined}
                  className={cn(
                    'w-full h-10 px-3 rounded-control border bg-surface text-text text-sm',
                    'focus:outline-2 focus:outline-accent focus:outline-offset-0',
                    errors.projectDeadline ? 'border-danger-fg' : 'border-border'
                  )}
                />
                {errors.projectDeadline && (
                  <p id="deadline-error" role="alert" className="mt-1 text-xs text-danger-fg">
                    {errors.projectDeadline}
                  </p>
                )}
              </div>
            </>
          )}

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
              disabled={isPending}
            >
              {isPending ? 'Creating…' : `Create ${TYPE_OPTIONS.find(o => o.value === type)?.label.toLowerCase()}`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
