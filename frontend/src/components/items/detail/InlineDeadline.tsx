import { useEffect, useRef, useState } from 'react'
import { StatusBadge, RelativeDate } from '@/components/common'
import { getDeadlineStatus } from '@/utils/deadline'
import { cn } from '@/lib/utils'

// Inline Deadline editor (R4.1 / R4.2)

export function InlineDeadline({
  deadline,
  isComplete,
  disabled,
  today,
  threshold,
  onSave,
}: {
  deadline: string | null
  isComplete: boolean
  disabled: boolean
  today: string
  threshold: number
  onSave: (value: string | null) => void
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(deadline ?? '')
  const inputRef = useRef<HTMLInputElement>(null)

  // Open editor
  function startEdit() {
    if (disabled) return
    setEditValue(deadline ?? '')
    setIsEditing(true)
  }

  // Focus date input when editing starts
  useEffect(() => {
    if (isEditing) inputRef.current?.focus()
  }, [isEditing])

  function handleSave() {
    onSave(editValue || null)
    setIsEditing(false)
  }

  function handleClear() {
    onSave(null)
    setIsEditing(false)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handleSave()
    if (e.key === 'Escape') setIsEditing(false)
  }

  // Archived projects get no deadline badge (R7.8); disabled is set only for archived items
  const deadlineStatus = deadline && !isComplete && !disabled
    ? getDeadlineStatus(deadline, isComplete, threshold, today)
    : null

  if (isEditing) {
    return (
      <div className="mt-2 flex items-center gap-2 flex-wrap">
        <input
          ref={inputRef}
          type="date"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          aria-label="Project deadline"
          className={cn(
            'h-9 px-3 rounded-control border border-border bg-surface text-text text-sm',
            'focus:outline-2 focus:outline-accent focus:outline-offset-0'
          )}
        />
        <button
          type="button"
          onClick={handleSave}
          className="h-9 px-3 rounded-control bg-accent text-accent-fg text-xs font-semibold hover:opacity-90"
        >
          Save
        </button>
        {deadline && (
          <button
            type="button"
            onClick={handleClear}
            className="h-9 px-3 rounded-control border border-border text-muted text-xs font-medium hover:bg-surface-2 hover:text-danger-fg"
          >
            Clear deadline
          </button>
        )}
        <button
          type="button"
          onClick={() => setIsEditing(false)}
          className="h-9 px-3 rounded-control text-muted text-xs hover:text-text"
        >
          Cancel
        </button>
      </div>
    )
  }

  return (
    <div className="mt-2 flex items-center gap-3 flex-wrap">
      {deadlineStatus ? (
        <StatusBadge status={deadlineStatus} date={deadline!} today={today} />
      ) : deadline ? (
        // Completed or archived project — show date without status color
        <RelativeDate date={deadline} />
      ) : null}

      {!disabled && (
        <button
          type="button"
          onClick={startEdit}
          className={cn(
            'text-xs font-medium',
            deadline
              ? 'text-muted hover:text-accent-text hover:underline'
              : 'text-accent-text hover:underline'
          )}
        >
          {deadline ? 'Edit deadline' : '+ Add deadline'}
        </button>
      )}
    </div>
  )
}
