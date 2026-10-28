import { useEffect, useRef, useState } from "react"
import { Link } from "react-router-dom"
import { useItems } from "@/hooks/useItems"
import type { Project } from "@/types/models"
import { cn } from "@/lib/utils"

interface ProjectAreaFieldProps {
  project: Project
  disabled: boolean
  onChange: (areaId: number | null) => void
}

/** The optional parent Area of a Project, shown and changed inline in the project header. */
export function ProjectAreaField({ project, disabled, onChange }: ProjectAreaFieldProps) {
  const [isEditing, setIsEditing] = useState(false)
  const { data: areas = [] } = useItems({ type: "area" })
  const selectRef = useRef<HTMLSelectElement>(null)

  useEffect(() => {
    if (isEditing) selectRef.current?.focus()
  }, [isEditing])

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const value = e.target.value
    onChange(value ? Number(value) : null)
    setIsEditing(false)
  }

  if (isEditing) {
    return (
      <div className="mt-2 flex items-center gap-2">
        <select
          ref={selectRef}
          defaultValue={project.area_id ? String(project.area_id) : ""}
          onChange={handleChange}
          onKeyDown={(e) => { if (e.key === "Escape") setIsEditing(false) }}
          aria-label="Project area"
          className={cn(
            "h-9 px-2 text-sm rounded-control border border-border-strong bg-surface text-text",
            "focus:outline-2 focus:outline-offset-2 focus:outline-accent"
          )}
        >
          <option value="">No area</option>
          {areas.map((area) => (
            <option key={area.id} value={String(area.id)}>{area.title}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setIsEditing(false)}
          className="h-9 px-3 rounded-control text-muted text-xs hover:text-text"
        >
          Cancel
        </button>
      </div>
    )
  }

  return (
    <div className="mt-2 flex items-center gap-2 text-sm">
      {project.area_id && project.area_title ? (
        <>
          <span className="text-muted">Area</span>
          <Link to={`/areas/${project.area_id}`} className="text-accent-text hover:underline">
            {project.area_title}
          </Link>
          {project.area_archived && <span className="text-xs text-muted">(Archived)</span>}
        </>
      ) : null}
      {!disabled && (
        <button
          type="button"
          onClick={() => setIsEditing(true)}
          className={cn(
            "text-xs font-medium hover:underline",
            project.area_id ? "text-muted hover:text-accent-text" : "text-accent-text"
          )}
        >
          {project.area_id ? "Change area" : "+ Add to an area"}
        </button>
      )}
    </div>
  )
}
