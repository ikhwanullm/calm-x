import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import React from 'react'
import { ItemDetailView } from '../components/items/ItemDetailView'
import {
  useItem,
  useUpdateItem,
  useCompleteProject,
  useReopenProject,
  useArchiveItem,
  useRestoreItem,
  useDeleteItem,
} from '../hooks/useItems'
import {
  useItemTasks,
  useCreateTask,
  useCompleteTask,
  useIncompleteTask,
  useReorderTasks,
} from '../hooks/useTasks'

const mockProject = {
  id: 1,
  type: 'project' as const,
  title: 'My Project',
  description: 'A desc',
  notes: '',
  archived_at: null,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  project_goal: null,
  project_deadline: null,
  project_status: 'active' as const,
  project_completed_at: null,
  task_count: 0,
  completed_task_count: 0,
  progress_percentage: 0,
}

const mockMutate = vi.fn()

vi.mock('../hooks/useItems', () => ({
  useItem: vi.fn(),
  useUpdateItem: vi.fn(),
  useCompleteProject: vi.fn(),
  useReopenProject: vi.fn(),
  useArchiveItem: vi.fn(),
  useRestoreItem: vi.fn(),
  useDeleteItem: vi.fn(),
}))

vi.mock('../hooks/useSettings', () => ({
  useDeadlineThreshold: vi.fn().mockReturnValue(3),
}))

vi.mock('../hooks/useTasks', () => ({
  useItemTasks: vi.fn().mockReturnValue({ data: [], isLoading: false }),
  useCreateTask: vi.fn().mockReturnValue({ mutate: vi.fn() }),
  useCompleteTask: vi.fn().mockReturnValue({ mutate: vi.fn() }),
  useIncompleteTask: vi.fn().mockReturnValue({ mutate: vi.fn() }),
  useReorderTasks: vi.fn().mockReturnValue({ mutate: vi.fn() }),
}))

const taskListSpy = vi.hoisted(() => ({ props: {} as Record<string, unknown> }))
vi.mock('../components/tasks/TaskList', () => ({
  TaskList: (props: Record<string, unknown>) => {
    taskListSpy.props = props
    return null
  },
}))

vi.mock('../hooks/useLinks', () => ({
  useReferenceLinks: vi.fn(() => ({ data: [] })),
  useAddReferenceLink: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
  useDeleteReferenceLink: vi.fn(() => ({ mutate: vi.fn() })),
  useReorderReferenceLinks: vi.fn(() => ({ mutate: vi.fn() })),
  useLinkedItems: vi.fn(() => ({ data: [] })),
  useLinkResource: vi.fn(() => ({ mutate: vi.fn() })),
  useUnlinkResource: vi.fn(() => ({ mutate: vi.fn() })),
  useLinkedResources: vi.fn(() => ({ data: [] })),
  useLinkResourceToItem: vi.fn(() => ({ mutate: vi.fn() })),
  useUnlinkResourceFromItem: vi.fn(() => ({ mutate: vi.fn() })),
  useConvertItem: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
}))

vi.mock('../components/items/ReferenceLinksSection', () => ({
  ReferenceLinksSection: () => <div data-testid="ref-links">Reference links</div>,
}))

vi.mock('../components/items/ResourceLinksSection', () => ({
  ResourceLinksSection: () => <div data-testid="resource-links">Resource links</div>,
}))

vi.mock('../components/items/ProjectAreaField', () => ({
  ProjectAreaField: () => <div data-testid="project-area">Area</div>,
}))

vi.mock('../components/items/AreaProjectsSection', () => ({
  AreaProjectsSection: () => <div data-testid="area-projects">Projects</div>,
}))

vi.mock('../components/items/LinkedResourcesSection', () => ({
  LinkedResourcesSection: () => <div data-testid="linked-resources">Linked resources</div>,
}))

vi.mock('../components/items/TypeConversionDialog', () => ({
  TypeConversionDialog: () => null,
}))
vi.mock('../components/tasks/TaskDrawer', () => ({
  TaskDrawer: () => null,
}))

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return (
    <MemoryRouter>
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    </MemoryRouter>
  )
}

