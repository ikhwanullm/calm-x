import { useTags } from "@/hooks/useTags"
import type { FilterParams } from "@/hooks/useFilterTasks"
import { cn } from "@/lib/utils"

interface FilterPanelProps {
  filters: FilterParams
  onChange: (filters: FilterParams) => void
}

const PRIORITIES = ["high", "medium", "low"] as const
const CATEGORIES = [
  { value: "", label: "All categories" },
  { value: "inbox", label: "Inbox" },
  { value: "project", label: "Projects" },
  { value: "area", label: "Areas" },
]

function hasActiveFilters(f: FilterParams): boolean {
  return !!(
    (f.tagIds && f.tagIds.length > 0) ||
    (f.priorities && f.priorities.length > 0) ||
    f.dueStart ||
    f.dueEnd ||
    f.category
  )
}

export function FilterPanel({ filters, onChange }: FilterPanelProps) {
  const { data: tags = [] } = useTags()

  function toggleTag(id: number) {
    const current = filters.tagIds ?? []
    const next = current.includes(id)
      ? current.filter((t) => t !== id)
      : [...current, id]
    onChange({ ...filters, tagIds: next.length ? next : undefined })
  }

  function togglePriority(p: string) {
    const current = filters.priorities ?? []
    const next = current.includes(p)
      ? current.filter((x) => x !== p)
      : [...current, p]
    onChange({ ...filters, priorities: next.length ? next : undefined })
  }

  function clearAll() {
    onChange({})
  }

  return (
    <div className="bg-surface border border-border rounded-card p-4 space-y-4" aria-label="Task filters">
      {/* Tags */}
      {tags.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-2">Tags</p>
          <div className="flex flex-wrap gap-1.5">
            {tags.map((tag) => {
              const active = filters.tagIds?.includes(tag.id)
              return (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => toggleTag(tag.id)}
                  aria-pressed={active}
                  aria-label={`Filter by tag ${tag.name}`}
                  className={cn(
                    "px-2.5 h-6 rounded-pill text-xs font-medium transition-colors",
                    active
                      ? "bg-accent text-accent-fg"
                      : "bg-surface-2 text-text hover:bg-accent-soft hover:text-accent-text"
                  )}
                >
                  #{tag.name}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Priority */}
      <div>
        <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-2">Priority</p>
        <div className="flex gap-1.5">
          {PRIORITIES.map((p) => {
            const active = filters.priorities?.includes(p)
            return (
              <button
                key={p}
                type="button"
                onClick={() => togglePriority(p)}
                aria-pressed={active}
                aria-label={`Filter by ${p} priority`}
                className={cn(
                  "px-3 h-7 rounded-control text-xs font-medium capitalize transition-colors",
                  active
                    ? "bg-accent text-accent-fg"
                    : "bg-surface-2 text-text hover:bg-accent-soft hover:text-accent-text"
                )}
              >
                {p}
              </button>
            )
          })}
        </div>
      </div>

      {/* Due date range */}
      <div>
        <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-2">Due date</p>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={filters.dueStart ?? ""}
            onChange={(e) => onChange({ ...filters, dueStart: e.target.value || undefined })}
            aria-label="Due from"
            className="h-8 px-2 rounded-control border border-border bg-surface text-sm text-text focus:outline-2 focus:outline-offset-2 focus:outline-accent"
          />
          <span className="text-muted text-xs">to</span>
          <input
            type="date"
            value={filters.dueEnd ?? ""}
            onChange={(e) => onChange({ ...filters, dueEnd: e.target.value || undefined })}
            aria-label="Due until"
            className="h-8 px-2 rounded-control border border-border bg-surface text-sm text-text focus:outline-2 focus:outline-offset-2 focus:outline-accent"
          />
        </div>
      </div>

      {/* Category */}
      <div>
        <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-2">Category</p>
        <select
          value={filters.category ?? ""}
          onChange={(e) => onChange({ ...filters, category: e.target.value || undefined })}
          aria-label="Filter by category"
          className="h-8 px-2 rounded-control border border-border bg-surface text-sm text-text focus:outline-2 focus:outline-offset-2 focus:outline-accent"
        >
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
      </div>

      {/* Clear */}
      {hasActiveFilters(filters) && (
        <button
          type="button"
          onClick={clearAll}
          className="text-sm text-danger-fg hover:underline"
        >
          Clear all filters
        </button>
      )}
    </div>
  )
}
