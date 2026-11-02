import { useEffect, useRef } from 'react'
import { useInlineEdit } from '@/hooks/useInlineEdit'
import { cn } from '@/lib/utils'
import type { Item } from '@/types/models'

// Inline title editor

export function InlineTitle({
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
