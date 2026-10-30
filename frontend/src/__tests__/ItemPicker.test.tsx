import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ItemPicker } from '../components/common/ItemPicker'
import type { Item } from '../types/models'

function project(id: number, title: string, area_title: string | null = null): Item {
  return {
    id, type: 'project', title, description: '', notes: '', archived_at: null, created_at: '', updated_at: '',
    task_count: 0, completed_task_count: 0, progress_percentage: 0, project_goal: null, project_deadline: null,
    project_status: 'active', project_completed_at: null, area_id: null, area_title, area_archived: false,
  } as Item
}

function area(id: number, title: string): Item {
  return {
    id, type: 'area', title, description: '', notes: '', archived_at: null, created_at: '', updated_at: '',
    task_count: 0, completed_task_count: 0, progress_percentage: 0, area_maintenance_notes: null,
  } as Item
}

const MANY: Item[] = [
  ...Array.from({ length: 150 }, (_, i) => project(i + 1, `Project ${String(i + 1).padStart(3, '0')}`, i % 2 ? 'Cloudera' : 'Family')),
  project(500, 'Migrasi Runtime Cloudera Machine Learning (CML)', 'Cloudera'),
  area(900, 'Health'),
]

function setup(props: Partial<React.ComponentProps<typeof ItemPicker>> = {}) {
  const onSelect = vi.fn()
  render(<ItemPicker items={MANY} onSelect={onSelect} placeholder="Move to…" ariaLabel="Move to" {...props} />)
  const open = () => userEvent.setup().click(screen.getByRole('button', { name: 'Move to' }))
  return { onSelect, open }
}

const options = () => screen.queryAllByRole('option').map((o) => o.textContent)

beforeEach(() => localStorage.clear())

