import { useEffect, useRef, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Button, ProgressBar } from '@/components/common'
import {
  useCompleteSubtask,
  useCreateSubtask,
  useDeleteSubtask,
  useIncompleteSubtask,
} from '@/hooks/useSubtasks'
import { cn } from '@/lib/utils'
import type { Subtask } from '@/types/models'

interface SubtasksSectionProps {
  taskId: number
  subtasks: Subtask[]
}

/** The subtask list with progress, a checkbox and delete per subtask, and the add form. */
export function SubtasksSection({ taskId, subtasks }: SubtasksSectionProps) {
  const createSubtask = useCreateSubtask(taskId)
  const completeSubtask = useCompleteSubtask(taskId)
  const incompleteSubtask = useIncompleteSubtask(taskId)
  const deleteSubtask = useDeleteSubtask(taskId)

  // Add-subtask form state
  const [addingSubtask, setAddingSubtask] = useState(false)
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('')
  const newSubtaskRef = useRef<HTMLInputElement>(null)
  const addSubtaskBtnRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (addingSubtask) newSubtaskRef.current?.focus()
  }, [addingSubtask])

  function handleAddSubtask() {
    const title = newSubtaskTitle.trim()
    if (!title) return
    createSubtask.mutate({ title })
    setNewSubtaskTitle('')
    setAddingSubtask(false)
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text">Subtasks</h3>
        {subtasks.length > 0 && (
          <span className="text-xs text-muted tabular-nums">
            {subtasks.filter(s => s.is_complete).length}/{subtasks.length}
          </span>
        )}
      </div>

      {subtasks.length > 0 && (
        <ProgressBar
          completed={subtasks.filter(s => s.is_complete).length}
          total={subtasks.length}
          label={`Subtask progress: ${subtasks.filter(s => s.is_complete).length} of ${subtasks.length} complete`}
        />
      )}

      {/* Subtask list */}
      <ul className="space-y-1" aria-label="Subtasks">
        {subtasks.map((subtask) => (
          <li key={subtask.id} className="flex items-center gap-2 group">
            <input
              type="checkbox"
              checked={subtask.is_complete}
              onChange={() => {
                if (subtask.is_complete) {
                  incompleteSubtask.mutate(subtask.id)
                } else {
                  completeSubtask.mutate(subtask.id)
                }
              }}
              aria-label={`Mark subtask complete: ${subtask.title}`}
              className="h-4 w-4 rounded shrink-0 cursor-pointer accent-[var(--accent)]"
            />
            <span className={cn(
              'flex-1 text-sm',
              subtask.is_complete ? 'text-muted line-through' : 'text-text'
            )}>
              {subtask.title}
            </span>
            <button
              type="button"
              aria-label={`Delete subtask: ${subtask.title}`}
              onClick={() => deleteSubtask.mutate(subtask.id, {
                onSuccess: () => {
                  requestAnimationFrame(() => addSubtaskBtnRef.current?.focus())
                },
              })}
              className="shrink-0 text-muted hover:text-danger-fg opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
            >
              <Trash2 size={13} aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>

      {/* Add subtask form */}
      {addingSubtask ? (
        <form
          onSubmit={(e) => { e.preventDefault(); handleAddSubtask() }}
          className="flex items-center gap-2"
        >
          <input
            ref={newSubtaskRef}
            type="text"
            value={newSubtaskTitle}
            onChange={(e) => setNewSubtaskTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setAddingSubtask(false)
                setNewSubtaskTitle('')
              }
            }}
            placeholder="Subtask title"
            aria-label="New subtask title"
            className={cn(
              'flex-1 h-8 px-3 rounded-control border border-border bg-surface text-sm text-text',
              'focus:outline-2 focus:outline-offset-2 focus:outline-accent',
              'placeholder:text-muted'
            )}
          />
          <Button type="submit" size="sm" variant="primary" aria-label="Add subtask">
            Add
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => { setAddingSubtask(false); setNewSubtaskTitle('') }}
          >
            Cancel
          </Button>
        </form>
      ) : (
        <button
          ref={addSubtaskBtnRef}
          type="button"
          onClick={() => setAddingSubtask(true)}
          className="flex items-center gap-1.5 text-sm text-muted hover:text-text transition-colors"
        >
          <Plus size={14} aria-hidden="true" />
          Add subtask
        </button>
      )}
    </div>
  )
}