describe('ItemDetailView', () => {
  beforeEach(() => {
    vi.mocked(useItem).mockReturnValue({
      data: mockProject,
      isLoading: false,
      isError: false,
    } as any)
    vi.mocked(useUpdateItem).mockReturnValue({ mutate: mockMutate, isPending: false } as any)
    vi.mocked(useCompleteProject).mockReturnValue({ mutate: mockMutate, isPending: false } as any)
    vi.mocked(useReopenProject).mockReturnValue({ mutate: mockMutate, isPending: false } as any)
    vi.mocked(useArchiveItem).mockReturnValue({ mutate: mockMutate, isPending: false } as any)
    vi.mocked(useRestoreItem).mockReturnValue({ mutate: mockMutate, isPending: false } as any)
    vi.mocked(useDeleteItem).mockReturnValue({ mutate: mockMutate, isPending: false } as any)
    vi.mocked(useItemTasks).mockReturnValue({ data: [], isLoading: false } as any)
    vi.mocked(useCreateTask).mockReturnValue({ mutate: mockMutate } as any)
    vi.mocked(useCompleteTask).mockReturnValue({ mutate: mockMutate } as any)
    vi.mocked(useIncompleteTask).mockReturnValue({ mutate: mockMutate } as any)
  })

  it('renders item title', () => {
    render(<ItemDetailView id={1} listPath="/projects" listLabel="Projects" />, { wrapper })
    // Title appears in breadcrumb and as the title button
    const matches = screen.getAllByText('My Project')
    expect(matches.length).toBeGreaterThanOrEqual(1)
  })

  it('renders breadcrumb with list link', () => {
    render(<ItemDetailView id={1} listPath="/projects" listLabel="Projects" />, { wrapper })
    expect(screen.getByRole('link', { name: 'Projects' })).toBeTruthy()
  })

  it('title button is clickable to start editing', async () => {
    const user = userEvent.setup()
    render(<ItemDetailView id={1} listPath="/projects" listLabel="Projects" />, { wrapper })
    const titleBtn = screen.getByRole('button', { name: /Edit title/i })
    await user.click(titleBtn)
    expect(screen.getByRole('textbox', { name: 'Item title' })).toBeTruthy()
  })

  it('shows archive notice for archived item', () => {
    vi.mocked(useItem).mockReturnValueOnce({
      data: { ...mockProject, archived_at: '2024-06-01T00:00:00Z' },
      isLoading: false,
      isError: false,
    } as any)
    render(<ItemDetailView id={1} listPath="/projects" listLabel="Projects" />, { wrapper })
    expect(screen.getByText(/Read-only/i)).toBeTruthy()
  })

  it('shows loading skeleton while fetching', () => {
    vi.mocked(useItem).mockReturnValueOnce({
      isLoading: true,
      data: undefined,
      isError: false,
    } as any)
    render(<ItemDetailView id={1} listPath="/projects" listLabel="Projects" />, { wrapper })
    expect(screen.getByRole('status')).toBeTruthy()
  })

  // 2.14: Ready-for-completion banner
  it('shows ready-for-completion banner when all tasks done', () => {
    vi.mocked(useItem).mockReturnValueOnce({
      data: {
        ...mockProject,
        task_count: 5,
        completed_task_count: 5,
        project_status: 'active' as const,
      },
      isLoading: false, isError: false,
    } as any)
    render(<ItemDetailView id={1} listPath="/projects" listLabel="Projects" />, { wrapper })
    expect(screen.getByText(/Ready to complete/i)).toBeTruthy()
  })

  it('does not show ready banner when not all tasks done', () => {
    vi.mocked(useItem).mockReturnValueOnce({
      data: { ...mockProject, task_count: 5, completed_task_count: 3, project_status: 'active' as const },
      isLoading: false, isError: false,
    } as any)
    render(<ItemDetailView id={1} listPath="/projects" listLabel="Projects" />, { wrapper })
    expect(screen.queryByText(/Ready to complete/i)).toBeNull()
  })

  // 2.17: Full archive banner
  it('shows Restore and Delete buttons in archive banner', () => {
    vi.mocked(useItem).mockReturnValueOnce({
      data: { ...mockProject, archived_at: '2024-06-01T00:00:00Z' },
      isLoading: false, isError: false,
    } as any)
    render(<ItemDetailView id={1} listPath="/projects" listLabel="Projects" />, { wrapper })
    expect(screen.getByRole('button', { name: 'Restore' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Delete permanently' })).toBeTruthy()
  })

  // 3.30: Tasks section
  it('shows the add task field when not archived', () => {
    render(<ItemDetailView id={1} listPath="/projects" listLabel="Projects" />, { wrapper })
    expect(screen.getByRole('textbox', { name: 'Add task' })).toBeTruthy()
  })

  it('does not show the add task field when archived', () => {
    vi.mocked(useItem).mockReturnValueOnce({
      data: { ...mockProject, archived_at: '2024-06-01T00:00:00Z' },
      isLoading: false,
      isError: false,
    } as any)
    render(<ItemDetailView id={1} listPath="/projects" listLabel="Projects" />, { wrapper })
    expect(screen.queryByRole('textbox', { name: 'Add task' })).toBeNull()
  })



  it("renders exactly one Convert type menu item", async () => {
    const user = userEvent.setup()
    render(<ItemDetailView id={1} listPath="/projects" listLabel="Projects" />, { wrapper })
    // Open the actions menu
    const menuBtn = screen.getByRole("button", { name: "Item actions" })
    await user.click(menuBtn)
    const convertItems = screen.getAllByText("Convert type")
    expect(convertItems.length).toBe(1)
  })

  it("renders exactly one Reference links section", () => {
    render(<ItemDetailView id={1} listPath="/projects" listLabel="Projects" />, { wrapper })
    const headings = screen.getAllByText(/Reference links/i)
    expect(headings.length).toBe(1)
  })





  it("does not show add task button for Resource items (R3.7)", () => {
    vi.mocked(useItem).mockReturnValueOnce({
      data: {
        ...mockProject,
        type: "resource" as const,
        task_count: 0,
        completed_task_count: 0,
      },
      isLoading: false, isError: false,
    } as any)
    render(<ItemDetailView id={1} listPath="/resources" listLabel="Resources" />, { wrapper })
    expect(screen.queryByRole("textbox", { name: "Add task" })).toBeNull()
  })

  it("project page shows its linked resources", () => {
    render(<ItemDetailView id={1} listPath="/projects" listLabel="Projects" />, { wrapper })
    expect(screen.getByTestId("linked-resources")).toBeTruthy()
    expect(screen.queryByTestId("resource-links")).toBeNull()
  })

  it("resource page shows its linked projects and areas instead", () => {
    vi.mocked(useItem).mockReturnValueOnce({
      data: { ...mockProject, type: "resource" as const },
      isLoading: false, isError: false,
    } as unknown as ReturnType<typeof useItem>)
    render(<ItemDetailView id={1} listPath="/resources" listLabel="Resources" />, { wrapper })
    expect(screen.getByTestId("resource-links")).toBeTruthy()
    expect(screen.queryByTestId("linked-resources")).toBeNull()
  })

  const stats = {
    open_task_count: 4, overdue_task_count: 2, waiting_task_count: 1,
    next_task: { id: 9, title: 'Send report', due_date: '2020-01-01' },
    next_meeting_at: null, last_meeting_at: null, linked_resource_count: 0,
    last_activity_at: '2026-10-28T10:00:00Z', project_count: 3,
  }
  const summaryOf = (container: HTMLElement) => container.querySelector('dl[aria-label="Summary"]')

  it('summary strip: open, overdue and waiting counts and a next-task link that opens its drawer', () => {
    vi.mocked(useItem).mockReturnValue({ data: { ...mockProject, stats }, isLoading: false, isError: false } as any)
    const { container } = render(<ItemDetailView id={1} listPath="/projects" listLabel="Projects" />, { wrapper })
    const text = summaryOf(container)!.textContent!
    expect(text).toContain('Open tasks4')
    expect(text).toContain('Overdue2')
    expect(text).toContain('Waiting1')
    expect(text).not.toContain('Projects')
    expect(screen.getByRole('link', { name: /Send report/ }).getAttribute('href')).toMatch(/\?task=9$/)
  })

  it('an area summary also counts its projects; a resource has no summary', () => {
    vi.mocked(useItem).mockReturnValue({ data: { ...mockProject, type: 'area' as const, stats }, isLoading: false, isError: false } as any)
    const first = render(<ItemDetailView id={1} listPath="/areas" listLabel="Areas" />, { wrapper })
    expect(summaryOf(first.container)!.textContent).toContain('Projects3')
    first.unmount()
    vi.mocked(useItem).mockReturnValue({
      data: { ...mockProject, type: 'resource' as const, stats: { reference_link_count: 1, linked_item_count: 1 } },
      isLoading: false, isError: false,
    } as any)
    const second = render(<ItemDetailView id={1} listPath="/resources" listLabel="Resources" />, { wrapper })
    expect(summaryOf(second.container)).toBeNull()
  })

  it('no summary strip when the item came without stats', () => {
    const { container } = render(<ItemDetailView id={1} listPath="/projects" listLabel="Projects" />, { wrapper })
    expect(summaryOf(container)).toBeNull()
  })

  it('puts tasks and meetings before notes and links', () => {
    const { container } = render(<ItemDetailView id={1} listPath="/projects" listLabel="Projects" />, { wrapper })
    const all = Array.from(container.querySelectorAll('*'))
    const tasks = Array.from(container.querySelectorAll('h3')).find((h) => h.textContent?.startsWith('Tasks'))!
    const meetings = Array.from(container.querySelectorAll('h2')).find((h) => h.textContent?.startsWith('Meetings'))!
    const notes = Array.from(container.querySelectorAll('p')).find((p) => p.textContent === 'Notes')!
    const refs = screen.getByTestId('ref-links')
    expect(all.indexOf(tasks)).toBeLessThan(all.indexOf(meetings))
    expect(all.indexOf(meetings)).toBeLessThan(all.indexOf(notes))
    expect(all.indexOf(notes)).toBeLessThan(all.indexOf(refs))
  })

  describe('adding tasks', () => {
    it('Enter creates a task with that title in this item and clears the field', async () => {
      const user = userEvent.setup()
      const mutate = vi.fn((_payload: unknown, options?: { onSuccess?: () => void }) => options?.onSuccess?.())
      vi.mocked(useCreateTask).mockReturnValue({ mutate, isPending: false } as any)
      render(<ItemDetailView id={1} listPath="/projects" listLabel="Projects" />, { wrapper })
      const field = screen.getByRole('textbox', { name: 'Add task' }) as HTMLInputElement
      await user.type(field, '  Write the plan  {Enter}')
      expect(mutate).toHaveBeenCalledTimes(1)
      expect(mutate.mock.calls[0][0]).toEqual({ title: 'Write the plan', item_id: 1, priority: 'medium' })
      expect(field.value).toBe('')
    })

    it('a blank title creates nothing', async () => {
      const user = userEvent.setup()
      const mutate = vi.fn()
      vi.mocked(useCreateTask).mockReturnValue({ mutate, isPending: false } as any)
      render(<ItemDetailView id={1} listPath="/projects" listLabel="Projects" />, { wrapper })
      await user.type(screen.getByRole('textbox', { name: 'Add task' }), '   {Enter}')
      expect(mutate).not.toHaveBeenCalled()
    })

    it('a failed create keeps what was typed', async () => {
      const user = userEvent.setup()
      vi.mocked(useCreateTask).mockReturnValue({ mutate: vi.fn(), isPending: false } as any)  // never reaches onSuccess
      render(<ItemDetailView id={1} listPath="/projects" listLabel="Projects" />, { wrapper })
      const field = screen.getByRole('textbox', { name: 'Add task' }) as HTMLInputElement
      await user.type(field, 'Keep me{Enter}')
      expect(field.value).toBe('Keep me')
    })

    it('the field is disabled at the 100-task limit', () => {
      const many = Array.from({ length: 100 }, (_, i) => ({ id: i + 1, title: `T${i}` }))
      vi.mocked(useItemTasks).mockReturnValue({ data: many, isLoading: false } as any)
      render(<ItemDetailView id={1} listPath="/projects" listLabel="Projects" />, { wrapper })
      const field = screen.getByRole('textbox', { name: 'Add task' }) as HTMLInputElement
      expect(field.disabled).toBe(true)
      expect(field.placeholder).toContain('maximum of 100')
    })
  })

  describe('reordering tasks', () => {
    it('hands the new order of the open tasks to the server', () => {
      const mutate = vi.fn()
      vi.mocked(useReorderTasks).mockReturnValue({ mutate } as any)
      render(<ItemDetailView id={1} listPath="/projects" listLabel="Projects" />, { wrapper })
      ;(taskListSpy.props.onReorder as (ids: number[]) => void)([3, 1, 2])
      expect(mutate).toHaveBeenCalledWith([3, 1, 2])
    })

    it('an archived item cannot be reordered', () => {
      vi.mocked(useItem).mockReturnValue({
        data: { ...mockProject, archived_at: '2024-06-01T00:00:00Z' }, isLoading: false, isError: false,
      } as any)
      render(<ItemDetailView id={1} listPath="/projects" listLabel="Projects" />, { wrapper })
      expect(taskListSpy.props.onReorder).toBeUndefined()
    })
  })
})
