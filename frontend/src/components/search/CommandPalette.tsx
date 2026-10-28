import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { Command } from "cmdk"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { useSearch } from "@/hooks/useSearch"
import { cn } from "@/lib/utils"

interface CommandPaletteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
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

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const [input, setInput] = useState("")
  const debounced = useDebouncedValue(input, 200)
  const navigate = useNavigate()
  const { data: results = [], isLoading } = useSearch(debounced)

  function close() {
    setInput("")
    onOpenChange(false)
  }

  function handleSelect(value: string) {
    close()
    if (value.startsWith("nav:")) {
      navigate(value.slice(4))
    } else if (value.startsWith("item:")) {
      const [, type, id] = value.split(":")
      navigate(`/${TYPE_ROUTE[type] ?? "projects"}/${id}`)
    } else if (value.startsWith("task:")) {
      const [, taskId, itemId] = value.split(":")
      const base = itemId === "null" ? "/inbox" : `/projects/${itemId}`
      navigate(`${base}?task=${taskId}`)
    }
  }

  const itemResults = results.filter((r) => r.type === "item")
  const taskResults = results.filter((r) => r.type === "task")

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) close() }}>
      <DialogContent className="sm:max-w-lg p-0 overflow-hidden" aria-label="Command palette">
        <Command shouldFilter={false} aria-label="Search">
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
            {/* Navigation shortcuts */}
            {!debounced && (
              <Command.Group heading="Navigate" className="px-2">
                {[
                  { label: "Dashboard", route: "/" },
                  { label: "Inbox", route: "/inbox" },
                  { label: "All tasks", route: "/tasks" },
                  { label: "Projects", route: "/projects" },
                  { label: "Areas", route: "/areas" },
                  { label: "Settings", route: "/settings" },
                ].map(({ label, route }) => (
                  <Command.Item
                    key={route}
                    value={`nav:${route}`}
                    onSelect={handleSelect}
                    className={cn(
                      "flex items-center gap-2 px-2 py-1.5 rounded-control text-sm text-text cursor-pointer",
                      "data-[selected=true]:bg-accent-soft data-[selected=true]:text-accent-text"
                    )}
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
                  value="nav:/tasks"
                  onSelect={handleSelect}
                  className={cn(
                    "flex items-center gap-2 px-2 py-1.5 rounded-control text-sm text-text cursor-pointer",
                    "data-[selected=true]:bg-accent-soft data-[selected=true]:text-accent-text"
                  )}
                >
                  Start weekly review
                </Command.Item>
              </Command.Group>
            )}

            {/* Search results */}
            {debounced && isLoading && (
              <Command.Loading>
                <p className="px-4 py-2 text-sm text-muted">Searching…</p>
              </Command.Loading>
            )}

            {debounced && !isLoading && results.length === 0 && (
              <Command.Empty>
                <p className="px-4 py-6 text-center text-sm text-muted">No results for "{debounced}"</p>
              </Command.Empty>
            )}

            {itemResults.length > 0 && (
              <Command.Group heading="Items" className="px-2">
                {itemResults.map((r) => (
                  <Command.Item
                    key={`item-${r.id}`}
                    value={`item:${r.item_type}:${r.id}`}
                    onSelect={handleSelect}
                    className={cn(
                      "flex items-center justify-between gap-2 px-2 py-1.5 rounded-control text-sm cursor-pointer",
                      "data-[selected=true]:bg-accent-soft"
                    )}
                  >
                    <span className={cn("text-text", r.is_archived && "text-muted")}>{r.title}</span>
                    <span className="text-xs text-muted shrink-0 capitalize">{r.item_type}</span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {taskResults.length > 0 && (
              <Command.Group heading="Tasks" className="px-2">
                {taskResults.map((r) => (
                  <Command.Item
                    key={`task-${r.id}`}
                    value={`task:${r.id}:${r.item_id ?? "null"}`}
                    onSelect={handleSelect}
                    className={cn(
                      "flex items-center gap-2 px-2 py-1.5 rounded-control text-sm cursor-pointer",
                      "data-[selected=true]:bg-accent-soft"
                    )}
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
