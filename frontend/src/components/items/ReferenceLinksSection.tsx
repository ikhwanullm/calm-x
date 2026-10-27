import { useState } from "react"
import { ExternalLink, Trash2, Plus } from "lucide-react"
import { useReferenceLinks, useAddReferenceLink, useDeleteReferenceLink } from "@/hooks/useLinks"
import { notify } from "@/lib/toast"
import { cn } from "@/lib/utils"

interface ReferenceLinksProps {
  itemId: number
  isArchived: boolean
}

export function ReferenceLinksSection({ itemId, isArchived }: ReferenceLinksProps) {
  const { data: links = [] } = useReferenceLinks(itemId)
  const addLink = useAddReferenceLink(itemId)
  const deleteLink = useDeleteReferenceLink(itemId)
  const [inputUrl, setInputUrl] = useState("")
  const [urlError, setUrlError] = useState("")

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
      onSuccess: () => {
        setInputUrl("")
        notify.success("Link added")
      },
      onError: (err: Error) => setUrlError(err.message),
    })
  }

  return (
    <div className="mt-4 space-y-2">
      <p className="text-xs font-semibold text-muted uppercase tracking-wide">
        Reference links
      </p>

      {links.length > 0 && (
        <ul className="space-y-1" aria-label="Reference links">
          {links.map((link) => (
            <li key={link.id} className="flex items-center gap-2 group">
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
                  onClick={() =>
                    deleteLink.mutate(link.id, {
                      onSuccess: () => notify.success("Link removed"),
                    })
                  }
                  className="shrink-0 text-muted hover:text-danger-fg opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                >
                  <Trash2 size={13} aria-hidden="true" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {!isArchived && (
        <form onSubmit={handleAdd} className="flex gap-2">
          <div className="flex-1 min-w-0">
            <input
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
            {urlError && <p className="mt-0.5 text-xs text-danger-fg" role="alert">{urlError}</p>}
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
