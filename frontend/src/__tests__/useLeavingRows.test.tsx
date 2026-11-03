import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { LEAVE_MS, LINGER_MS, useLeavingRows } from '../hooks/useLeavingRows'
import type { Task } from '../types/models'

function task(id: number): Task {
  return {
    id, item_id: null, title: `Task ${id}`, description: '', notes: '', due_date: null, priority: 'medium',
    is_complete: false, sort_order: id, created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z',
    subtask_count: 0, completed_subtask_count: 0, tags: [],
    focus_date: null, waiting_for: null, waiting_since: null, completed_at: null, defer_until: null,
    is_someday: false, meeting_id: null, meeting_title: null, meeting_held_at: null, item_title: null, item_type: null,
  }
}

function reducedMotion(reduce: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: reduce && query.includes('reduce'),
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })) as unknown as typeof window.matchMedia
}

const all = [task(1), task(2), task(3)]
const afterRefetch = [task(1), task(3)]

beforeEach(() => {
  vi.useFakeTimers()
  reducedMotion(false)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useLeavingRows', () => {
  it('shows a clicked task as done right away', () => {
    const { result } = renderHook(() => useLeavingRows())
    act(() => result.current.toggle('l', all, all[1], vi.fn()))
    const row = result.current.rows('l', all).find((r) => r.task.id === 2)
    expect(row?.task.is_complete).toBe(true)
    expect(row?.leaving).toBe(false)
  })

  it('keeps a completed row in place after the data drops it, then fades it, then removes it', () => {
    const { result } = renderHook(() => useLeavingRows())
    act(() => result.current.toggle('l', all, all[1], vi.fn()))

    let rows = result.current.rows('l', afterRefetch)
    expect(rows.map((r) => r.task.id)).toEqual([1, 2, 3])
    expect(rows[1]).toMatchObject({ leaving: false, retained: true })

    act(() => { vi.advanceTimersByTime(LINGER_MS) })
    rows = result.current.rows('l', afterRefetch)
    expect(rows[1].leaving).toBe(true)

    act(() => { vi.advanceTimersByTime(LEAVE_MS + 40) })
    expect(result.current.rows('l', afterRefetch).map((r) => r.task.id)).toEqual([1, 3])
  })

  it('does not fade a completed row that the list keeps', () => {
    const { result } = renderHook(() => useLeavingRows())
    act(() => result.current.toggle('l', all, all[1], vi.fn()))
    act(() => { vi.advanceTimersByTime(LINGER_MS) })
    const kept = [task(1), { ...task(2), is_complete: true }, task(3)]
    expect(result.current.rows('l', kept)[1]).toMatchObject({ leaving: false, retained: false })
  })

  it('drops the row at once with reduced motion', () => {
    reducedMotion(true)
    const { result } = renderHook(() => useLeavingRows())
    act(() => result.current.toggle('l', all, all[1], vi.fn()))
    expect(result.current.rows('l', afterRefetch).map((r) => r.task.id)).toEqual([1, 3])
    expect(result.current.rows('l', all)[1].task.is_complete).toBe(false)
  })

  it('reopening a row that is still shown as done cancels its exit', () => {
    const { result } = renderHook(() => useLeavingRows())
    const run = vi.fn()
    act(() => result.current.toggle('l', all, all[1], run))
    const shown = result.current.rows('l', all)[1].task
    act(() => result.current.toggle('l', all, shown, run))
    expect(run).toHaveBeenLastCalledWith(shown)
    expect(result.current.rows('l', afterRefetch).map((r) => r.task.id)).toEqual([1, 3])
  })

  it('runs the page handler with the clicked task', () => {
    const { result } = renderHook(() => useLeavingRows())
    const run = vi.fn()
    act(() => result.current.toggle('l', all, all[0], run))
    expect(run).toHaveBeenCalledWith(all[0])
  })

  it('keeps lists apart', () => {
    const { result } = renderHook(() => useLeavingRows())
    act(() => result.current.toggle('a', all, all[1], vi.fn()))
    expect(result.current.rows('b', afterRefetch).map((r) => r.task.id)).toEqual([1, 3])
  })
})
