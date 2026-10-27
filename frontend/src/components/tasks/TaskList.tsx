import { useState } from 'react'
import {
  DndContext,
  DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragStartEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Task } from '@/types/models'
import { TaskRow } from './TaskRow'
import { cn } from '@/lib/utils'

interface SortableTaskRowProps {
  task: Task
  isSelected?: boolean
  onOpenDrawer: (id: number) => void
  onToggleComplete: (task: Task) => void
}

function SortableTaskRow({ task, isSelected, onOpenDrawer, onToggleComplete }: SortableTaskRowProps) {
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
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
  }

  return (
    <div ref={setNodeRef} style={style}>
      <TaskRow
        task={task}
        isSelected={isSelected}
        onOpenDrawer={onOpenDrawer}
        onToggleComplete={onToggleComplete}
        isDraggable
        dragHandleProps={{ ...attributes, ...listeners } as React.HTMLAttributes<HTMLButtonElement>}
      />
    </div>
  )
}

export interface TaskListProps {
  tasks: Task[]
  selectedTaskId?: number
  onOpenDrawer: (taskId: number) => void
  onToggleComplete: (task: Task) => void
  onReorder?: (taskIds: number[]) => void
}

export function TaskList({
  tasks,
  selectedTaskId,
  onOpenDrawer,
  onToggleComplete,
  onReorder,
}: TaskListProps) {
  const [dragAnnouncement, setDragAnnouncement] = useState<string>('')

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const openTasks = tasks.filter(t => !t.is_complete)
  const completedTasks = tasks.filter(t => t.is_complete)
  const [showCompleted, setShowCompleted] = useState(false)

  function handleDragStart(event: DragStartEvent) {
    const task = tasks.find(t => t.id === event.active.id)
    if (task) setDragAnnouncement(`Lifted "${task.title}". Use arrow keys to move, Space to drop, Escape to cancel.`)
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id || !onReorder) {
      setDragAnnouncement('')
      return
    }
    const oldIndex = openTasks.findIndex(t => t.id === active.id)
    const newIndex = openTasks.findIndex(t => t.id === over.id)
    const reordered = [...openTasks]
    const [moved] = reordered.splice(oldIndex, 1)
    reordered.splice(newIndex, 0, moved)
    setDragAnnouncement(`"${moved.title}" moved to position ${newIndex + 1}.`)
    onReorder(reordered.map(t => t.id))
  }

  if (tasks.length === 0) return null

  return (
    <div>
      {/* Screen reader announcements */}
      <div aria-live="assertive" aria-atomic="true" className="sr-only">
        {dragAnnouncement}
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={openTasks.map(t => t.id)}
          strategy={verticalListSortingStrategy}
        >
          <div role="list" aria-label="Tasks">
            {openTasks.map(task => (
              <div key={task.id} role="listitem">
                <SortableTaskRow
                  task={task}
                  isSelected={task.id === selectedTaskId}
                  onOpenDrawer={onOpenDrawer}
                  onToggleComplete={onToggleComplete}
                />
              </div>
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {/* Completed tasks section */}
      {completedTasks.length > 0 && (
        <div className="mt-2">
          <button
            type="button"
            onClick={() => setShowCompleted(v => !v)}
            className="flex items-center gap-2 text-sm text-muted hover:text-text px-3 py-1 w-full text-left"
            aria-expanded={showCompleted}
          >
            <span className={cn('text-xs transition-transform', showCompleted && 'rotate-90')}>›</span>
            Show {completedTasks.length} completed
          </button>
          {showCompleted && (
            <div role="list" aria-label="Completed tasks">
              {completedTasks.map(task => (
                <div key={task.id} role="listitem">
                  <TaskRow
                    task={task}
                    isSelected={task.id === selectedTaskId}
                    onOpenDrawer={onOpenDrawer}
                    onToggleComplete={onToggleComplete}
                    isDraggable={false}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
