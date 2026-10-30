import { Unlink } from "lucide-react"
import { Link } from "react-router-dom"
import { useLinkedItems, useLinkResource, useUnlinkResource } from "@/hooks/useLinks"
import { useItems } from "@/hooks/useItems"
import { notify } from "@/lib/toast"
import { ItemPicker } from "@/components/common"

interface ResourceLinksSectionProps {
  resourceId: number
  isArchived: boolean
}

export function ResourceLinksSection({ resourceId, isArchived }: ResourceLinksSectionProps) {
  const { data: linked = [] } = useLinkedItems(resourceId)
  const { data: allItems = [] } = useItems({ include_archived: false })
  const linkResource = useLinkResource(resourceId)
  const unlinkResource = useUnlinkResource(resourceId)

  const linkedIds = new Set(linked.map((i) => i.id))
  const destinations = allItems.filter(
    (i) => (i.type === "project" || i.type === "area") && !linkedIds.has(i.id)
  )

  function handleLink(itemId: number | null) {
    if (itemId === null) return
    linkResource.mutate(itemId, {
      onSuccess: () => notify.success("Item linked"),
      onError: (err: Error) => notify.error("Could not link item.", err.message),
    })
  }

  return (
    <div className="mt-4 space-y-2">
      <p className="text-xs font-semibold text-muted uppercase tracking-wide">
        Linked projects and areas
      </p>

      {linked.length === 0 && (
        <p className="text-sm text-muted">No linked items yet.</p>
      )}

      {linked.length > 0 && (
        <ul className="space-y-1" aria-label="Linked items">
          {linked.map((item) => (
            <li key={item.id} className="flex items-center gap-2 group">
              <Link
                to={`/${item.type === "project" ? "projects" : "areas"}/${item.id}`}
                className="flex-1 text-sm text-accent-text hover:underline truncate"
              >
                {item.title}
              </Link>
              <span className="text-xs text-muted">{item.type}</span>
              {!isArchived && (
                <button
                  type="button"
                  aria-label={`Unlink ${item.title}`}
                  onClick={() =>
                    unlinkResource.mutate(item.id, {
                      onSuccess: () => notify.success("Item unlinked"),
                    })
                  }
                  className="shrink-0 text-muted hover:text-danger-fg opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                >
                  <Unlink size={13} aria-hidden="true" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {!isArchived && destinations.length > 0 && (
        <ItemPicker
          items={destinations}
          onSelect={handleLink}
          placeholder="Link to…"
          ariaLabel="Link to project or area"
          variant="field"
          className="[&>button]:h-8 [&>button]:bg-surface [&>button]:text-muted"
        />
      )}
    </div>
  )
}
