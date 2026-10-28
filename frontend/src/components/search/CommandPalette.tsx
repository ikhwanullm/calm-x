import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { Command } from "cmdk"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { useSearch } from "@/hooks/useSearch"
import { cn } from "@/lib/utils"

interface CommandPaletteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Callback to open the Quick Capture dialog */
  onQuickCapture?: () => void
  /** Callback to open the New Item dialog with project type */
  onNewProject?: () => void
}

function useDebouncedValue(value: string, delay = 200) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

const TYPE_ROUTE: Record<string, string> = {
  project: "projects",
  area: "areas",
  resource: "resources",
}

const NAV_ITEMS = [
  { label: "Dashboard", route: "/" },
  { label: "Today", route: "/today" },
  { label: "Inbox", route: "/inbox" },
  { label: "All tasks", route: "/tasks" },
  { label: "Projects", route: "/projects" },
  { label: "Areas", route: "/areas" },
  { label: "Resources", route: "/resources" },
  { label: "Archive", route: "/archive" },
  { label: "Templates", route: "/templates" },
  { label: "Weekly review", route: "/review" },
  { label: "Settings", route: "/settings" },
]

export function CommandPalette({ open, onOpenChange, onQuickCapture, onNewProject }: CommandPaletteProps) {
  const [input, setInput] = useState("")
  const debounced = useDebouncedValue(input, 200)
  const navigate = useNavigate()
  const { data: results = [], isLoading } = useSearch(debounced)

  function close() {
    setInput("")
    onOpenChange(false)
  }

  function handleSelect(value: string) {
    if (value === "action:quick-capture") {
      close()
      onQuickCapture?.()
      return
    }
    if (value === "action:new-project") {
      close()
      if (onNewProject) {
        onNewProject()
      } else {
        navigate("/projects")
      }
      return
    }
    close()
    if (value.startsWith("nav:")) {
      navigate(value.slice(4))
    } else if (value.startsWith("item:")) {
      const [, type, id] = value.split(":")
      navigate(`/${TYPE_ROUTE[type] ?? "projects"}/${id}`)
    } else if (value.startsWith("task:")) {
      const [, taskId, itemId] = value.split(":")
      if (itemId === "null") {
        navigate(`/inbox?task=${taskId}`)
      } else {
        // Navigate to item detail with task open
        navigate(`/tasks?task=${taskId}`)
      }
    }
  }

  // Group search results by item_type
  const projectResults = results.filter((r) => r.type === "item" && r.item_type === "project")
  const areaResults = results.filter((r) => r.type === "item" && r.item_type === "area")
  const resourceResults = results.filter((r) => r.type === "item" && r.item_type === "resource")
  const taskResults = results.filter((r) => r.type === "task")

  const itemClassName = cn(
    "flex items-center justify-between gap-2 px-2 py-1.5 rounded-control text-sm cursor-pointer",
    "data-[selected=true]:bg-accent-soft data-[selected=true]:text-accent-text"
  )

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) close() }}>
      <DialogContent className="sm:max-w-lg p-0 overflow-hidden" aria-label="Command palette">
        <Command shouldFilter={false} aria-label="Command palette">
          <div className="flex items-center border-b border-border px-4">
            <Command.Input
              value={input}
              onValueChange={setInput}
              placeholder="Search items, tasks, or navigate…"
              className={cn(
                "flex-1 h-12 bg-transparent text-sm text-text placeholder:text-muted",
                "focus:outline-none"
              )}
              aria-label="Search query"
            />
          </div>

          <Command.List className="max-h-96 overflow-y-auto py-2" aria-label="Search results">
            {/* Navigation */}
            {!debounced && (
              <Command.Group heading="Navigate" className="px-2">
                {NAV_ITEMS.map(({ label, route }) => (
                  <Command.Item
                    key={route}
                    value={`nav:${route}`}
                    onSelect={handleSelect}
                    className={itemClassName}
                  >
                    {label}
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {/* Actions */}
            {!debounced && (
              <Command.Group heading="Actions" className="px-2">
                <Command.Item
                  value="action:quick-capture"
                  onSelect={handleSelect}
                  className={itemClassName}
                  aria-label="Open Quick capture"
                >
                  Quick capture
                </Command.Item>
                <Command.Item
                  value="action:new-project"
                  onSelect={handleSelect}
                  className={itemClassName}
                  aria-label="New project"
                >
                  New project
                </Command.Item>
                <Command.Item
                  value="nav:/review"
                  onSelect={handleSelect}
                  className={itemClassName}
                >
                  Start weekly review
                </Command.Item>
              </Command.Group>
            )}

            {/* Search results — loading */}
            {debounced && isLoading && (
              <Command.Loading>
                <p className="px-4 py-2 text-sm text-muted">Searching…</p>
              </Command.Loading>
            )}

            {/* Search results — empty */}
            {debounced && !isLoading && results.length === 0 && (
              <Command.Empty>
                <p className="px-4 py-6 text-center text-sm text-muted">
                  No results for &quot;{debounced}&quot;
                </p>
              </Command.Empty>
            )}

            {/* Grouped results: Projects */}
            {projectResults.length > 0 && (
              <Command.Group heading="Projects" className="px-2">
                {projectResults.map((r) => (
                  <Command.Item
                    key={`item-${r.id}`}
                    value={`item:project:${r.id}`}
                    onSelect={handleSelect}
                    className={itemClassName}
                  >
                    <span className={cn("text-text", r.is_archived && "text-muted")}>{r.title}</span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {/* Grouped results: Areas */}
            {areaResults.length > 0 && (
              <Command.Group heading="Areas" className="px-2">
                {areaResults.map((r) => (
                  <Command.Item
                    key={`item-${r.id}`}
                    value={`item:area:${r.id}`}
                    onSelect={handleSelect}
                    className={itemClassName}
                  >
                    <span className={cn("text-text", r.is_archived && "text-muted")}>{r.title}</span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {/* Grouped results: Resources */}
            {resourceResults.length > 0 && (
              <Command.Group heading="Resources" className="px-2">
                {resourceResults.map((r) => (
                  <Command.Item
                    key={`item-${r.id}`}
                    value={`item:resource:${r.id}`}
                    onSelect={handleSelect}
                    className={itemClassName}
                  >
                    <span className={cn("text-text", r.is_archived && "text-muted")}>{r.title}</span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {/* Grouped results: Tasks */}
            {taskResults.length > 0 && (
              <Command.Group heading="Tasks" className="px-2">
                {taskResults.map((r) => (
                  <Command.Item
                    key={`task-${r.id}`}
                    value={`task:${r.id}:${r.item_id ?? "null"}`}
                    onSelect={handleSelect}
                    className={itemClassName}
                  >
                    <span className={cn("text-text", r.is_archived && "text-muted")}>{r.title}</span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}
          </Command.List>
        </Command>
      </DialogContent>
    </Dialog>
  )
}
