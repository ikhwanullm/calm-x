import { useState, useRef } from "react"
import { ExternalLink, Trash2, Plus, GripVertical } from "lucide-react"
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { useQueryClient } from "@tanstack/react-query"
import {
  useReferenceLinks,
  useAddReferenceLink,
  useDeleteReferenceLink,
  useReorderReferenceLinks,
  linkKeys,
} from "@/hooks/useLinks"
import { notify } from "@/lib/toast"
import { cn } from "@/lib/utils"
import type { ReferenceLink } from "@/types/links"

interface ReferenceLinksProps {
  itemId: number
  isArchived: boolean
}

// Stable empty array — avoids creating a new reference on every render
// when useReferenceLinks has not yet resolved, which would cause an infinite
// render loop via the useEffect pattern.
const EMPTY_LINKS: ReferenceLink[] = []

export function ReferenceLinksSection({ itemId, isArchived }: ReferenceLinksProps) {
  const qc = useQueryClient()
  const { data: links = EMPTY_LINKS } = useReferenceLinks(itemId)
  const addLink = useAddReferenceLink(itemId)
  const deleteLink = useDeleteReferenceLink(itemId)
  const reorderLinks = useReorderReferenceLinks(itemId)
  const [inputUrl, setInputUrl] = useState("")
  const [urlError, setUrlError] = useState("")
  const urlInputRef = useRef<HTMLInputElement>(null)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIdx = links.findIndex((l) => l.id === active.id)
    const newIdx = links.findIndex((l) => l.id === over.id)
    const reordered = [...links]
    reordered.splice(newIdx, 0, reordered.splice(oldIdx, 1)[0])

    // Snapshot for rollback
    const prevLinks = links

    // Optimistic update: write new order directly into the query cache
    qc.setQueryData(linkKeys.forItem(itemId), reordered)

    reorderLinks.mutate(reordered.map((l) => l.id), {
      onSuccess: () => {
        // Refresh from server to ensure canonical sort_order values
        qc.invalidateQueries({ queryKey: linkKeys.forItem(itemId) })
      },
      onError: () => {
        // Rollback to the previous order
        qc.setQueryData(linkKeys.forItem(itemId), prevLinks)
        notify.error("Could not reorder links. Changes reverted.")
      },
    })
  }

  function validateUrl(url: string): boolean {
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      setUrlError("URL must start with http:// or https://")
      return false
    }
    if (url.length > 2000) {
      setUrlError("URL must be 2000 characters or fewer")
      return false
    }
    setUrlError("")
    return true
  }

  function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = inputUrl.trim()
    if (!validateUrl(trimmed)) return
    addLink.mutate(trimmed, {
      onSuccess: () => { setInputUrl(""); notify.success("Link added") },
      onError: (err: Error) => setUrlError(err.message),
    })
  }

  return (
    <div className="mt-4 space-y-2">
      <p className="text-xs font-semibold text-muted uppercase tracking-wide">
        Reference links
      </p>

      {links.length > 0 && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={isArchived ? undefined : handleDragEnd}
        >
          <SortableContext
            items={links.map((l) => l.id)}
            strategy={verticalListSortingStrategy}
          >
            <ul className="space-y-1" aria-label="Reference links" aria-live="polite">
              {links.map((link) => (
                <SortableLinkRow
                  key={link.id}
                  link={link}
                  isArchived={isArchived}
                  onDelete={(id) =>
                    deleteLink.mutate(id, {
                      onSuccess: () => {
                        notify.success("Link removed")
                        // Focus the URL input after deletion so keyboard users can continue
                        requestAnimationFrame(() => urlInputRef.current?.focus())
                      },
                    })
                  }
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}

      {!isArchived && (
        <form onSubmit={handleAdd} className="flex gap-2">
          <div className="flex-1 min-w-0">
            <input
              ref={urlInputRef}
              type="url"
              value={inputUrl}
              onChange={(e) => { setInputUrl(e.target.value); setUrlError("") }}
              placeholder="https://example.com"
              maxLength={2000}
              aria-label="Add reference link URL"
              className={cn(
                "w-full h-8 px-3 rounded-control border bg-surface text-sm text-text placeholder:text-muted",
                "focus:outline-2 focus:outline-offset-2 focus:outline-accent",
                urlError ? "border-danger-fg" : "border-border"
              )}
            />
            {urlError && (
              <p className="mt-0.5 text-xs text-danger-fg" role="alert">{urlError}</p>
            )}
          </div>
          <button
            type="submit"
            disabled={!inputUrl.trim() || addLink.isPending}
            aria-label="Add link"
            className={cn(
              "shrink-0 h-8 px-3 rounded-control bg-accent text-accent-fg text-sm",
              "hover:opacity-90 disabled:opacity-50 transition-opacity"
            )}
          >
            <Plus size={14} aria-hidden="true" />
          </button>
        </form>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sortable row — one reference link with optional drag handle
// ---------------------------------------------------------------------------

function SortableLinkRow({
  link,
  isArchived,
  onDelete,
}: {
  link: ReferenceLink
  isArchived: boolean
  onDelete: (id: number) => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: link.id, disabled: isArchived })

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("flex items-center gap-2 group", isDragging && "opacity-50")}
    >
      {!isArchived && (
        <button
          type="button"
          aria-label={`Reorder link: ${link.url}`}
          className="shrink-0 text-muted cursor-grab active:cursor-grabbing p-0.5 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
          {...attributes}
          {...listeners}
        >
          <GripVertical size={13} aria-hidden="true" />
        </button>
      )}
      <ExternalLink size={13} className="shrink-0 text-muted" aria-hidden="true" />
      <a
        href={link.url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex-1 text-sm text-accent-text hover:underline truncate"
        aria-label={`Open ${link.url}`}
      >
        {link.url}
      </a>
      {!isArchived && (
        <button
          type="button"
          aria-label={`Remove link ${link.url}`}
          onClick={() => onDelete(link.id)}
          className="shrink-0 text-muted hover:text-danger-fg opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
        >
          <Trash2 size={13} aria-hidden="true" />
        </button>
      )}
    </li>
  )
}
