import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { Task } from '../types/models'

vi.mock('../lib/toast', () => ({ notify: { success: vi.fn(), error: vi.fn() } }))
vi.mock('../api/tasks', () => ({ tasksApi: { reorder: vi.fn() } }))

import { tasksApi } from '../api/tasks'
import { notify } from '../lib/toast'
import { taskKeys, useReorderTasks } from '../hooks/useTasks'

const task = (id: number, complete = false): Task => ({ id, title: `T${id}`, is_complete: complete } as Task)

function setup(tasks: Task[]) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  qc.setQueryData(taskKeys.forItem(5), tasks)
  const wrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  const { result } = renderHook(() => useReorderTasks(5), { wrapper })
  const order = () => qc.getQueryData<Task[]>(taskKeys.forItem(5))!.map((t) => t.id)
  return { qc, result, order }
}

describe('useReorderTasks', () => {
  beforeEach(() => vi.clearAllMocks())

  it('sends the ids to the server and shows the new order at once', async () => {
    let finish: (v: Task[]) => void = () => {}
    vi.mocked(tasksApi.reorder).mockImplementation(() => new Promise((resolve) => { finish = resolve }))
    const { result, order } = setup([task(1), task(2), task(3)])
    act(() => { result.current.mutate([3, 1, 2]) })
    await waitFor(() => expect(order()).toEqual([3, 1, 2]))
    expect(tasksApi.reorder).toHaveBeenCalledWith(5, { task_ids: [3, 1, 2] })
    await act(async () => { finish([]) })
  })

  it('completed tasks keep their places when only the open ones are reordered', async () => {
    vi.mocked(tasksApi.reorder).mockResolvedValue([])
    const { result, order } = setup([task(1), task(9, true), task(2), task(3)])
    await act(async () => { await result.current.mutateAsync([3, 1, 2]) })
    expect(order()).toEqual([3, 9, 1, 2])
  })

  it('puts the old order back and says so when the server refuses', async () => {
    vi.mocked(tasksApi.reorder).mockRejectedValue(new Error('Not allowed'))
    const { result, order } = setup([task(1), task(2)])
    await act(async () => { await result.current.mutateAsync([2, 1]).catch(() => {}) })
    expect(order()).toEqual([1, 2])
    expect(notify.error).toHaveBeenCalledWith("Couldn't change the order. Try again.", 'Not allowed')
  })
})
