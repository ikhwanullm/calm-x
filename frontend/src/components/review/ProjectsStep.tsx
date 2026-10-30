import { useState } from 'react'
import { ChevronLeft, ChevronRight, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ProgressBar, ConfirmDialog } from '@/components/common'
import { useReviewProjects, type ReviewProjectItem } from '@/hooks/useReview'
import { useCompleteTask, useCreateTask, useDeleteTask, useUpdateTask, useItemTasks } from '@/hooks/useTasks'
import { useCompleteProject, useArchiveItem } from '@/hooks/useItems'
import type { Task } from '@/types/models'
import { formatRelativeDate, getLocalToday } from '@/utils/date'

interface ProjectsStepProps {
  onCompleted: () => void
  onUpdatedDueDate: () => void
  onArchived: () => void
  onTaskAdded: () => void
}

// Per-task action states within a project
type TaskAction = 'pending' | 'kept' | 'completed' | 'deleted' | 'updated'

export function ProjectsStep({ onCompleted, onUpdatedDueDate, onArchived, onTaskAdded }: ProjectsStepProps) {
  const today = getLocalToday()
  const { data: projects = [], isLoading } = useReviewProjects()

  const [projIdx, setProjIdx] = useState(0)
  const [taskActions, setTaskActions] = useState<Record<number, TaskAction>>({})
  const [editDueDateTaskId, setEditDueDateTaskId] = useState<number | null>(null)
  const [newDueDate, setNewDueDate] = useState('')
  const [deleteConfirmTaskId, setDeleteConfirmTaskId] = useState<number | null>(null)

  const currentProject = projects[projIdx] ?? null

  // Load tasks for current project
  const { data: allTasks = [], isLoading: tasksLoading } = useItemTasks(currentProject?.id ?? 0, { include_complete: false })

  const completeTask = useCompleteTask()
  const createTask = useCreateTask()
  const deleteTask = useDeleteTask()
  const updateTask = useUpdateTask(editDueDateTaskId ?? 0)
  const completeProject = useCompleteProject()
  const archiveItem = useArchiveItem()

  function setTaskAction(taskId: number, action: TaskAction) {
    setTaskActions(prev => ({ ...prev, [taskId]: action }))
  }

  async function handleCompleteTask(taskId: number) {
    await completeTask.mutateAsync(taskId)
    setTaskAction(taskId, 'completed')
    onCompleted()
  }

  async function handleDeleteTask(taskId: number) {
    await deleteTask.mutateAsync(taskId)
    setTaskAction(taskId, 'deleted')
    setDeleteConfirmTaskId(null)
  }

  async function handleUpdateDueDate(taskId: number) {
    if (!newDueDate) return
    await updateTask.mutateAsync({ due_date: newDueDate || null })
    setTaskAction(taskId, 'updated')
    setEditDueDateTaskId(null)
    setNewDueDate('')
    onUpdatedDueDate()
  }

  async function handleCompleteProject() {
    if (!currentProject) return
    try {
      await completeProject.mutateAsync(currentProject.id)
    } catch {
      return  // the hook already showed the error
    }
    setProjIdx(i => Math.min(i + 1, projects.length - 1))
  }

  async function handleArchiveProject() {
    if (!currentProject) return
    try {
      await archiveItem.mutateAsync(currentProject.id)
    } catch {
      return
    }
    onArchived()
    setProjIdx(i => Math.min(i + 1, projects.length - 1))
  }

  /** Give the project a next step right here, so no project leaves the review without one. */
  async function handleAddNextStep(title: string): Promise<boolean> {
    if (!currentProject) return false
    try {
      await createTask.mutateAsync({ title, item_id: currentProject.id })
    } catch {
      return false
    }
    onTaskAdded()
    return true
  }

  // Show max 5 tasks in review; rest shown as "+N more". Someday ideas have their own step.
  const MAX_TASKS = 5
  const openTasks = allTasks.filter((t: Task) => !t.is_complete && !t.is_someday)
  const displayTasks = openTasks.slice(0, MAX_TASKS)
  const hiddenCount = Math.max(0, openTasks.length - MAX_TASKS)

  if (isLoading) {
    return (
      <div>
        <h1 className="text-2xl font-semibold text-text" style={{ letterSpacing: '-0.02em' }}>
          Review active projects
        </h1>
        <div className="mt-4 h-40 rounded-2xl bg-surface border border-border animate-pulse" />
      </div>
    )
  }

  if (projects.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold text-text" style={{ letterSpacing: '-0.02em' }}>
          Review active projects
        </h1>
        <div className="flex flex-col items-center gap-2 py-12 text-center border border-dashed border-border rounded-2xl">
          <span className="text-lg font-semibold text-text">No active projects</span>
          <span className="text-muted text-sm">Create a project to track it here.</span>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold text-text" style={{ letterSpacing: '-0.02em' }}>
            Review active projects
          </h1>
          <p className="text-muted">Decide the next move for every open task.</p>
        </div>
        <span className="text-[13px] font-semibold text-muted tabular-nums">
          Project {projIdx + 1} of {projects.length}
        </span>
      </div>

      {currentProject && (
        <ProjectCard
          project={currentProject}
          today={today}
          displayTasks={displayTasks}
          noOpenTasks={!tasksLoading && openTasks.length === 0}
          hiddenCount={hiddenCount}
          taskActions={taskActions}
          editDueDateTaskId={editDueDateTaskId}
          newDueDate={newDueDate}
          onNewDueDateChange={setNewDueDate}
          onKeepTask={id => setTaskAction(id, 'kept')}
          onCompleteTask={handleCompleteTask}
          onDeleteTask={id => setDeleteConfirmTaskId(id)}
          onEditDueDate={id => { setEditDueDateTaskId(id); setNewDueDate('') }}
          onSaveDueDate={handleUpdateDueDate}
          onCancelDueDate={() => { setEditDueDateTaskId(null); setNewDueDate('') }}
          onCompleteProject={handleCompleteProject}
          onArchiveProject={handleArchiveProject}
          onAddNextStep={handleAddNextStep}
          isPrevDisabled={projIdx === 0}
          isNextDisabled={projIdx === projects.length - 1}
          onPrev={() => setProjIdx(i => i - 1)}
          onNext={() => setProjIdx(i => i + 1)}
        />
      )}

      <ConfirmDialog
        open={deleteConfirmTaskId !== null}
        onOpenChange={open => { if (!open) setDeleteConfirmTaskId(null) }}
        title="Delete task"
        description="This task and its subtasks will be deleted. You can undo it from the message that appears."
        confirmLabel="Delete task"
        onConfirm={() => { if (deleteConfirmTaskId) handleDeleteTask(deleteConfirmTaskId) }}
        destructive
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// ProjectCard subcomponent
// ---------------------------------------------------------------------------

interface ProjectCardProps {
  project: ReviewProjectItem
  today: string
  displayTasks: Task[]
  /** True once the tasks have loaded and none is open */
  noOpenTasks: boolean
  hiddenCount: number
  taskActions: Record<number, TaskAction>
  editDueDateTaskId: number | null
  newDueDate: string
  onNewDueDateChange: (v: string) => void
  onKeepTask: (id: number) => void
  onCompleteTask: (id: number) => void
  onDeleteTask: (id: number) => void
  onEditDueDate: (id: number) => void
  onSaveDueDate: (id: number) => void
  onCancelDueDate: () => void
  onCompleteProject: () => void
  onArchiveProject: () => void
  onAddNextStep: (title: string) => Promise<boolean>
  isPrevDisabled: boolean
  isNextDisabled: boolean
  onPrev: () => void
  onNext: () => void
}

function ProjectCard({
  project, today, displayTasks, noOpenTasks, hiddenCount,
  taskActions, editDueDateTaskId, newDueDate, onNewDueDateChange,
  onKeepTask, onCompleteTask, onDeleteTask, onEditDueDate,
  onSaveDueDate, onCancelDueDate,
  onCompleteProject, onArchiveProject, onAddNextStep,
  isPrevDisabled, isNextDisabled, onPrev, onNext,
}: ProjectCardProps) {
  const updatedRelative = formatRelativeDate(project.updated_at.split('T')[0], today)
  const [nextStep, setNextStep] = useState('')
  const [adding, setAdding] = useState(false)

  async function submitNextStep(e: React.FormEvent) {
    e.preventDefault()
    const title = nextStep.trim()
    if (!title || adding) return
    setAdding(true)
    const ok = await onAddNextStep(title)
    setAdding(false)
    if (ok) setNextStep('')
  }

  return (
    <section
      aria-labelledby="proj-name"
      className="flex flex-col gap-4 p-6 border border-border rounded-2xl bg-surface shadow-[var(--shadow)]"
    >
      {/* Project header */}
      <div className="flex flex-wrap items-center gap-2.5">
        <h2 id="proj-name" className="text-xl font-semibold text-text flex-1 min-w-0">
          {project.title}
        </h2>
      </div>

      {/* Stats */}
      <div className="flex flex-wrap gap-6 text-muted text-sm">
        <span>
          <span className="text-text font-semibold tabular-nums">
            {project.completed_task_count}/{project.task_count}
          </span>
          {' '}tasks done
        </span>
        <span>
          Updated{' '}
          <time
            dateTime={project.updated_at.split('T')[0]}
            title={project.updated_at}
            className="text-text font-medium underline decoration-dotted underline-offset-2"
          >
            {updatedRelative.toLowerCase()}
          </time>
        </span>
      </div>

      <ProgressBar
        completed={project.completed_task_count}
        total={project.task_count}
        label={`${project.title} progress`}
      />

      {/* Stale banner */}
      {project.is_stale && (
        <div
          role="note"
          className="flex flex-wrap items-center gap-3 px-3.5 py-3 rounded-xl bg-warn-bg text-warn-fg"
        >
          <Clock size={18} strokeWidth={2} aria-hidden="true" />
          <span className="flex-1 font-semibold text-sm">
            No updates for {project.days_since_update} days. Is this still a project, or should it be archived?
          </span>
          <button
            type="button"
            onClick={onArchiveProject}
            className="h-9 px-3 rounded-control bg-warn-fg text-surface text-sm font-semibold hover:opacity-90"
          >
            Archive project
          </button>
        </div>
      )}

      {/* Task list */}
      {displayTasks.length > 0 && (
        <ul className="border-t border-border divide-y divide-border">
          {displayTasks.map(task => {
            const action = taskActions[task.id]
            const isResolved = action && action !== 'pending'
            const isEditing = editDueDateTaskId === task.id

            return (
              <li key={task.id} className="flex flex-wrap items-center gap-2.5 py-2.5">
                <div className="flex-1 min-w-0 flex flex-col">
                  <span className={cn(
                    'font-medium text-sm',
                    action === 'completed' ? 'text-muted line-through' : 'text-text'
                  )}>
                    {task.title}
                  </span>
                  {task.due_date && (
                    <span className={cn(
                      'text-xs font-semibold',
                      task.due_date < today ? 'text-danger-fg' : 'text-muted'
                    )}>
                      Due {formatRelativeDate(task.due_date, today).toLowerCase()}
                    </span>
                  )}
                </div>

                {isResolved ? (
                  <span className="inline-flex items-center gap-1.5 text-muted text-[13px] font-semibold">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="m5 12 4.5 4.5L19 7" />
                    </svg>
                    {action === 'kept' ? 'Kept' : action === 'completed' ? 'Completed' : action === 'deleted' ? 'Deleted' : 'Updated'}
                  </span>
                ) : isEditing ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      value={newDueDate}
                      onChange={e => onNewDueDateChange(e.target.value)}
                      aria-label={`New due date for ${task.title}`}
                      className="h-9 px-2 rounded-control border border-border bg-surface text-text text-sm focus:outline-2 focus:outline-accent"
                    />
                    <button type="button" onClick={() => onSaveDueDate(task.id)}
                      className="h-9 px-3 rounded-control bg-accent text-accent-fg text-[13px] font-semibold hover:opacity-90">
                      Save
                    </button>
                    <button type="button" onClick={onCancelDueDate}
                      className="h-9 px-3 rounded-control border border-border text-muted text-[13px] font-semibold hover:bg-surface-2">
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div
                    role="group"
                    aria-label={`Next action for ${task.title}`}
                    className="flex flex-wrap gap-1.5"
                  >
                    <button type="button" onClick={() => onKeepTask(task.id)}
                      className="h-9 px-3 rounded-control border border-border bg-surface text-text text-[13px] font-semibold hover:bg-surface-2">
                      Keep
                    </button>
                    <button type="button" onClick={() => onEditDueDate(task.id)}
                      className="h-9 px-3 rounded-control border border-border bg-surface text-text text-[13px] font-semibold hover:bg-surface-2">
                      Update due date
                    </button>
                    <button type="button" onClick={() => onCompleteTask(task.id)}
                      className="h-9 px-3 rounded-control border border-border bg-surface text-text text-[13px] font-semibold hover:bg-surface-2">
                      Complete
                    </button>
                    <button type="button" onClick={() => onDeleteTask(task.id)}
                      className="h-9 px-3 rounded-control border border-border bg-surface text-danger-fg text-[13px] font-semibold hover:bg-danger-bg">
                      Delete
                    </button>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {hiddenCount > 0 && (
        <span className="text-muted text-[13px]">
          +{hiddenCount} more open task{hiddenCount === 1 ? '' : 's'} in this project
        </span>
      )}

      {noOpenTasks && (
        <p className="text-sm text-warn-fg font-medium">
          No open tasks. Add a next step, or complete or archive the project.
        </p>
      )}

      <form onSubmit={submitNextStep} className="flex gap-2">
        <input
          type="text"
          value={nextStep}
          onChange={e => setNextStep(e.target.value)}
          maxLength={200}
          placeholder="Add a next step…"
          aria-label={`Add a next step to ${project.title}`}
          className="flex-1 h-10 px-3 rounded-control border border-border-strong bg-surface text-sm text-text placeholder:text-muted focus:outline-2 focus:outline-accent"
        />
        <button
          type="submit"
          disabled={adding || !nextStep.trim()}
          className="h-10 px-3.5 rounded-control border border-border bg-surface text-text text-sm font-semibold hover:bg-surface-2 disabled:opacity-50"
        >
          Add
        </button>
      </form>

      {/* Project actions + navigation */}
      <div className="flex flex-wrap gap-2 pt-1">
        <button type="button" onClick={onCompleteProject}
          className="h-10 px-3.5 rounded-control border border-border bg-surface text-text text-sm font-semibold hover:bg-surface-2">
          Mark project complete
        </button>
        <button type="button" onClick={onArchiveProject}
          className="h-10 px-3.5 rounded-control border border-border bg-surface text-text text-sm font-semibold hover:bg-surface-2">
          Archive project
        </button>
        <div className="flex-1" />
        <button type="button" onClick={onPrev} disabled={isPrevDisabled}
          className="h-10 px-3.5 rounded-control bg-transparent text-muted text-sm font-semibold disabled:opacity-40 hover:text-text">
          <ChevronLeft size={16} className="inline" aria-hidden="true" /> Previous
        </button>
        <button type="button" onClick={onNext} disabled={isNextDisabled}
          className="h-10 px-3.5 rounded-control bg-accent-soft text-accent-text text-sm font-semibold disabled:opacity-40 hover:opacity-90">
          Next project <ChevronRight size={16} className="inline" aria-hidden="true" />
        </button>
      </div>
    </section>
  )
}
