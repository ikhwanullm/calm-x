import { useState } from "react"
import { useTags, useCreateTag, useRenameTag, useDeleteTag } from "@/hooks/useTags"
import { ConfirmDialog } from "@/components/common"
import { notify } from "@/lib/toast"
import { cn } from "@/lib/utils"
import type { Tag } from "@/types/models"

export default function SettingsPage() {
  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-semibold text-text mb-8 tracking-tight" style={{ letterSpacing: "-0.02em" }}>
        Settings
      </h1>
      <section aria-labelledby="tags-heading">
        <h2 id="tags-heading" className="text-sm font-semibold text-text mb-4">Tags</h2>
        <TagsSettings />
      </section>
    </div>
  )
}

function TagsSettings() {
  const { data: tags = [] } = useTags()
  const createTag = useCreateTag()
  const renameTag = useRenameTag()
  const deleteTag = useDeleteTag()

  const [newName, setNewName] = useState("")
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editValue, setEditValue] = useState("")
  const [deleteTarget, setDeleteTarget] = useState<Tag | null>(null)

  function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    const name = newName.trim()
    if (!name) return
    createTag.mutate(
      { name },
      {
        onSuccess: () => { setNewName(""); notify.success(`Tag "${name}" created`) },
        onError: (err: Error) => notify.error("Could not create tag.", err.message),
      }
    )
  }

  function startEdit(tag: Tag) {
    setEditingId(tag.id)
    setEditValue(tag.name)
  }

  function cancelEdit() {
    setEditingId(null)
    setEditValue("")
  }

  function handleRename(tag: Tag) {
    const name = editValue.trim()
    if (!name || name === tag.name) { cancelEdit(); return }
    renameTag.mutate(
      { id: tag.id, payload: { name } },
      {
        onSuccess: () => { cancelEdit(); notify.success(`Renamed to "${name}"`) },
        onError: (err: Error) => notify.error("Could not rename tag.", err.message),
      }
    )
  }

  function confirmDelete(tag: Tag) {
    setDeleteTarget(tag)
  }

  function handleDelete() {
    if (!deleteTarget) return
    const { name } = deleteTarget
    deleteTag.mutate(deleteTarget.id, {
      onSuccess: () => { setDeleteTarget(null); notify.success(`Tag "${name}" deleted`) },
      onError: (err: Error) => notify.error("Could not delete tag.", err.message),
    })
  }

  return (
    <div className="space-y-4">
      {/* Create new tag */}
      <form onSubmit={handleCreate} className="flex gap-2" aria-label="Create tag">
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New tag name"
          maxLength={50}
          aria-label="New tag name"
          className={cn(
            "flex-1 h-9 px-3 rounded-control border border-border bg-surface text-sm text-text placeholder:text-muted",
            "focus:outline-2 focus:outline-offset-2 focus:outline-accent"
          )}
        />
        <button
          type="submit"
          disabled={!newName.trim() || createTag.isPending}
          className="h-9 px-4 rounded-control bg-accent text-accent-fg text-sm font-medium hover:opacity-90 disabled:opacity-50"
        >
          Add
        </button>
      </form>

      {/* Tag list */}
      {tags.length === 0 ? (
        <p className="text-sm text-muted">No tags yet. Create one above.</p>
      ) : (
        <ul className="space-y-1" aria-label="Tags list">
          {tags.map((tag) => (
            <li key={tag.id} className="flex items-center gap-2 px-3 py-2 rounded-control bg-surface border border-border group">
              {editingId === tag.id ? (
                <form
                  onSubmit={(e) => { e.preventDefault(); handleRename(tag) }}
                  className="flex items-center gap-2 flex-1"
                >
                  <input
                    type="text"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Escape") cancelEdit() }}
                    maxLength={50}
                    aria-label="Edit tag name"
                    autoFocus
                    className={cn(
                      "flex-1 h-7 px-2 rounded-control border border-accent bg-bg text-sm text-text",
                      "focus:outline-2 focus:outline-offset-2 focus:outline-accent"
                    )}
                  />
                  <button type="submit" className="text-sm text-accent-text hover:underline">Save</button>
                  <button type="button" onClick={cancelEdit} className="text-sm text-muted hover:text-text">Cancel</button>
                </form>
              ) : (
                <>
                  <span className="flex-1 text-sm text-text">#{tag.name}</span>
                  <button
                    type="button"
                    onClick={() => startEdit(tag)}
                    aria-label={`Rename tag ${tag.name}`}
                    className="text-xs text-muted hover:text-text opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                  >
                    Rename
                  </button>
                  <button
                    type="button"
                    onClick={() => confirmDelete(tag)}
                    aria-label={`Delete tag ${tag.name}`}
                    className="text-xs text-danger-fg hover:underline opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                  >
                    Delete
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(v) => { if (!v) setDeleteTarget(null) }}
        title={`Delete tag "${deleteTarget?.name ?? ""}"`}
        description="This tag will be removed from all tasks. This cannot be undone."
        confirmLabel="Delete tag"
        onConfirm={handleDelete}
        destructive
      />
    </div>
  )
}
