import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

vi.mock('../api/tasks', () => ({ tasksApi: { create: vi.fn() } }))
vi.mock('../api/items', () => ({
  itemsApi: {
    list: vi.fn().mockResolvedValue([
      { id: 1, type: 'project', title: 'Migrasi Runtime Cloudera Machine Learning (CML)', project_status: 'active', archived_at: null },
      { id: 2, type: 'project', title: 'Old project', project_status: 'completed', archived_at: null },
      { id: 3, type: 'area', title: 'Family', archived_at: null },
    ]),
  },
}))
vi.mock('../lib/toast', () => ({ notify: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }))

import { tasksApi } from '../api/tasks'
import { notify } from '../lib/toast'
import { CaptureBox, describeAdded } from '../components/capture/CaptureBox'
import type { Task } from '../types/models'

function created(id: number, title: string, item_title: string | null = null): Task {
  return { id, title, item_id: item_title ? 1 : null, item_title } as Task
}

function renderBox(props: Partial<React.ComponentProps<typeof CaptureBox>> = {}) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const onAdded = vi.fn()
  render(
    <QueryClientProvider client={qc}>
      <CaptureBox inputLabel="Capture task title" onAdded={onAdded} {...props} />
    </QueryClientProvider>
  )
  return { onAdded, box: screen.getByRole('textbox', { name: 'Capture task title' }) as HTMLTextAreaElement }
}

