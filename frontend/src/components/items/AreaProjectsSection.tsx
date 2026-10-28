import { Link } from "react-router-dom"
import { useItems } from "@/hooks/useItems"
import { useDeadlineThreshold } from "@/hooks/useSettings"
import { StatusBadge } from "@/components/common"
import { getDeadlineStatus } from "@/utils/deadline"
import { getLocalToday } from "@/utils/date"
import { isProject } from "@/types/models"

interface AreaProjectsSectionProps {
  areaId: number
  isArchived: boolean
}

/** Projects that belong to an Area, shown on the Area page. */
export function AreaProjectsSection({ areaId, isArchived }: AreaProjectsSectionProps) {
  const { data: items = [] } = useItems({ type: "project", area_id: areaId })
  const threshold = useDeadlineThreshold()
  const today = getLocalToday()
  const projects = items.filter(isProject)

  return (
    <section className="mt-6" aria-labelledby={`area-${areaId}-projects`}>
      <h2 id={`area-${areaId}-projects`} className="text-xs font-semibold text-muted uppercase tracking-wide mb-2">
        Projects <span className="font-normal tabular-nums">{projects.length || ""}</span>
      </h2>

      {projects.length === 0 ? (
        <p className="text-sm text-muted">
          No projects in this area yet. Open a project and choose this area to add it here.
        </p>
      ) : (
        <ul className="space-y-1" aria-label="Projects in this area">
          {projects.map((project) => {
            const completed = project.project_status === "completed"
            const status = !isArchived && !completed && project.project_deadline
              ? getDeadlineStatus(project.project_deadline, false, threshold, today)
              : null
            return (
              <li
                key={project.id}
                className="flex items-center gap-3 min-h-[44px] px-3 py-2 rounded-control border border-border bg-surface"
              >
                <Link
                  to={`/projects/${project.id}`}
                  className="flex-1 min-w-0 truncate text-sm font-medium text-text hover:text-accent-text"
                >
                  {project.title}
                </Link>
                {completed ? (
                  <span className="text-xs text-muted">Completed</span>
                ) : (
                  <span className="text-xs text-muted tabular-nums">{project.progress_percentage}%</span>
                )}
                {status && project.project_deadline && (
                  <StatusBadge status={status} date={project.project_deadline} today={today} />
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
