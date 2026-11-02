import { useState } from 'react'
import { useUpdateTask } from '@/hooks/useTasks'
import { useTags } from '@/hooks/useTags'

export function TagsSection({ taskId, currentTags }: { taskId: number; currentTags: string[] }) {
  const { data: allTags = [] } = useTags()
  const updateTask = useUpdateTask(taskId)
  const [inputValue, setInputValue] = useState('')
  const MAX_TAGS = 20

  function addTag(name: string) {
    const trimmed = name.trim().toLowerCase()
    if (!trimmed) return
    if (currentTags.length >= MAX_TAGS) return
    if (currentTags.includes(trimmed)) return
    // Assign updated tag list; backend creates the tag if it does not exist yet
    updateTask.mutate({ tag_names: [...currentTags, trimmed] })
    setInputValue('')
  }

  function removeTag(name: string) {
    updateTask.mutate({ tag_names: currentTags.filter((t) => t !== name) })
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text">Tags</h3>
        <span className="text-xs text-muted">{currentTags.length}/{MAX_TAGS}</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {currentTags.map(tag => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 px-2 h-5 rounded bg-surface-2 text-xs text-text"
          >
            #{tag}
            <button
              type="button"
              onClick={() => removeTag(tag)}
              aria-label={`Remove tag ${tag}`}
              className="text-muted hover:text-danger-fg"
            >
              ×
            </button>
          </span>
        ))}
      </div>
      {currentTags.length < MAX_TAGS && (
        <div className="flex gap-2">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); addTag(inputValue) }
            }}
            placeholder="Add tag…"
            list="available-tags"
            maxLength={50}
            aria-label="Add tag"
            className="flex-1 h-8 px-2 rounded-control border border-border bg-surface text-sm text-text placeholder:text-muted focus:outline-2 focus:outline-offset-2 focus:outline-accent"
          />
          <datalist id="available-tags">
            {allTags
              .filter(t => !currentTags.includes(t.name))
              .map(t => <option key={t.id} value={t.name} />)}
          </datalist>
        </div>
      )}
    </div>
  )
}
