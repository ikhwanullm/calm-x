import { Link } from "react-router-dom"
import { useDashboard } from "@/hooks/useDashboard"
import { useDeadlineThreshold } from "@/hooks/useSettings"
import { ProgressBar, StatusBadge, Skeleton, EmptyState } from "@/components/common"
import { getDeadlineStatus } from "@/utils/deadline"
import { getLocalToday, formatAbsoluteDate } from "@/utils/date"
import type { DeadlineItem, ProjectSummary } from "@/types/dashboard"

export default function DashboardPage() {
  const { data, isLoading } = useDashboard()
  const threshold = useDeadlineThreshold()
  const today = getLocalToday()

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-text tracking-tight">Dashboard</h1>
        <div className="flex flex-col items-end gap-0.5">
          <Link
            to="/review"
            className="h-9 px-4 rounded-control bg-accent text-accent-fg text-sm font-medium flex items-center hover:opacity-90 transition-opacity"
          >
            Start weekly review
          </Link>
          {data?.last_review_date ? (
            <p className="text-xs text-muted">
              Last review: {formatAbsoluteDate(data.last_review_date)}
            </p>
          ) : (
            <p className="text-xs text-muted">No reviews yet</p>
          )}
        </div>
      </div>

      {/* Summary cards ? 3 columns at xl, 2 at md */}
      <div className="grid grid-cols-2 xl:grid-cols-3 gap-4">
        <SummaryCard
          title="Inbox"
          loading={isLoading}
          stat={data?.inbox_count ?? 0}
          statLabel="open tasks"
          action={<Link to="/inbox" className="text-xs text-accent-text hover:underline">Process inbox →</Link>}
        />
        <SummaryCard
          title="Projects"
          loading={isLoading}
          stat={data?.active_projects_count ?? 0}
          statLabel="active"
          sub={data ? `${data.active_task_count} open ${data.active_task_count === 1 ? "task" : "tasks"}${data.nearest_deadline_project ? " · nearest " + data.nearest_deadline_project : ""}` : undefined}
        />
        <SummaryCard
          title="Areas"
          loading={isLoading}
          stat={data?.areas_count ?? 0}
          statLabel="total"
          sub={data ? `${data.area_task_count} open ${data.area_task_count === 1 ? "task" : "tasks"}` : undefined}
        />
        <SummaryCard
          title="Resources"
          loading={isLoading}
          stat={data?.resources_count ?? 0}
          statLabel="total"
          sub={data != null ? `${data.reference_link_count} reference links` : undefined}
        />
        <SummaryCard
          title="Archives"
          loading={isLoading}
          stat={data?.archives_count ?? 0}
          statLabel="archived items"
          action={<Link to="/archive" className="text-xs text-accent-text hover:underline">View archive →</Link>}
        />
        <OverallProgressCard loading={isLoading} value={data?.overall_progress ?? null} />
      </div>

      {/* Needs attention */}
      <section aria-labelledby="needs-attention-heading">
        <h2 id="needs-attention-heading" className="text-sm font-semibold text-text mb-3">
          Needs attention
        </h2>
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2].map((i) => <Skeleton key={i} className="h-12 w-full" delay={0} />)}
          </div>
        ) : (data?.upcoming_deadlines.length ?? 0) === 0 ? (
          <EmptyState
            title="Nothing overdue or due soon."
            description="You’re all caught up!"
            dashedBorder
          />
        ) : (
          <ul className="space-y-2" aria-label="Items needing attention">
            {data!.upcoming_deadlines.map((item) => (
              <NeedsAttentionRow key={`${item.type}-${item.id}`} item={item} today={today} threshold={threshold} />
            ))}
          </ul>
        )}
      </section>

      {/* Active projects */}
      <section aria-labelledby="active-projects-heading">
        <h2 id="active-projects-heading" className="text-sm font-semibold text-text mb-3">
          Active projects
        </h2>
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" delay={0} />)}
          </div>
        ) : (data?.active_projects.length ?? 0) === 0 ? (
          <EmptyState title="No active projects." description="Create a project to get started." />
        ) : (
          <ul className="space-y-2" aria-label="Active projects">
            {data!.active_projects.map((p) => (
              <ActiveProjectRow key={p.id} project={p} today={today} threshold={threshold} />
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

// ---- Summary card ----

function SummaryCard({
  title, loading, stat, statLabel, sub, action,
}: {
  title: string
  loading: boolean
  stat: number
  statLabel: string
  sub?: string
  action?: React.ReactNode
}) {
  return (
    <div className="bg-surface rounded-card border border-border p-5 shadow-card flex flex-col gap-2">
      <p className="text-xs font-semibold text-muted uppercase tracking-wide">{title}</p>
      {loading ? (
        <Skeleton className="h-8 w-16" delay={0} />
      ) : (
        <p className="text-3xl font-semibold text-text tabular-nums tracking-tight" style={{ letterSpacing: "-0.02em" }}>
          {stat}
        </p>
      )}
      <p className="text-xs text-muted">{loading ? "…" : statLabel}</p>
      {sub && <p className="text-xs text-muted">{sub}</p>}
      {action && <div className="mt-auto pt-1">{action}</div>}
    </div>
  )
}

// ---- Overall progress card ----

function OverallProgressCard({ loading, value }: { loading: boolean; value: number | null }) {
  return (
    <div className="bg-surface rounded-card border border-border p-5 shadow-card flex flex-col gap-2">
      <p className="text-xs font-semibold text-muted uppercase tracking-wide">Overall progress</p>
      {loading ? (
        <Skeleton className="h-8 w-16" delay={0} />
      ) : value == null ? (
        <p className="text-sm text-muted">No eligible projects</p>
      ) : (
        <>
          <p className="text-3xl font-semibold text-text tabular-nums" style={{ letterSpacing: "-0.02em" }}>
            {value}%
          </p>
          <ProgressBar completed={value} total={100} label="Overall project progress" />
        </>
      )}
    </div>
  )
}

// ---- Needs attention row ----

function NeedsAttentionRow({
  item, today, threshold,
}: {
  item: DeadlineItem
  today: string
  threshold: number
}) {
  const status = getDeadlineStatus(item.deadline, false, threshold, today)
  // For tasks: link to parent item page, or inbox if no parent
  // For projects: link to projects page
  const href = item.type === "project"
    ? `/projects/${item.id}`
    : item.item_id != null
      ? `/${item.item_id}`    // will navigate to project/area detail
      : "/inbox"

  return (
    <li className="flex items-center justify-between gap-3 py-2 px-3 rounded-control bg-surface border border-border">
      <div className="min-w-0">
        <p className="text-sm font-medium text-text truncate">
          {item.type === "task" && (
            <span className="text-xs text-muted mr-1.5">Task</span>
          )}
          <Link to={href} className="hover:text-accent-text">{item.title}</Link>
        </p>
      </div>
      {status && (
        <StatusBadge status={status} date={item.deadline} today={today} />
      )}
    </li>
  )
}

// ---- Active project row ----

function ActiveProjectRow({
  project, today, threshold,
}: {
  project: ProjectSummary
  today: string
  threshold: number
}) {
  const deadlineStatus = project.project_deadline
    ? getDeadlineStatus(project.project_deadline, false, threshold, today)
    : null

  return (
    <li className="flex flex-col gap-2 py-3 px-4 rounded-control bg-surface border border-border">
      <div className="flex items-center justify-between gap-3">
        <Link
          to={`/projects/${project.id}`}
          className="text-sm font-medium text-text hover:text-accent-text truncate"
        >
          {project.title}
        </Link>
        <div className="flex items-center gap-2 shrink-0">
          {deadlineStatus ? (
            <StatusBadge status={deadlineStatus} date={project.project_deadline!} today={today} />
          ) : (
            <span className="text-xs text-muted">No deadline</span>
          )}
        </div>
      </div>
      {project.task_count > 0 && (
        <ProgressBar
          completed={project.completed_task_count}
          total={project.task_count}
          label={`${project.title} progress`}
        />
      )}
    </li>
  )
}
