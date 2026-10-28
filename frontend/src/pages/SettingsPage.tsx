import { useState, useRef, useCallback } from "react"
import { Download, Upload, RefreshCw, HardDrive } from "lucide-react"
import { useTags, useCreateTag, useRenameTag, useDeleteTag } from "@/hooks/useTags"
import { useSettings, useUpdateSettings } from "@/hooks/useSettings"
import { useTheme } from "@/components/ThemeProvider"
import { ConfirmDialog } from "@/components/common"
import { notify } from "@/lib/toast"
import { cn } from "@/lib/utils"
import { isoToLocalDateStr, formatLocalDateTime } from "@/utils/date"
import type { Tag } from "@/types/models"
import type { Theme } from "@/components/ThemeProvider"

// ---------------------------------------------------------------------------
// SettingsPage
// ---------------------------------------------------------------------------

export default function SettingsPage() {
  return (
    <div className="max-w-xl space-y-10">
      <h1 className="text-2xl font-semibold text-text tracking-tight" style={{ letterSpacing: "-0.02em" }}>
        Settings
      </h1>
      <AppearanceSection />
      <DeadlineSection />
      <TagsSettings />
      <BackupSection />
      <DataSection />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Appearance (theme)
// ---------------------------------------------------------------------------

const THEME_OPTIONS: { value: Theme; label: string; description: string }[] = [
  { value: "system", label: "System", description: "Follows your OS preference" },
  { value: "light", label: "Light", description: "Always use light mode" },
  { value: "dark", label: "Dark", description: "Always use dark mode" },
]

function AppearanceSection() {
  const { theme, setTheme } = useTheme()

  return (
    <section aria-labelledby="appearance-heading">
      <h2 id="appearance-heading" className="text-sm font-semibold text-text mb-3">
        Appearance
      </h2>
      <fieldset>
        <legend className="sr-only">Theme</legend>
        <div className="flex flex-col gap-2">
          {THEME_OPTIONS.map(opt => (
            <label
              key={opt.value}
              className={cn(
                "flex items-center gap-3 p-3 rounded-control border cursor-pointer",
                theme === opt.value
                  ? "border-accent bg-accent-soft"
                  : "border-border hover:bg-surface-2"
              )}
            >
              <input
                type="radio"
                name="theme"
                value={opt.value}
                checked={theme === opt.value}
                onChange={() => setTheme(opt.value)}
                className="accent-[var(--accent)]"
              />
              <span>
                <span className="text-sm font-medium text-text">{opt.label}</span>
                <span className="block text-xs text-muted">{opt.description}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Deadline threshold
// ---------------------------------------------------------------------------

function DeadlineSection() {
  const { data: settings } = useSettings()
  const updateSettings = useUpdateSettings()
  const [value, setValue] = useState<string>("")
  const [error, setError] = useState("")
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const currentThreshold = parseInt(settings?.approaching_deadline_threshold ?? "3", 10)
  const displayValue = value !== "" ? value : String(currentThreshold)

  function handleChange(raw: string) {
    setValue(raw)
    setError("")

    const num = parseInt(raw, 10)
    if (isNaN(num)) {
      setError("Must be a number")
      return
    }
    if (num < 1 || num > 30) {
      setError("Must be between 1 and 30")
      return
    }

    // Debounce the API call by 400ms
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      updateSettings.mutate(
        { approaching_deadline_threshold: String(num) },
        {
          onSuccess: () => { setValue(""); notify.success("Threshold updated") },
          onError: (err: Error) => setError(err.message),
        }
      )
    }, 400)
  }

  return (
    <section aria-labelledby="deadline-heading">
      <h2 id="deadline-heading" className="text-sm font-semibold text-text mb-3">
        Deadline threshold
      </h2>
      <div className="flex flex-col gap-2">
        <label htmlFor="threshold-input" className="text-sm text-text">
          Tasks due within{" "}
          <input
            id="threshold-input"
            type="number"
            min={1}
            max={30}
            value={displayValue}
            onChange={e => handleChange(e.target.value)}
            aria-label="Approaching deadline threshold (days)"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "threshold-error" : undefined}
            className={cn(
              "inline-block w-16 h-8 px-2 mx-1 rounded-control border text-sm text-text bg-surface",
              "focus:outline-2 focus:outline-accent",
              error ? "border-danger-fg" : "border-border"
            )}
          />{" "}
          days are marked as due soon.
        </label>
        {error && <p id="threshold-error" role="alert" className="text-xs text-danger-fg">{error}</p>}
        <p className="text-xs text-muted">Changes take effect immediately (1–30 days).</p>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Backup section
// ---------------------------------------------------------------------------

interface BackupEntry {
  filename: string
  size: number
  created_at: string
}

function BackupSection() {
  const [backups, setBackups] = useState<BackupEntry[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)

  const fetchBackups = useCallback(async () => {
    setLoading(true)
    try {
      const { apiClient } = await import("@/api/client")
      const res = await apiClient.get<{ backups: BackupEntry[]; total: number }>("/backup/list")
      setBackups(res.data.backups)
    } catch {
      notify.error("Could not load backups.")
    } finally {
      setLoading(false)
    }
  }, [])

  async function handleCreate() {
    setCreating(true)
    try {
      const { apiClient } = await import("@/api/client")
      const res = await apiClient.post<BackupEntry>("/backup/create")
      notify.success("Backup created", res.data.filename)
      await fetchBackups()
    } catch {
      notify.error("Backup failed.")
    } finally {
      setCreating(false)
    }
  }

  // Load on mount
  const loaded = useRef(false)
  if (!loaded.current) {
    loaded.current = true
    fetchBackups()
  }

  function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <section aria-labelledby="backup-heading">
      <div className="flex items-center justify-between mb-3">
        <h2 id="backup-heading" className="text-sm font-semibold text-text">
          Backups
        </h2>
        <button
          type="button"
          onClick={handleCreate}
          disabled={creating}
          className="flex items-center gap-1.5 h-8 px-3 rounded-control bg-accent text-accent-fg text-xs font-semibold hover:opacity-90 disabled:opacity-50"
        >
          <HardDrive size={13} strokeWidth={1.75} aria-hidden="true" />
          {creating ? "Creating…" : "Create backup now"}
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-muted">Loading backups…</p>
      ) : backups === null ? null : backups.length === 0 ? (
        <p className="text-sm text-muted">No backups yet.</p>
      ) : (
        <ul className="space-y-1.5" aria-label="Backup files">
          {backups.map(b => {
            const localDateTime = formatLocalDateTime(b.created_at)
            const localDate = isoToLocalDateStr(b.created_at)
            return (
              <li
                key={b.filename}
                className="flex items-center justify-between gap-4 px-3 py-2 rounded-control bg-surface border border-border text-sm"
              >
                <span className="text-text font-medium truncate">{b.filename}</span>
                <span className="text-muted shrink-0 tabular-nums text-xs">
                  <time dateTime={localDate} title={localDateTime}>
                    {localDateTime}
                  </time>
                  {" · "}
                  {formatSize(b.size)}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

// ---------------------------------------------------------------------------
// Data section (Export / Import)
// ---------------------------------------------------------------------------

function DataSection() {
  const [importing, setImporting] = useState(false)
  const [importMode, setImportMode] = useState<"merge" | "replace">("merge")
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importSummary, setImportSummary] = useState<Record<string, unknown> | null>(null)
  const [showReplaceConfirm, setShowReplaceConfirm] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function handleExport() {
    try {
      const { apiClient } = await import("@/api/client")
      const res = await apiClient.get("/export", { responseType: "blob" })
      const url = URL.createObjectURL(res.data as Blob)
      const a = document.createElement("a")
      const today = new Date().toISOString().slice(0, 10).replace(/-/g, "")
      a.href = url
      a.download = `calmx_export_${today}.json`
      a.click()
      URL.revokeObjectURL(url)
      notify.success("Export downloaded")
    } catch {
      notify.error("Export failed.")
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImportFile(file)
    setImportSummary(null)

    // Parse and show summary
    try {
      const text = await file.text()
      const data = JSON.parse(text) as Record<string, unknown>
      setImportSummary({
        schema_version: data.schema_version,
        items: (data.items as unknown[])?.length ?? 0,
        tasks: (data.tasks as unknown[])?.length ?? 0,
        tags: (data.tags as unknown[])?.length ?? 0,
        templates: (data.templates as unknown[])?.length ?? 0,
        weekly_reviews: (data.weekly_reviews as unknown[])?.length ?? 0,
      })
    } catch {
      setImportSummary({ error: "Could not parse JSON" })
    }
  }

  async function executeImport() {
    if (!importFile) return
    setImporting(true)
    try {
      const { apiClient } = await import("@/api/client")
      const text = await importFile.text()
      const data = JSON.parse(text)
      await apiClient.post(`/import?mode=${importMode}`, data)
      notify.success("Import successful", `Mode: ${importMode}`)
      setImportFile(null)
      setImportSummary(null)
      if (fileInputRef.current) fileInputRef.current.value = ""
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Import failed"
      notify.error("Import failed", msg)
    } finally {
      setImporting(false)
      setShowReplaceConfirm(false)
    }
  }

  function handleImportClick() {
    if (importMode === "replace") {
      setShowReplaceConfirm(true)
    } else {
      executeImport()
    }
  }

  return (
    <section aria-labelledby="data-heading">
      <h2 id="data-heading" className="text-sm font-semibold text-text mb-4">
        Data
      </h2>

      {/* Export */}
      <div className="mb-6">
        <h3 className="text-xs font-semibold text-muted uppercase tracking-wide mb-2">Export</h3>
        <button
          type="button"
          onClick={handleExport}
          className="flex items-center gap-2 h-9 px-4 rounded-control border border-border bg-surface text-text text-sm font-medium hover:bg-surface-2"
        >
          <Download size={14} strokeWidth={1.75} aria-hidden="true" />
          Export JSON
        </button>
        <p className="text-xs text-muted mt-1">Downloads all data as a JSON file.</p>
      </div>

      {/* Import */}
      <div>
        <h3 className="text-xs font-semibold text-muted uppercase tracking-wide mb-2">Import</h3>

        {/* Mode selection */}
        <div className="flex gap-3 mb-3">
          {(["merge", "replace"] as const).map(m => (
            <label key={m} className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="radio"
                name="import-mode"
                value={m}
                checked={importMode === m}
                onChange={() => setImportMode(m)}
                className="accent-[var(--accent)]"
              />
              <span className="font-medium text-text capitalize">{m}</span>
            </label>
          ))}
        </div>
        <p className="text-xs text-muted mb-3">
          {importMode === "merge"
            ? "Add imported data alongside existing data. Tags are merged by name."
            : "Replace all existing data with the imported file. A backup will be created first."}
        </p>

        {/* File picker */}
        <div className="flex items-center gap-2 flex-wrap">
          <label
            htmlFor="import-file"
            className={cn(
              "flex items-center gap-2 h-9 px-4 rounded-control border border-border bg-surface",
              "text-text text-sm font-medium cursor-pointer hover:bg-surface-2"
            )}
          >
            <Upload size={14} strokeWidth={1.75} aria-hidden="true" />
            Choose JSON file
          </label>
          <input
            id="import-file"
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            onChange={handleFileChange}
            className="sr-only"
          />
          {importFile && (
            <span className="text-sm text-muted truncate max-w-xs">{importFile.name}</span>
          )}
        </div>

        {/* File summary */}
        {importSummary && !("error" in importSummary) && (
          <div className="mt-3 p-3 rounded-control border border-border bg-surface-2 text-sm">
            <p className="font-semibold text-text mb-1">File summary</p>
            <ul className="text-muted space-y-0.5 text-xs">
              {Object.entries(importSummary).map(([k, v]) => (
                <li key={k}><span className="font-medium">{k}:</span> {String(v)}</li>
              ))}
            </ul>
          </div>
        )}
        {importSummary && "error" in importSummary && (
          <p className="mt-2 text-xs text-danger-fg">{String(importSummary.error)}</p>
        )}

        {importFile && importSummary && !("error" in importSummary) && (
          <button
            type="button"
            onClick={handleImportClick}
            disabled={importing}
            className="mt-3 flex items-center gap-2 h-9 px-4 rounded-control bg-accent text-accent-fg text-sm font-semibold hover:opacity-90 disabled:opacity-50"
          >
            <RefreshCw size={14} strokeWidth={1.75} aria-hidden="true" />
            {importing ? "Importing…" : `Import (${importMode})`}
          </button>
        )}
      </div>

      {/* Replace confirmation */}
      <ConfirmDialog
        open={showReplaceConfirm}
        onOpenChange={open => { if (!open) setShowReplaceConfirm(false) }}
        title="Replace all data"
        description="This will replace ALL existing data with the imported file. A backup will be created first. This action cannot be undone."
        confirmLabel="Replace and import"
        onConfirm={executeImport}
        destructive
      />
    </section>
  )
}

// ---------------------------------------------------------------------------
// Tags settings (existing)
// ---------------------------------------------------------------------------

function TagsSettings() {
  const { data: tags = [] } = useTags()
  const createTag = useCreateTag()
  const renameTag = useRenameTag()
  const deleteTag = useDeleteTag()

  const [newName, setNewName] = useState("")
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editValue, setEditValue] = useState("")
  const [renameError, setRenameError] = useState("")
  const [deleteTarget, setDeleteTarget] = useState<Tag | null>(null)
  const newTagInputRef = useRef<HTMLInputElement>(null)

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

  function startEdit(tag: Tag) { setEditingId(tag.id); setEditValue(tag.name) }
  function cancelEdit() { setEditingId(null); setEditValue(""); setRenameError("") }

  function handleRename(tag: Tag) {
    const name = editValue.trim()
    if (!name || name === tag.name) { cancelEdit(); return }
    renameTag.mutate(
      { id: tag.id, payload: { name } },
      {
        onSuccess: () => { cancelEdit(); notify.success(`Renamed to "${name}"`) },
        onError: (err: Error) => setRenameError(err.message),
      }
    )
  }

  function handleDelete() {
    if (!deleteTarget) return
    const { name } = deleteTarget
    deleteTag.mutate(deleteTarget.id, {
      onSuccess: () => {
        setDeleteTarget(null)
        notify.success(`Tag "${name}" deleted`)
        // Return focus to "New tag name" input after deletion
        requestAnimationFrame(() => newTagInputRef.current?.focus())
      },
      onError: (err: Error) => notify.error("Could not delete tag.", err.message),
    })
  }

  return (
    <section aria-labelledby="tags-heading">
      <h2 id="tags-heading" className="text-sm font-semibold text-text mb-4">Tags</h2>
      <div className="space-y-4">
        <form onSubmit={handleCreate} className="flex gap-2" aria-label="Create tag">
          <input
            ref={newTagInputRef}
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
                      onChange={(e) => { setEditValue(e.target.value); setRenameError("") }}
                      onKeyDown={(e) => { if (e.key === "Escape") cancelEdit() }}
                      maxLength={50}
                      aria-label="Edit tag name"
                      autoFocus
                      className={cn(
                        "flex-1 h-7 px-2 rounded-control border border-accent bg-bg text-sm text-text",
                        "focus:outline-2 focus:outline-offset-2 focus:outline-accent"
                      )}
                    />
                    {renameError && (
                      <span className="text-xs text-danger-fg" role="alert">{renameError}</span>
                    )}
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
                      onClick={() => setDeleteTarget(tag)}
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
    </section>
  )
}
