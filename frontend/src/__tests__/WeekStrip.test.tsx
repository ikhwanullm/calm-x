import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import type { CalendarDay, Task } from '../types/models'

// Dragging itself is dnd-kit's job; capture the drop handler and call it with a fake event.
let onDragEnd: (e: unknown) => void = () => {}
vi.mock('@dnd-kit/core', () => ({
  DndContext: ({ children, onDragEnd: handler }: { children: React.ReactNode; onDragEnd: (e: unknown) => void }) => {
    onDragEnd = handler
    return <>{children}</>
  },
  PointerSensor: class {},
  useSensor: () => ({}),
  useSensors: () => [],
  useDraggable: () => ({ attributes: {}, listeners: {}, setNodeRef: () => {}, transform: null, isDragging: false }),
  useDroppable: () => ({ setNodeRef: () => {}, isOver: false }),
}))

import { dayEntries, WeekStrip } from '../components/today/WeekStrip'

const TODAY = '2026-10-29'  // Thursday
const DATES = ['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01']

function task(id: number, title: string, extra: Partial<Task> = {}): Task {
  return {
    id, item_id: null, title, description: '', notes: '', due_date: null, priority: 'medium',
    is_complete: false, sort_order: 0, created_at: '', updated_at: '', subtask_count: 0,
    completed_subtask_count: 0, tags: [], focus_date: null, waiting_for: null, waiting_since: null, defer_until: null,
    is_someday: false, meeting_id: null, meeting_title: null, meeting_held_at: null, item_title: null, item_type: null, ...extra,
  }
}

function days(patch: Record<string, Partial<CalendarDay>> = {}): CalendarDay[] {
  return DATES.map((date) => ({ date, meetings: [], due: [], planned: [], deadlines: [], starts: [], ...patch[date] }))
}

function renderStrip(d: CalendarDay[]) {
  const handlers = { onSelectDay: vi.fn(), onOpenTask: vi.fn(), onMoveTask: vi.fn() }
  render(
    <MemoryRouter>
      <WeekStrip days={d} today={TODAY} selectedDay={TODAY} {...handlers} />
    </MemoryRouter>
  )
  return handlers
}

const column = (date: string) => document.querySelector(`[data-date="${date}"]`) as HTMLElement

describe('WeekStrip', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders seven columns, Monday first, with today outlined and weekends dimmed', () => {
    renderStrip(days())
    const cols = screen.getAllByRole('listitem')
    expect(cols.map((c) => c.getAttribute('data-date'))).toEqual(DATES)
    expect(column(TODAY).className).toContain('border-accent')
    expect(column('2026-10-31').className).toContain('bg-surface-2')
    expect(column('2026-10-27').className).not.toContain('bg-surface-2')
  })

  it('orders a day: meetings, due, planned, deadlines, starts', () => {
    const day = days({
      [TODAY]: {
        meetings: [{ id: 1, title: 'Sync', held_at: '2026-10-29T03:00:00Z' } as never],
        due: [task(1, 'Due task')],
        planned: [task(2, 'Planned task')],
        deadlines: [{ id: 9, title: 'Ship project' }],
        starts: [task(3, 'Starting task')],
      },
    })[3]
    expect(dayEntries(day, TODAY).map((e) => e.kind)).toEqual(['meeting', 'due', 'planned', 'deadline', 'starts'])
  })

  it('links meetings and project deadlines', () => {
    renderStrip(days({
      [TODAY]: {
        meetings: [{ id: 1, title: 'Sync', held_at: '2026-10-29T03:00:00Z' } as never],
        deadlines: [{ id: 9, title: 'Ship project' }],
      },
    }))
    expect(within(column(TODAY)).getByRole('link', { name: /Sync/ }).getAttribute('href')).toBe('/meetings/1')
    expect(within(column(TODAY)).getByRole('link', { name: 'Ship project' }).getAttribute('href')).toBe('/projects/9')
  })

  it('tints past due tasks as overdue and others as due', () => {
    renderStrip(days({
      '2026-10-27': { due: [task(1, 'Late')] },
      '2026-10-30': { due: [task(2, 'Soon')] },
    }))
    expect(within(column('2026-10-27')).getByRole('button', { name: 'Late' }).className).toContain('bg-danger-bg')
    expect(within(column('2026-10-30')).getByRole('button', { name: 'Soon' }).className).toContain('bg-warn-bg')
  })

  it('shows at most four entries and "+N more" that selects the day', async () => {
    const user = userEvent.setup()
    const many = [1, 2, 3, 4, 5, 6].map((n) => task(n, `T${n}`))
    const { onSelectDay } = renderStrip(days({ '2026-10-30': { due: many } }))
    expect(within(column('2026-10-30')).getAllByRole('button', { name: /^T\d$/ })).toHaveLength(4)
    await user.click(within(column('2026-10-30')).getByRole('button', { name: '+2 more' }))
    expect(onSelectDay).toHaveBeenCalledWith('2026-10-30')
  })

  it('clicking a day label selects it; clicking a task opens it', async () => {
    const user = userEvent.setup()
    const { onSelectDay, onOpenTask } = renderStrip(days({ '2026-10-30': { due: [task(7, 'Open me')] } }))
    await user.click(within(column('2026-10-28')).getByRole('button'))
    expect(onSelectDay).toHaveBeenCalledWith('2026-10-28')
    await user.click(screen.getByRole('button', { name: 'Open me' }))
    expect(onOpenTask).toHaveBeenCalledWith(7)
  })

  it('shows who a waiting task is waiting for', () => {
    renderStrip(days({ '2026-10-30': { due: [task(1, 'Reply', { waiting_for: 'Budi' })] } }))
    expect(screen.getByRole('button', { name: /Reply/ }).textContent).toContain('Budi')
  })

  describe('dropping a task', () => {
    const t = task(5, 'Move me', { due_date: '2026-10-30' })
    const drop = (over: string | null, dragged: Task | null = t) =>
      onDragEnd({ active: { data: { current: dragged ? { task: dragged } : undefined } }, over: over ? { id: over } : null })

    it('on a later day moves it there', () => {
      const { onMoveTask } = renderStrip(days({ '2026-10-30': { due: [t] } }))
      drop('2026-10-31')
      expect(onMoveTask).toHaveBeenCalledWith(t, '2026-10-31')
    })

    it('on today is allowed', () => {
      const { onMoveTask } = renderStrip(days({ '2026-10-30': { due: [t] } }))
      drop(TODAY)
      expect(onMoveTask).toHaveBeenCalledWith(t, TODAY)
    })

    it('on a past day, on nothing, on its own day or without a task does nothing', () => {
      const { onMoveTask } = renderStrip(days({ '2026-10-30': { due: [t] } }))
      drop('2026-10-28')
      drop(null)
      drop('2026-10-30')
      drop('2026-10-31', null)
      expect(onMoveTask).not.toHaveBeenCalled()
    })
  })
})
