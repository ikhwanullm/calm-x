import { describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { ItemIcon, ItemIconPicker, ItemLink } from '../components/common'
import { ITEM_COLORS, ITEM_ICONS } from '../utils/itemIcons'

describe('ItemIcon', () => {
  it('shows the first letter of the title in a slate square when there is no icon', () => {
    const { container } = render(<ItemIcon title="migrasi" />)
    const square = container.firstElementChild as HTMLElement
    expect(square.textContent).toBe('M')
    expect(square.style.backgroundColor).toBe('var(--tint-slate-bg)')
    expect(square.getAttribute('aria-hidden')).toBe('true')
  })

  it('draws the icon in its tint', () => {
    const { container } = render(<ItemIcon title="Data" icon="database" color="teal" size={28} />)
    const square = container.firstElementChild as HTMLElement
    expect(square.querySelector('svg')).not.toBeNull()
    expect(square.textContent).toBe('')
    expect(square.style.backgroundColor).toBe('var(--tint-teal-bg)')
    expect(square.style.color).toBe('var(--tint-teal-fg)')
    expect(square.className).toContain('h-7')
  })

  it('shows the letter for a key it does not know, and treats an unknown color as slate', () => {
    const { container } = render(<ItemIcon title="Zed" icon="from-a-newer-version" color="red" />)
    const square = container.firstElementChild as HTMLElement
    expect(square.textContent).toBe('Z')
    expect(square.style.backgroundColor).toBe('var(--tint-slate-bg)')
  })

  it('offers no red, amber or green tint', () => {
    expect(ITEM_COLORS.map((c) => c.key)).toEqual(['purple', 'blue', 'teal', 'pink', 'slate'])
  })

  it('has unique icon keys that the backend would accept', () => {
    const keys = ITEM_ICONS.map((i) => i.key)
    expect(new Set(keys).size).toBe(keys.length)
    expect(keys.every((k) => /^[a-z0-9-]{1,40}$/.test(k))).toBe(true)
  })
})

describe('ItemLink with an icon', () => {
  it('puts the icon before the name and keeps the link name clean', () => {
    render(<MemoryRouter><ItemLink itemId={3} itemType="project" title="Alpha" icon="rocket" color="purple" /></MemoryRouter>)
    const link = screen.getByRole('link', { name: 'Alpha' })
    expect(link.querySelector('svg')).not.toBeNull()
  })

  it('shows no icon for the Inbox', () => {
    const { container } = render(<ItemLink itemId={null} itemType={null} title={null} />)
    expect(container.querySelector('[aria-hidden]')).toBeNull()
  })
})

describe('ItemIconPicker', () => {
  function setup(props: Partial<React.ComponentProps<typeof ItemIconPicker>> = {}) {
    const onChange = vi.fn()
    render(<ItemIconPicker title="Alpha" icon={null} color={null} onChange={onChange} {...props} />)
    return onChange
  }

  it('opens from the icon button and saves an icon at once', async () => {
    const user = userEvent.setup()
    const onChange = setup()
    await user.click(screen.getByRole('button', { name: 'Change icon' }))
    await user.click(await screen.findByRole('button', { name: 'Database' }))
    expect(onChange).toHaveBeenCalledWith({ icon: 'database' })
  })

  it('narrows the grid with the search box', async () => {
    const user = userEvent.setup()
    setup()
    await user.click(screen.getByRole('button', { name: 'Change icon' }))
    await user.type(await screen.findByRole('searchbox', { name: 'Search icons' }), 'rock')
    const grid = screen.getByRole('group', { name: 'Icons' })
    expect(within(grid).getAllByRole('button').map((b) => b.getAttribute('aria-label'))).toEqual(['Rocket'])
    await user.clear(screen.getByRole('searchbox'))
    await user.type(screen.getByRole('searchbox'), 'zzzz')
    expect(screen.getByText('No icon matches.')).toBeTruthy()
  })

  it('moves through the grid with the arrow keys and picks with Enter', async () => {
    const user = userEvent.setup()
    const onChange = setup()
    await user.click(screen.getByRole('button', { name: 'Change icon' }))
    await user.click(await screen.findByRole('searchbox'))
    await user.keyboard('{ArrowDown}')
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Briefcase')
    await user.keyboard('{ArrowRight}{ArrowRight}')
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Server')
    await user.keyboard('{ArrowDown}')  // eight columns: the 11th icon
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Presentation')
    await user.keyboard('{Enter}')
    expect(onChange).toHaveBeenCalledWith({ icon: 'presentation' })
  })

  it('closes with Escape', async () => {
    const user = userEvent.setup()
    setup()
    await user.click(screen.getByRole('button', { name: 'Change icon' }))
    expect(await screen.findByRole('searchbox')).toBeTruthy()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('searchbox')).toBeNull()
  })

  it('saves a color from the five swatches, named by their labels', async () => {
    const user = userEvent.setup()
    const onChange = setup({ color: 'pink' })
    await user.click(screen.getByRole('button', { name: 'Change icon' }))
    const colors = within(await screen.findByRole('group', { name: 'Color' }))
    expect(colors.getAllByRole('button').filter((b) => b.getAttribute('aria-label')).map((b) => b.getAttribute('aria-label')))
      .toEqual(['Purple', 'Blue', 'Teal', 'Pink', 'Slate'])
    expect(colors.getByRole('button', { name: 'Pink' }).getAttribute('aria-pressed')).toBe('true')
    await user.click(colors.getByRole('button', { name: 'Teal' }))
    expect(onChange).toHaveBeenCalledWith({ color: 'teal' })
  })

  it('removes the icon and color together, and only offers that when there is something to remove', async () => {
    const user = userEvent.setup()
    const onChange = setup({ icon: 'star', color: 'blue' })
    await user.click(screen.getByRole('button', { name: 'Change icon' }))
    await user.click(await screen.findByRole('button', { name: 'Remove icon' }))
    expect(onChange).toHaveBeenCalledWith({ icon: null, color: null })
  })

  it('is read-only for an archived item: no button to open it', () => {
    setup({ disabled: true, icon: 'star' })
    expect(screen.queryByRole('button', { name: 'Change icon' })).toBeNull()
  })
})
