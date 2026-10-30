import { useEffect, useRef, useState } from 'react'
import { LayoutGrid, List, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ViewMode } from '@/hooks/useViewMode'

export type ToolbarChip =
  | { kind: 'toggle'; id: string; label: string; pressed: boolean; onToggle: () => void }
  | { kind: 'select'; id: string; label: string; /** Text of the '' option when it differs from the label */ emptyLabel?: string; value: string; options: { value: string; label: string }[]; onChange: (value: string) => void }

export interface ListToolbarProps {
  searchValue: string
  onSearchChange: (value: string) => void
  searchLabel: string
  sort?: { value: string; options: { value: string; label: string }[]; onChange: (value: string) => void }
  chips?: ToolbarChip[]
  view?: { value: ViewMode; onChange: (mode: ViewMode) => void }
  hasActiveFilters: boolean
  onClear: () => void
  /** Extra controls (e.g. a group-by select) placed after the sort select. */
  children?: React.ReactNode
}

const CONTROL = 'h-9 px-2 text-sm rounded-control border border-border-strong bg-surface text-text focus:outline-2 focus:outline-offset-2 focus:outline-accent'

const DEBOUNCE_MS = 250

/** Search, sort, filter chips and view toggle, shared by the list pages. State lives in the caller (the URL). */
export function ListToolbar({
  searchValue, onSearchChange, searchLabel, sort, chips = [], view, hasActiveFilters, onClear, children,
}: ListToolbarProps) {
  const [text, setText] = useState(searchValue)
  const lastSent = useRef(searchValue)

  // Follow outside changes (Clear filters, back button) but not our own debounced writes
  useEffect(() => {
    if (searchValue !== lastSent.current) {
      lastSent.current = searchValue
      setText(searchValue)
    }
  }, [searchValue])

  useEffect(() => {
    if (text === lastSent.current) return
    const timer = setTimeout(() => {
      lastSent.current = text
      onSearchChange(text)
    }, DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [text, onSearchChange])

  return (
    <div className="flex flex-wrap items-center gap-2 mb-4" role="search">
      <div className="relative">
        <Search size={14} aria-hidden="true" className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
        <input
          type="search"
          value={text}
          onChange={(e) => setText(e.target.value)}
          aria-label={searchLabel}
          placeholder="Search…"
          className={cn(CONTROL, 'pl-8 w-56')}
        />
      </div>

      {sort && (
        <select value={sort.value} onChange={(e) => sort.onChange(e.target.value)} aria-label="Sort by" className={CONTROL}>
          {sort.options.map((o) => <option key={o.value} value={o.value}>Sort: {o.label}</option>)}
        </select>
      )}

      {children}

      {chips.map((chip) =>
        chip.kind === 'toggle' ? (
          <button
            key={chip.id}
            type="button"
            aria-pressed={chip.pressed}
            onClick={chip.onToggle}
            className={cn(
              'h-9 px-3 text-sm rounded-pill border',
              chip.pressed ? 'bg-accent-soft text-accent-text border-accent' : 'bg-surface text-muted border-border-strong hover:text-text'
            )}
          >
            {chip.label}
          </button>
        ) : (
          <select
            key={chip.id}
            value={chip.value}
            onChange={(e) => chip.onChange(e.target.value)}
            aria-label={chip.label}
            className={cn(CONTROL, chip.value !== '' && 'border-accent bg-accent-soft text-accent-text')}
          >
            {chip.options.map((o) => <option key={o.value} value={o.value}>{o.value === '' ? chip.emptyLabel ?? chip.label : o.label}</option>)}
          </select>
        )
      )}

      {hasActiveFilters && (
        <button type="button" onClick={onClear} className="text-sm text-accent-text underline underline-offset-2 hover:opacity-80">
          Clear filters
        </button>
      )}

      {view && (
        <div className="ml-auto inline-flex rounded-control border border-border-strong overflow-hidden" role="group" aria-label="View">
          {([['cards', LayoutGrid, 'Card view'], ['list', List, 'List view']] as const).map(([mode, Icon, label]) => (
            <button
              key={mode}
              type="button"
              aria-label={label}
              aria-pressed={view.value === mode}
              onClick={() => view.onChange(mode)}
              className={cn('h-9 w-9 inline-flex items-center justify-center', view.value === mode ? 'bg-accent-soft text-accent-text' : 'bg-surface text-muted hover:text-text')}
            >
              <Icon size={16} aria-hidden="true" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
