import { useEffect, useRef } from 'react'
import { useInlineEdit } from '@/hooks/useInlineEdit'
import { cn } from '@/lib/utils'

// Generic inline text field

export function InlineField({
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