describe('CaptureBox', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 9, 29, 12))
    let n = 0
    vi.mocked(tasksApi.create).mockImplementation(async (payload) => created(++n, payload.title))
  })
  afterEach(() => vi.useRealTimers())

  it('a plain line is created with Medium priority and no preview', async () => {
    const user = userEvent.setup({ advanceTimers: () => {} })
    const { box, onAdded } = renderBox()
    await user.type(box, 'Buy milk{Enter}')
    await waitFor(() => expect(tasksApi.create).toHaveBeenCalledTimes(1))
    expect(tasksApi.create).toHaveBeenCalledWith({ title: 'Buy milk', priority: 'medium' })
    expect(screen.queryByRole('list', { name: 'How the lines are read' })).toBeNull()
    await waitFor(() => expect(box.value).toBe(''))
    expect(notify.success).toHaveBeenCalledWith('Added to Inbox')
    expect(onAdded).toHaveBeenCalledTimes(1)
  })

  it('reads due date, priority, tag and project from the text and shows it before saving', async () => {
    const user = userEvent.setup({ advanceTimers: () => {} })
    const { box } = renderBox()
    await screen.findByRole('textbox', { name: 'Capture task title' })
    await user.type(box, 'Telepon vendor besok !high #work @CML')
    const preview = await screen.findByRole('list', { name: 'How the lines are read' })
    expect(preview.textContent).toContain('Telepon vendor')
    expect(preview.textContent).toContain('due Fri 30 Oct')
    expect(preview.textContent).toContain('high')
    expect(preview.textContent).toContain('#work')
    expect(preview.textContent).toContain('→ Migrasi Runtime Cloudera Machine Learning (CML)')
    await user.keyboard('{Enter}')
    await waitFor(() => expect(tasksApi.create).toHaveBeenCalledWith({
      title: 'Telepon vendor', priority: 'high', due_date: '2026-10-30', tag_names: ['work'], item_id: 1,
    }))
  })

  it('an unknown @project is kept in the title and flagged in the preview', async () => {
    const user = userEvent.setup({ advanceTimers: () => {} })
    const { box } = renderBox()
    await user.type(box, 'Call @Nope')
    expect((await screen.findByRole('list', { name: 'How the lines are read' })).textContent).toContain('no project matches @Nope')
    await user.keyboard('{Enter}')
    await waitFor(() => expect(tasksApi.create).toHaveBeenCalledWith({ title: 'Call @Nope', priority: 'medium' }))
  })

  it('a completed project is not offered by @name', async () => {
    const user = userEvent.setup({ advanceTimers: () => {} })
    const { box } = renderBox()
    await user.type(box, 'Wrap up @Old')
    expect((await screen.findByRole('list', { name: 'How the lines are read' })).textContent).toContain('no project matches @Old')
  })

  it('Shift+Enter adds a line, and every line becomes a task', async () => {
    const user = userEvent.setup({ advanceTimers: () => {} })
    const { box } = renderBox()
    await user.type(box, 'First{Shift>}{Enter}{/Shift}Second @Family')
    expect(box.value).toBe('First\nSecond @Family')
    expect(screen.getByRole('button', { name: 'Add 2 tasks' })).toBeTruthy()
    await user.keyboard('{Enter}')
    await waitFor(() => expect(tasksApi.create).toHaveBeenCalledTimes(2))
    expect(vi.mocked(tasksApi.create).mock.calls.map(([p]) => p.title)).toEqual(['First', 'Second'])
    expect(vi.mocked(tasksApi.create).mock.calls[1][0].item_id).toBe(3)
  })

  it('a pasted list keeps its lines, drops bullets and numbers, and adds them all', async () => {
    const { box } = renderBox()
    fireEvent.change(box, { target: { value: '- Email Budi besok\n2. Book room\n[ ] Pay invoice !h\n\n' } })
    const preview = screen.getByRole('list', { name: 'How the lines are read' })
    expect(within(preview).getAllByRole('listitem')).toHaveLength(3)
    fireEvent.click(screen.getByRole('button', { name: 'Add 3 tasks' }))
    await waitFor(() => expect(tasksApi.create).toHaveBeenCalledTimes(3))
    expect(vi.mocked(tasksApi.create).mock.calls.map(([p]) => p.title)).toEqual(['Email Budi', 'Book room', 'Pay invoice'])
    await waitFor(() => expect(notify.success).toHaveBeenCalledWith('Added 3 tasks to Inbox'))
  })

  it('previews at most eight lines and says how many more there are', () => {
    renderBox()
    const box = screen.getByRole('textbox', { name: 'Capture task title' })
    fireEvent.change(box, { target: { value: Array.from({ length: 11 }, (_, i) => `Task ${i + 1}`).join('\n') } })
    expect(screen.getByText('+3 more lines')).toBeTruthy()
  })

  it('adds at most 50 lines at once and says so', async () => {
    renderBox()
    const box = screen.getByRole('textbox', { name: 'Capture task title' })
    fireEvent.change(box, { target: { value: Array.from({ length: 60 }, (_, i) => `Task ${i + 1}`).join('\n') } })
    expect(screen.getByRole('alert').textContent).toContain('first 50 lines')
    expect(screen.getByRole('button', { name: 'Add 50 tasks' })).toBeTruthy()
  })

  it('lines that fail stay in the box (as typed) while the others are added', async () => {
    const user = userEvent.setup({ advanceTimers: () => {} })
    vi.mocked(tasksApi.create).mockImplementation(async (payload) => {
      if (payload.title === 'Too many') throw new Error('Limit reached')
      return created(1, payload.title)
    })
    const { box } = renderBox()
    fireEvent.change(box, { target: { value: 'Fine one\nToo many besok !high\nFine two' } })
    await user.click(screen.getByRole('button', { name: 'Add 3 tasks' }))
    await waitFor(() => expect(box.value).toBe('Too many besok !high'))
    expect(notify.error).toHaveBeenCalledWith('1 of 3 could not be added.', 'Limit reached')
    expect(notify.success).toHaveBeenCalledWith('Added 2 tasks to Inbox')
  })

  it('nothing to add when the box is empty or blank', async () => {
    const user = userEvent.setup({ advanceTimers: () => {} })
    const { box } = renderBox()
    expect((screen.getByRole('button', { name: 'Add' }) as HTMLButtonElement).disabled).toBe(true)
    await user.type(box, '   {Enter}')
    expect(tasksApi.create).not.toHaveBeenCalled()
  })

  it('Escape is passed on (the dialog closes)', async () => {
    const user = userEvent.setup({ advanceTimers: () => {} })
    const onEscape = vi.fn()
    const { box } = renderBox({ onEscape })
    await user.type(box, 'x{Escape}')
    expect(onEscape).toHaveBeenCalled()
  })
})

describe('describeAdded', () => {
  it('names where the tasks went', () => {
    expect(describeAdded([created(1, 'a')])).toBe('Added to Inbox')
    expect(describeAdded([created(1, 'a'), created(2, 'b')])).toBe('Added 2 tasks to Inbox')
    expect(describeAdded([created(1, 'a', 'Migrate CML')])).toBe('Added to Migrate CML')
    expect(describeAdded([created(1, 'a', 'Migrate CML'), created(2, 'b', 'Migrate CML')])).toBe('Added 2 tasks to Migrate CML')
    expect(describeAdded([created(1, 'a', 'Migrate CML'), created(2, 'b')])).toBe('Added 2 tasks')
  })
})
