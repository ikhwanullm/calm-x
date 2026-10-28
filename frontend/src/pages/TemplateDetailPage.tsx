import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  FileText,
  ChevronLeft,
  Plus,
  GripVertical,
  Pencil,
  Trash2,
  MoreHorizontal,
} from 'lucide-react'
import {
  useTemplate,
  useUpdateTemplate,
  useDeleteTemplate,
  useCreateTemplateTask,
  useUpdateTemplateTask,
  useDeleteTemplateTask,
  useReorderTemplateTasks,
} from '@/hooks/useTemplates'
import {
  Card,
  EmptyState,
  ConfirmDialog,
  Skeleton,
  SkeletonGroup,
  PriorityChip,
} from '@/components/common'
import { TemplateTaskDialog } from '@/components/templates/TemplateTaskDialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { cn } from '@/lib/utils'
import type { TemplateTask, Priority } from '@/types/models'

export default function TemplateDetailPage() {
  const { id } = useParams<{ id: string }>()
  const templateId = Number(id)
  const navigate = useNavigate()

  const { data: template, isLoading, isError } = useTemplate(templateId)
  const updateTemplateMutation = useUpdateTemplate()
  const deleteTemplateMutation = useDeleteTemplate()
  const createTaskMutation = useCreateTemplateTask()
  const updateTaskMutation = useUpdateTemplateTask()
  const deleteTaskMutation = useDeleteTemplateTask()
  const reorderTasksMutation = useReorderTemplateTasks()

  // Dialog states
  const [showAddTaskDialog, setShowAddTaskDialog] = useState(false)
  const [editingTask, setEditingTask] = useState<TemplateTask | null>(null)
  const [deleteDialogTask, setDeleteDialogTask] = useState<TemplateTask | null>(null)
  const [deleteDialogTemplate, setDeleteDialogTemplate] = useState(false)

  // Inline editing for template title/description
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [editedTitle, setEditedTitle] = useState('')
  const [isEditingDescription, setIsEditingDescription] = useState(false)
  const [editedDescription, setEditedDescription] = useState('')

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // Handle drag end for reordering tasks
  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id || !template) return

    const oldIndex = template.tasks.findIndex((t) => t.id === active.id)
    const newIndex = template.tasks.findIndex((t) => t.id === over.id)

    if (oldIndex !== -1 && newIndex !== -1) {
      const newOrder = arrayMove(template.tasks, oldIndex, newIndex)
      reorderTasksMutation.mutate({
        templateId,
        taskIds: newOrder.map((t) => t.id),
      })
    }
  }

  // Inline edit handlers
  async function handleSaveTitle() {
    if (!template || !editedTitle.trim()) return
    await updateTemplateMutation.mutateAsync({
      id: templateId,
      payload: { title: editedTitle.trim() },
    })
    setIsEditingTitle(false)
  }

  async function handleSaveDescription() {
    if (!template) return
    await updateTemplateMutation.mutateAsync({
      id: templateId,
      payload: { description: editedDescription.trim() },
    })
    setIsEditingDescription(false)
  }

  // Task CRUD handlers
  async function handleCreateTask(
    title: string,
    description: string,
    priority: Priority,
    relativeDays: number
  ) {
    await createTaskMutation.mutateAsync({
      templateId,
      payload: { title, description, priority, relative_days: relativeDays },
    })
    setShowAddTaskDialog(false)
  }

  async function handleUpdateTask(
    title: string,
    description: string,
    priority: Priority,
    relativeDays: number
  ) {
    if (!editingTask) return
    await updateTaskMutation.mutateAsync({
      taskId: editingTask.id,
      payload: { title, description, priority, relative_days: relativeDays },
    })
    setEditingTask(null)
  }

  async function handleConfirmDeleteTask() {
    if (!deleteDialogTask) return
    await deleteTaskMutation.mutateAsync({
      taskId: deleteDialogTask.id,
      templateId,
    })
    setDeleteDialogTask(null)
  }

  async function handleDeleteTemplate() {
    await deleteTemplateMutation.mutateAsync(templateId)
    navigate('/templates')
  }

  if (isLoading) {
    return (
      <div>
        <SkeletonGroup label="Loading template">
          <Skeleton className="h-8 w-64 mb-4" delay={0} />
          <Skeleton className="h-4 w-96 mb-8" delay={0} />
          <Skeleton className="h-16 w-full mb-3" delay={0} />
          <Skeleton className="h-16 w-full mb-3" delay={0} />
        </SkeletonGroup>
      </div>
    )
  }

  if (isError || !template) {
    return (
      <div>
        <Link
          to="/templates"
          className="inline-flex items-center gap-1 text-sm text-muted hover:text-text mb-4"
        >
          <ChevronLeft size={16} strokeWidth={1.75} aria-hidden="true" />
          Back to templates
        </Link>
        <p className="text-sm text-danger-fg">
          Couldn&apos;t load template. Check that the server is running and try again.
        </p>
      </div>
    )
  }

  return (
    <div>
      {/* Back link */}
      <Link
        to="/templates"
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-text mb-4"
      >
        <ChevronLeft size={16} strokeWidth={1.75} aria-hidden="true" />
        Back to templates
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="flex-1 min-w-0">
          {/* Title - inline editable */}
          {isEditingTitle ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={editedTitle}
                onChange={(e) => setEditedTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveTitle()
                  if (e.key === 'Escape') setIsEditingTitle(false)
                }}
                autoFocus
                className={cn(
                  'text-2xl font-semibold text-text bg-transparent border-b-2 border-accent',
                  'focus:outline-none'
                )}
              />
              <button
                type="button"
                onClick={handleSaveTitle}
                className="text-xs text-accent-text hover:underline"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => setIsEditingTitle(false)}
                className="text-xs text-muted hover:underline"
              >
                Cancel
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <FileText size={24} strokeWidth={1.75} className="text-muted" aria-hidden="true" />
              <h1
                className="text-2xl font-semibold text-text cursor-pointer hover:text-accent-text"
                onClick={() => {
                  setEditedTitle(template.title)
                  setIsEditingTitle(true)
                }}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    setEditedTitle(template.title)
                    setIsEditingTitle(true)
                  }
                }}
              >
                {template.title}
              </h1>
            </div>
          )}

          {/* Description - inline editable */}
          {isEditingDescription ? (
            <div className="mt-2">
              <textarea
                value={editedDescription}
                onChange={(e) => setEditedDescription(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') setIsEditingDescription(false)
                }}
                rows={2}
                autoFocus
                className={cn(
                  'w-full text-sm text-muted bg-transparent border border-border rounded-control p-2',
                  'focus:outline-2 focus:outline-accent'
                )}
              />
              <div className="flex gap-2 mt-1">
                <button
                  type="button"
                  onClick={handleSaveDescription}
                  className="text-xs text-accent-text hover:underline"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditingDescription(false)}
                  className="text-xs text-muted hover:underline"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <p
              className="text-sm text-muted mt-1 cursor-pointer hover:text-text"
              onClick={() => {
                setEditedDescription(template.description)
                setIsEditingDescription(true)
              }}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  setEditedDescription(template.description)
                  setIsEditingDescription(true)
                }
              }}
            >
              {template.description || 'Add a description...'}
            </p>
          )}
        </div>

        {/* Delete template button */}
        <button
          type="button"
          onClick={() => setDeleteDialogTemplate(true)}
          className={cn(
            'flex items-center gap-2 h-9 px-3 rounded-control text-sm',
            'text-danger-fg hover:bg-danger-bg'
          )}
        >
          <Trash2 size={14} strokeWidth={1.75} aria-hidden="true" />
          Delete template
        </button>
      </div>

      {/* Tasks section */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-text">
            Tasks ({template.task_count}/50)
          </h2>
          <button
            type="button"
            onClick={() => setShowAddTaskDialog(true)}
            disabled={template.task_count >= 50}
            className={cn(
              'flex items-center gap-1.5 h-9 px-3 rounded-control text-sm font-medium',
              'bg-accent text-accent-fg hover:opacity-90',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          >
            <Plus size={14} strokeWidth={1.75} aria-hidden="true" />
            Add task
          </button>
        </div>

        {template.tasks.length === 0 ? (
          <EmptyState
            title="No tasks yet"
            description="Add tasks to this template. When you create a project from this template, these tasks will be created automatically."
            action={{
              label: 'Add first task',
              onClick: () => setShowAddTaskDialog(true),
            }}
            dashedBorder
          />
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={template.tasks.map((t) => t.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-2">
                {template.tasks.map((task) => (
                  <SortableTaskRow
                    key={task.id}
                    task={task}
                    onEdit={() => setEditingTask(task)}
                    onDelete={() => setDeleteDialogTask(task)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </Card>

      {/* Add Task Dialog */}
      <TemplateTaskDialog
        open={showAddTaskDialog}
        onOpenChange={setShowAddTaskDialog}
        mode="create"
        onSave={handleCreateTask}
        isPending={createTaskMutation.isPending}
      />

      {/* Edit Task Dialog */}
      <TemplateTaskDialog
        open={editingTask !== null}
        onOpenChange={(open) => { if (!open) setEditingTask(null) }}
        mode="edit"
        initialTitle={editingTask?.title ?? ''}
        initialDescription={editingTask?.description ?? ''}
        initialPriority={editingTask?.priority ?? 'medium'}
        initialRelativeDays={editingTask?.relative_days ?? 0}
        onSave={handleUpdateTask}
        isPending={updateTaskMutation.isPending}
      />

      {/* Delete Task Confirmation */}
      <ConfirmDialog
        open={deleteDialogTask !== null}
        onOpenChange={(open) => { if (!open) setDeleteDialogTask(null) }}
        title="Delete task"
        description={`Remove "${deleteDialogTask?.title ?? 'this task'}" from the template?`}
        confirmLabel="Delete task"
        onConfirm={handleConfirmDeleteTask}
        destructive
      />

      {/* Delete Template Confirmation */}
      <ConfirmDialog
        open={deleteDialogTemplate}
        onOpenChange={setDeleteDialogTemplate}
        title="Delete template"
        description={`This will permanently delete "${template.title}" and all its tasks.`}
        confirmLabel="Delete template"
        onConfirm={handleDeleteTemplate}
        destructive
      />
    </div>
  )
}

interface SortableTaskRowProps {
  task: TemplateTask
  onEdit: () => void
  onDelete: () => void
}

function SortableTaskRow({ task, onEdit, onDelete }: SortableTaskRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex items-center gap-3 p-3 rounded-control border border-border bg-surface',
        'hover:bg-surface-2',
        isDragging && 'opacity-50 shadow-lg'
      )}
    >
      {/* Drag handle */}
      <button
        type="button"
        className="flex items-center justify-center w-6 h-6 text-muted hover:text-text cursor-grab"
        aria-label={`Reorder ${task.title}`}
        {...attributes}
        {...listeners}
      >
        <GripVertical size={16} strokeWidth={1.75} aria-hidden="true" />
      </button>

      {/* Task content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-text truncate">{task.title}</span>
          <PriorityChip priority={task.priority} />
        </div>
        {task.description && (
          <p className="text-xs text-muted mt-0.5 truncate">{task.description}</p>
        )}
      </div>

      {/* Relative days badge */}
      <span className="text-xs text-muted px-2 py-1 bg-surface-2 rounded shrink-0">
        Day {task.relative_days}
      </span>

      {/* Actions */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className={cn(
              'flex items-center justify-center w-8 h-8 rounded-control',
              'text-muted hover:text-text hover:bg-surface-2',
              'focus:outline-2 focus:outline-accent focus:outline-offset-2'
            )}
            aria-label={`Actions for ${task.title}`}
          >
            <MoreHorizontal size={16} strokeWidth={1.75} aria-hidden="true" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={onEdit}>
            <Pencil size={14} strokeWidth={1.75} className="mr-2" aria-hidden="true" />
            Edit
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onDelete} className="text-danger-fg focus:text-danger-fg">
            <Trash2 size={14} strokeWidth={1.75} className="mr-2" aria-hidden="true" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
