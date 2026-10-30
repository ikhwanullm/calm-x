import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

const link = vi.hoisted(() => ({ mutate: vi.fn() }))

vi.mock('../hooks/useLinks', () => ({
  useLinkedItems: () => ({ data: [{ id: 1, type: 'project', title: 'Already linked' }] }),
  useLinkResource: () => ({ mutate: link.mutate }),
  useUnlinkResource: () => ({ mutate: vi.fn() }),
}))
vi.mock('../hooks/useItems', () => ({
  useItems: () => ({
    data: [
      { id: 1, type: 'project', title: 'Already linked', archived_at: null },
      { id: 2, type: 'project', title: 'Migrate CML', archived_at: null, area_title: null },
      { id: 3, type: 'area', title: 'Health', archived_at: null },
      { id: 4, type: 'resource', title: 'A resource', archived_at: null },
    ],
  }),
}))
vi.mock('../lib/toast', () => ({ notify: { success: vi.fn(), error: vi.fn() } }))

import { ResourceLinksSection } from '../components/items/ResourceLinksSection'

describe('ResourceLinksSection picker', () => {
  it('offers only projects and areas that are not linked yet, searchable, and links the chosen one', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter><ResourceLinksSection resourceId={9} isArchived={false} /></MemoryRouter>)
    await user.click(screen.getByRole('button', { name: 'Link to project or area' }))
    const list = await screen.findByRole('listbox')
    const titles = within(list).getAllByRole('option').map((o) => o.textContent)
    expect(titles).toHaveLength(2)
    expect(titles.join('|')).toContain('Migrate CML')
    expect(titles.join('|')).toContain('Health')
    expect(titles.join('|')).not.toContain('Already linked')
    expect(titles.join('|')).not.toContain('A resource')
    await user.type(screen.getByRole('combobox'), 'migr')
    await user.click(screen.getByRole('option', { name: /Migrate CML/ }))
    expect(link.mutate.mock.calls[0][0]).toBe(2)
  })

  it('has no picker for an archived resource', () => {
    render(<MemoryRouter><ResourceLinksSection resourceId={9} isArchived /></MemoryRouter>)
    expect(screen.queryByRole('button', { name: 'Link to project or area' })).toBeNull()
  })
})
