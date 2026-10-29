import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useAutosave } from '../hooks/useAutosave'

type Patch = { body?: string; title?: string }

describe('useAutosave', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('saves once after the quiet period, merging patches', async () => {
    const save = vi.fn().mockResolvedValue(undefined)
    const { result } = renderHook(() => useAutosave<Patch>(save, 1000))
    act(() => { result.current.schedule({ body: 'a' }) })
    act(() => { vi.advanceTimersByTime(600) })
    act(() => { result.current.schedule({ body: 'ab', title: 'T' }) })
    expect(result.current.status).toBe('unsaved')
    act(() => { vi.advanceTimersByTime(999) })
    expect(save).not.toHaveBeenCalled()
    await act(async () => { vi.advanceTimersByTime(1) })
    expect(save).toHaveBeenCalledTimes(1)
    expect(save).toHaveBeenCalledWith({ body: 'ab', title: 'T' })
    expect(result.current.status).toBe('saved')
  })

  it('flush saves immediately and reports success', async () => {
    const save = vi.fn().mockResolvedValue(undefined)
    const { result } = renderHook(() => useAutosave<Patch>(save, 1000))
    act(() => { result.current.schedule({ body: 'x' }) })
    let ok: boolean | undefined
    await act(async () => { ok = await result.current.flush() })
    expect(ok).toBe(true)
    expect(save).toHaveBeenCalledWith({ body: 'x' })
    await act(async () => { vi.advanceTimersByTime(5000) })
    expect(save).toHaveBeenCalledTimes(1)
  })

  it('flush with nothing pending does not call save', async () => {
    const save = vi.fn().mockResolvedValue(undefined)
    const { result } = renderHook(() => useAutosave<Patch>(save))
    let ok: boolean | undefined
    await act(async () => { ok = await result.current.flush() })
    expect(ok).toBe(true)
    expect(save).not.toHaveBeenCalled()
    expect(result.current.status).toBe('idle')
  })

  it('saves what is pending when the component unmounts', async () => {
    const save = vi.fn().mockResolvedValue(undefined)
    const { result, unmount } = renderHook(() => useAutosave<Patch>(save, 1000))
    act(() => { result.current.schedule({ body: 'typed just now' }) })
    unmount()
    await act(async () => { await Promise.resolve() })
    expect(save).toHaveBeenCalledWith({ body: 'typed just now' })
  })

  it('keeps a failed patch, reports the error, and retries it merged with newer changes', async () => {
    const save = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(undefined)
    const { result } = renderHook(() => useAutosave<Patch>(save, 1000))
    act(() => { result.current.schedule({ body: 'one' }) })
    let ok: boolean | undefined
    await act(async () => { ok = await result.current.flush() })
    expect(ok).toBe(false)
    expect(result.current.status).toBe('error')
    expect(result.current.hasUnsaved).toBe(true)

    act(() => { result.current.schedule({ title: 'T' }) })
    await act(async () => { ok = await result.current.flush() })
    expect(ok).toBe(true)
    expect(save).toHaveBeenLastCalledWith({ body: 'one', title: 'T' })
    expect(result.current.status).toBe('saved')
  })

  it('saves changes made while a save is in flight', async () => {
    let release!: () => void
    const save = vi.fn()
      .mockImplementationOnce(() => new Promise<void>((resolve) => { release = resolve }))
      .mockResolvedValue(undefined)
    const { result } = renderHook(() => useAutosave<Patch>(save, 1000))
    act(() => { result.current.schedule({ body: 'first' }) })
    let done!: Promise<boolean>
    act(() => { done = result.current.flush() })
    act(() => { result.current.schedule({ body: 'second' }) })
    await act(async () => { release(); await done })
    await act(async () => { await result.current.flush() })
    expect(save).toHaveBeenNthCalledWith(1, { body: 'first' })
    expect(save).toHaveBeenNthCalledWith(2, { body: 'second' })
  })

  it('warns before the tab closes only while there are unsaved changes', async () => {
    const save = vi.fn().mockResolvedValue(undefined)
    const { result } = renderHook(() => useAutosave<Patch>(save, 1000))
    const closing = () => {
      const e = new Event('beforeunload', { cancelable: true })
      window.dispatchEvent(e)
      return e.defaultPrevented
    }
    expect(closing()).toBe(false)
    act(() => { result.current.schedule({ body: 'x' }) })
    expect(closing()).toBe(true)
    await act(async () => { await result.current.flush() })
    expect(closing()).toBe(false)
  })
})
