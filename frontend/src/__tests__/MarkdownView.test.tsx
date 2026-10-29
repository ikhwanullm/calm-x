import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MarkdownView } from '../components/meetings/MarkdownView'

describe('MarkdownView', () => {
  it('renders headings, lists and inline formatting', () => {
    render(<MarkdownView source={'## Agenda\n\n- one\n- **two**\n\n1. first\n'} />)
    expect(screen.getByRole('heading', { name: 'Agenda' })).toBeTruthy()
    expect(screen.getAllByRole('listitem')).toHaveLength(3)
    expect(screen.getByText('two').tagName).toBe('STRONG')
  })

  it('renders GitHub task lists as disabled checkboxes', () => {
    render(<MarkdownView source={'- [ ] open item\n- [x] done item\n'} />)
    const boxes = screen.getAllByRole('checkbox') as HTMLInputElement[]
    expect(boxes.map((b) => b.checked)).toEqual([false, true])
    expect(boxes.every((b) => b.disabled)).toBe(true)
  })

  it('renders tables', () => {
    render(<MarkdownView source={'| Who | What |\n| --- | --- |\n| Budi | Logs |\n'} />)
    expect(screen.getByRole('table')).toBeTruthy()
    expect(screen.getByRole('cell', { name: 'Budi' })).toBeTruthy()
  })

  it('opens links in a new tab without leaking the opener', () => {
    render(<MarkdownView source="See [the wiki](https://example.com/wiki)." />)
    const link = screen.getByRole('link', { name: 'the wiki' })
    expect(link.getAttribute('href')).toBe('https://example.com/wiki')
    expect(link.getAttribute('target')).toBe('_blank')
    expect(link.getAttribute('rel')).toBe('noopener noreferrer')
  })

  it('does not render raw HTML: it creates no elements and runs nothing', () => {
    const { container } = render(
      <MarkdownView source={'<script>window.__pwned = 1</script>\n\n<img src=x onerror="window.__pwned = 1">\n\n<b>bold?</b>'} />
    )
    expect(container.querySelector('script')).toBeNull()
    expect(container.querySelector('img')).toBeNull()
    expect(container.querySelector('b')).toBeNull()
    expect((window as unknown as { __pwned?: number }).__pwned).toBeUndefined()
  })

  it('drops javascript: link targets', () => {
    render(<MarkdownView source="[click](javascript:alert(1))" />)
    const link = screen.queryByRole('link', { name: 'click' })
    expect(link?.getAttribute('href') ?? '').not.toContain('javascript')
  })

  it('shows a hint instead of an empty preview', () => {
    render(<MarkdownView source={'  \n'} />)
    expect(screen.getByText('Nothing to preview yet.')).toBeTruthy()
  })
})
