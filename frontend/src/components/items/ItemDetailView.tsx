import React, { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { isProject, isArea, isArchived } from '@/types/models'
import type { Item } from '@/types/models'
import { useItem, useUpdateItem } from '@/hooks/useItems'
import { useInlineEdit } from '@/hooks/useInlineEdit'
import { ProgressBar, StatusBadge, Skeleton, SkeletonGroup } from '@/components/common'
import { getDeadlineStatus } from '@/utils/deadline'
import { getLocalToday } from '@/utils/date'
import { cn } from '@/lib/utils'

interface ItemDetailViewProps {
  id: number
  /** Base path for breadcrumb link e.g. "/projects" */
  listPath: string
  listLabel: string
}

export function ItemDetailView({ id, listPath, listLabel }: ItemDetailViewProps) {
  const { data: item, isLoading, isError } = useItem(id)
  const updateItem = useUpdateItem(id)
  const today = getLocalToday()

  if (isLoading) {
    return (
      <SkeletonGroup label="Loading item details">
        <Skeleton className="w-48 h-6 mb-4" delay={0} />
        <Skeleton className="w-full h-8 mb-2" delay={0} />
        <Skeleton className="w-3/4 h-4" delay={0} />
      </SkeletonGroup>
    )
  }

  if (isError || !item) {
    return (
      <p className="text-sm text-danger-fg">
        Couldn&apos;t load item. Check the server is running and try again.
      </p>
    )
  }

  const archived = isArchived(item)

  // Ready-for-completion condition (R4.7)
  const isReadyForCompletion =
    isProject(item) &&
    item.task_count > 0 &&
    item.completed_task_count === item.task_count &&
    item.project_status === 'active' &&
    !archived

  return (
    <div className="max-w-2xl">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="mb-4">
        <ol className="flex items-center gap-2 text-sm text-muted">
          <li><Link to={listPath} className="hover:text-accent-text">{listLabel}</Link></li>
          <li aria-hidden="true">/</li>
          <li className="text-text font-medium" aria-current="page">{item.title}</li>
        </ol>
      </nav>

      {/* Archive read-only notice (minimal — full banner in task 2.17) */}
      {archived && (
        <div
          className="mb-4 px-4 py-2 rounded-control border border-warn-fg bg-warn-bg text-warn-fg text-sm"
          role="status"
        >
          Read-only · Archived
        </div>
      )}

      {/* 2.14: Ready-for-completion banner */}
      {isReadyForCompletion && (
        <div className="mb-4 px-4 py-3 rounded-control border border-ok-fg bg-ok-bg text-ok-fg text-sm flex items-center justify-between">
          <span>All tasks done. Ready to complete this project.</span>
          <button
            type="button"
            onClick={() => { /* handleCompleteProject — wired in task 2.15 */ }}
            className="text-sm font-medium underline hover:no-underline"
          >
            Complete project
          </button>
        </div>
      )}

      {/* Title — inline edit */}
      <InlineTitle
        item={item}
        disabled={archived}
        onSave={(title) => updateItem.mutate({ title })}
      />

      {/* Project deadline status */}
      {isProject(item) && item.project_deadline && (
        <div className="mt-2">
          {getDeadlineStatus(item.project_deadline, item.project_status === 'completed', 3, today) && (
            <StatusBadge
              status={getDeadlineStatus(item.project_deadline, item.project_status === 'completed', 3, today)!}
              date={item.project_deadline}
              today={today}
            />
          )}
        </div>
      )}

      {/* Project goal */}
      {isProject(item) && (
        <InlineField
          label="Goal"
          value={item.project_goal ?? ''}
          placeholder="What does success look like?"
          disabled={archived}
          onSave={(v) => updateItem.mutate({ project_goal: v || null })}
        />
      )}

      {/* Project progress */}
      {isProject(item) && item.task_count > 0 && (
        <div className="mt-4">
          <ProgressBar
            completed={item.completed_task_count}
            total={item.task_count}
            label={`${item.title} progress`}
          />
        </div>
      )}

      {/* Area maintenance notes */}
      {isArea(item) && (
        <InlineField
          label="Maintenance notes"
          value={item.area_maintenance_notes ?? ''}
          placeholder="Notes on how to maintain this area\u2026"
          multiline
          disabled={archived}
          onSave={(v) => updateItem.mutate({ area_maintenance_notes: v || null })}
        />
      )}

      {/* Description */}
      <InlineField
        label="Description"
        value={item.description}
        placeholder="Add a description\u2026"
        multiline
        disabled={archived}
        onSave={(v) => updateItem.mutate({ description: v })}
      />

      {/* Notes */}
      <InlineField
        label="Notes"
        value={item.notes}
        placeholder="Add notes\u2026"
        multiline
        disabled={archived}
        onSave={(v) => updateItem.mutate({ notes: v })}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Inline title editor
// ---------------------------------------------------------------------------

function InlineTitle({
  item,
  disabled,
  onSave,
}: {
  item: Item
  disabled: boolean
  onSave: (title: string) => void
}) {
  const edit = useInlineEdit({
    initialValue: item.title,
    onSave,
    validate: (v) => {
      if (!v.trim()) return 'Title is required'
      if (v.length > 200) return 'Title must be 200 characters or less'
    },
  })
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (edit.isEditing) inputRef.current?.focus()
  }, [edit.isEditing])

  if (edit.isEditing) {
    return (
      <div>
        <input
          ref={inputRef}
          type="text"
          value={edit.value}
          onChange={(e) => edit.setValue(e.target.value)}
          onKeyDown={edit.handleKeyDown}
          onBlur={edit.save}
          maxLength={200}
          aria-label="Item title"
          aria-invalid={!!edit.error}
          className={cn(
            'w-full text-2xl font-semibold bg-transparent border-b-2 focus:outline-none',
            edit.error ? 'border-danger-fg' : 'border-accent'
          )}
        />
        {edit.error && <p className="mt-1 text-xs text-danger-fg">{edit.error}</p>}
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={disabled ? undefined : edit.startEdit}
      disabled={disabled}
      aria-label={`Edit title: ${item.title}`}
      className={cn(
        'text-left text-2xl font-semibold text-text',
        !disabled && 'hover:text-accent-text cursor-text'
      )}
    >
      {item.title}
    </button>
  )
}

// ---------------------------------------------------------------------------
// Generic inline text field
// ---------------------------------------------------------------------------

function InlineField({
  label,
  value,
  placeholder,
  disabled,
  onSave,
  multiline = false,
}: {
  label: string
  value: string
  placeholder: string
  disabled: boolean
  onSave: (v: string) => void
  multiline?: boolean
}) {
  const edit = useInlineEdit({ initialValue: value, onSave })
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null)

  useEffect(() => {
    if (edit.isEditing) (inputRef.current as HTMLElement | null)?.focus()
  }, [edit.isEditing])

  const sharedProps = {
    value: edit.value,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      edit.setValue(e.target.value),
    onKeyDown: edit.handleKeyDown,
    onBlur: edit.save,
    'aria-label': label,
    className:
      'w-full bg-transparent border-b border-border focus:border-accent focus:outline-none text-sm text-text resize-none',
  }

  return (
    <div className="mt-4">
      <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-1">{label}</p>
      {edit.isEditing ? (
        multiline ? (
          <textarea
            ref={inputRef as React.Ref<HTMLTextAreaElement>}
            rows={3}
            {...sharedProps}
          />
        ) : (
          <input
            ref={inputRef as React.Ref<HTMLInputElement>}
            type="text"
            {...sharedProps}
          />
        )
      ) : (
        <button
          type="button"
          onClick={disabled ? undefined : edit.startEdit}
          disabled={disabled}
          className={cn(
            'w-full text-left text-sm',
            value ? 'text-text' : 'text-muted italic',
            !disabled && 'hover:text-accent-text cursor-text'
          )}
        >
          {value || placeholder}
        </button>
      )}
    </div>
  )
}