describe('ItemPicker', () => {
  it('opens a searchable list and shows what is chosen on the button', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    const { rerender } = render(<ItemPicker items={MANY} onSelect={onSelect} placeholder="Move to…" ariaLabel="Move to" />)
    const button = screen.getByRole('button', { name: 'Move to' })
    expect(button.textContent).toBe('Move to…')
    expect(button.getAttribute('aria-expanded')).toBe('false')
    await user.click(button)
    expect(button.getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByRole('combobox')).toBeTruthy()
    rerender(<ItemPicker items={MANY} value={900} onSelect={onSelect} placeholder="Move to…" ariaLabel="Move to" />)
    expect(button.textContent).toBe('Health')
  })

  it('typing narrows 150+ projects down, and the title that starts with it comes first', async () => {
    const user = userEvent.setup()
    setup()
    await user.click(screen.getByRole('button', { name: 'Move to' }))
    expect(options().length).toBeGreaterThan(100)
    await user.type(screen.getByRole('combobox'), 'migr')
    expect(options()).toEqual(['ProjectMigrasi Runtime Cloudera Machine Learning (CML)Cloudera'])
    expect(screen.getByText('1 found')).toBeTruthy()
  })

  it('also finds a project by the name of its area, and an area by its name', async () => {
    const user = userEvent.setup()
    setup()
    await user.click(screen.getByRole('button', { name: 'Move to' }))
    await user.type(screen.getByRole('combobox'), 'health')
    expect(options()).toEqual(['AreaHealth'])
    await user.clear(screen.getByRole('combobox'))
    await user.type(screen.getByRole('combobox'), 'cloudera')
    const found = options()
    expect(found).toHaveLength(76)   // 75 projects of the area Cloudera + the one named after it
  })

  it('says so when nothing matches', async () => {
    const user = userEvent.setup()
    setup()
    await user.click(screen.getByRole('button', { name: 'Move to' }))
    await user.type(screen.getByRole('combobox'), 'zzzz')
    expect(screen.getByText('Nothing matches "zzzz".')).toBeTruthy()
    expect(options()).toEqual([])
  })

  it('arrow keys and Enter choose, and the list closes with focus back on the button', async () => {
    const user = userEvent.setup()
    const { onSelect } = setup()
    const button = screen.getByRole('button', { name: 'Move to' })
    await user.click(button)
    await user.type(screen.getByRole('combobox'), 'project 00')
    await user.keyboard('{ArrowDown}{Enter}')
    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(onSelect.mock.calls[0][0]).toBe(2)
    expect(screen.queryByRole('listbox')).toBeNull()
    expect(document.activeElement).toBe(button)
  })

  it('clicking an option chooses it', async () => {
    const user = userEvent.setup()
    const { onSelect } = setup()
    await user.click(screen.getByRole('button', { name: 'Move to' }))
    await user.click(screen.getByRole('option', { name: /Health/ }))
    expect(onSelect).toHaveBeenCalledWith(900)
  })

  it('Escape closes without choosing, and so does a click outside', async () => {
    const user = userEvent.setup()
    const { onSelect } = setup()
    await user.click(screen.getByRole('button', { name: 'Move to' }))
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('listbox')).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Move to' }))
    await user.click(document.body)
    expect(screen.queryByRole('listbox')).toBeNull()
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('lists the last used destinations first, newest first, only while the search is empty', async () => {
    const user = userEvent.setup()
    setup()
    for (const name of [/Project 007/, /Health/, /Project 003/]) {
      await user.click(screen.getByRole('button', { name: 'Move to' }))
      await user.click(screen.getByRole('option', { name }))
    }
    await user.click(screen.getByRole('button', { name: 'Move to' }))
    const recent = within(screen.getByText('Recent').closest('[cmdk-group]') as HTMLElement).getAllByRole('option')
    expect(recent.map((o) => o.textContent)).toEqual(['ProjectProject 003Family', 'AreaHealth', 'ProjectProject 007Family'])
    await user.type(screen.getByRole('combobox'), 'health')
    expect(screen.queryByText('Recent')).toBeNull()
  })

  it('shows at most the five most recent and skips ones that no longer exist', async () => {
    localStorage.setItem('calmx.recentDestinations', JSON.stringify([1, 2, 3, 4, 5, 6, 7, 999999]))
    const user = userEvent.setup()
    setup()
    await user.click(screen.getByRole('button', { name: 'Move to' }))
    const recent = within(screen.getByText('Recent').closest('[cmdk-group]') as HTMLElement).getAllByRole('option')
    expect(recent).toHaveLength(5)
    expect(recent.map((o) => o.textContent?.match(/Project \d+/)?.[0])).toEqual(['Project 001', 'Project 002', 'Project 003', 'Project 004', 'Project 005'])
  })

  it('an Inbox entry is offered when allowed, and chooses null', async () => {
    const user = userEvent.setup()
    const { onSelect } = setup({ allowInbox: true, value: 3 })
    await user.click(screen.getByRole('button', { name: 'Move to' }))
    await user.click(screen.getByRole('option', { name: 'Inbox' }))
    expect(onSelect).toHaveBeenCalledWith(null)
  })

  it('shows Inbox on the button when the value is null and Inbox is allowed', () => {
    setup({ allowInbox: true, value: null })
    expect(screen.getByRole('button', { name: 'Move to' }).textContent).toBe('Inbox')
  })

  it('works without storage and can be disabled', async () => {
    const user = userEvent.setup()
    const get = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked') })
    const set = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked') })
    const { onSelect } = setup()
    await user.click(screen.getByRole('button', { name: 'Move to' }))
    await user.click(screen.getByRole('option', { name: /Health/ }))
    expect(onSelect).toHaveBeenCalledWith(900)
    get.mockRestore()
    set.mockRestore()
  })

  it('a disabled picker does not open', async () => {
    const user = userEvent.setup()
    setup({ disabled: true })
    await user.click(screen.getByRole('button', { name: 'Move to' }))
    expect(screen.queryByRole('listbox')).toBeNull()
  })
})
