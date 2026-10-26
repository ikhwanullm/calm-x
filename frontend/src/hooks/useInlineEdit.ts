import React, { useState, useRef, useCallback } from 'react'

interface UseInlineEditOptions<T extends string | null> {
  initialValue: T
  onSave: (value: NonNullable<T>) => void
  validate?: (value: string) => string | undefined
}

export function useInlineEdit<T extends string | null>({
  initialValue,
  onSave,
  validate,
}: UseInlineEditOptions<T>) {
  const [isEditing, setIsEditing] = useState(false)
  const [value, setValue] = useState(initialValue ?? '')
  const [error, setError] = useState<string>()
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null)

  const startEdit = useCallback(() => {
    setValue(initialValue ?? '')
    setError(undefined)
    setIsEditing(true)
    // Focus happens after render via ref
  }, [initialValue])

  const cancel = useCallback(() => {
    setValue(initialValue ?? '')
    setError(undefined)
    setIsEditing(false)
  }, [initialValue])

  const save = useCallback(() => {
    const trimmed = (value as string).trim()
    if (validate) {
      const err = validate(trimmed)
      if (err) {
        setError(err)
        return
      }
    }
    onSave(trimmed as NonNullable<T>)
    setIsEditing(false)
    setError(undefined)
  }, [value, validate, onSave])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        save()
      } else if (e.key === 'Escape') {
        cancel()
      }
    },
    [save, cancel]
  )

  return {
    isEditing,
    value,
    setValue,
    error,
    inputRef,
    startEdit,
    cancel,
    save,
    handleKeyDown,
  }
}
