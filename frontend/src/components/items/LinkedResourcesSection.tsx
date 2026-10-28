import { Unlink } from "lucide-react"
import { Link } from "react-router-dom"
import {
  useLinkedResources,
  useLinkResourceToItem,
  useUnlinkResourceFromItem,
} from "@/hooks/useLinks"
import { useItems } from "@/hooks/useItems"
import { cn } from "@/lib/utils"

interface LinkedResourcesSectionProps {
  itemId: number
  isArchived: boolean
}

/** Resources linked to a Project or Area (the reverse side of ResourceLinksSection). */
export function LinkedResourcesSection({ itemId, isArchived }: LinkedResourcesSectionProps) {
  const { data: linked = [] } = useLinkedResources(itemId)
  const { data: resources = [] } = useItems({ type: "resource" })
  const linkResource = useLinkResourceToItem(itemId)
  const unlinkResource = useUnlinkResourceFromItem(itemId)

  const linkedIds = new Set(linked.map((r) => r.id))
  const available = resources.filter((r) => !linkedIds.has(r.id))

  function handleLink(e: React.ChangeEvent<HTMLSelectElement>) {
    const val = e.target.value
    if (!val) return
    linkResource.mutate(Number(val))
    e.target.value = ""
  }

  return (
    <div className="mt-4 space-y-2">
      <p className="text-xs font-semibold text-muted uppercase tracking-wide">
        Linked resources
      </p>

      {linked.length === 0 && (
        <p className="text-sm text-muted">No linked resources yet.</p>
      )}

      {linked.length > 0 && (
        <ul className="space-y-1" aria-label="Linked resources">
          {linked.map((resource) => (
            <li key={resource.id} className="flex items-center gap-2 group">
              <Link
                to={`/resources/${resource.id}`}
                className="flex-1 text-sm text-accent-text hover:underline truncate"
              >
                {resource.title}
              </Link>
              {resource.archived_at && <span className="text-xs text-muted">Archived</span>}
              {!isArchived && !resource.archived_at && (
                <button
                  type="button"
                  aria-label={`Unlink ${resource.title}`}
                  onClick={() => unlinkResource.mutate(resource.id)}
                  className="shrink-0 text-muted hover:text-danger-fg opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                >
                  <Unlink size={13} aria-hidden="true" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {!isArchived && available.length > 0 && (
        <select
          defaultValue=""
          onChange={handleLink}
          aria-label="Link a resource"
          className={cn(
            "w-full h-9 px-2 text-sm rounded-control border border-border-strong bg-surface text-muted",
            "focus:outline-2 focus:outline-offset-2 focus:outline-accent"
          )}
        >
          <option value="" disabled>Link a resource…</option>
          {available.map((resource) => (
            <option key={resource.id} value={String(resource.id)}>
              {resource.title}
            </option>
          ))}
        </select>
      )}
    </div>
  )
}
