import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useInlineEdit } from '../hooks/useInlineEdit'

describe('useInlineEdit', () => {
  it('starts in non-editing state', () => {
    const { result } = renderHook(() =>
      useInlineEdit({ initialValue: 'hello', onSave: vi.fn() })
    )
    expect(result.current.isEditing).toBe(false)
    expect(result.current.value).toBe('hello')
  })

  it('startEdit switches to editing', () => {
    const { result } = renderHook(() =>
      useInlineEdit({ initialValue: 'hello', onSave: vi.fn() })
    )
    act(() => result.current.startEdit())
    expect(result.current.isEditing).toBe(true)
  })

  it('cancel restores initial value', () => {
    const { result } = renderHook(() =>
      useInlineEdit({ initialValue: 'hello', onSave: vi.fn() })
    )
    act(() => {
      result.current.startEdit()
      result.current.setValue('changed')
      result.current.cancel()
    })
    expect(result.current.isEditing).toBe(false)
    expect(result.current.value).toBe('hello')
  })

  it('save calls onSave with trimmed value', () => {
    const onSave = vi.fn()
    const { result } = renderHook(() =>
      useInlineEdit({ initialValue: '  hello  ', onSave })
    )
    act(() => {
      result.current.startEdit()
      result.current.save()
    })
    expect(onSave).toHaveBeenCalledWith('hello')
  })

  it('validate blocks save on error', () => {
    const onSave = vi.fn()
    const { result } = renderHook(() =>
      useInlineEdit({
        initialValue: '',
        onSave,
        validate: (v) => (v ? undefined : 'Required'),
      })
    )
    act(() => {
      result.current.startEdit()
      result.current.save()
    })
    expect(onSave).not.toHaveBeenCalled()
    expect(result.current.error).toBe('Required')
  })
})
