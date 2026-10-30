import { Link } from "react-router-dom"
import { useDashboard } from "@/hooks/useDashboard"
import { Skeleton, EmptyState } from "@/components/common"
import { cn } from "@/lib/utils"
import { formatRelativeDate, getLocalToday } from "@/utils/date"
import { formatMeetingTime } from "@/utils/meeting"
import type { AttentionProject, AttentionReason, DashboardData, StaleWaiting } from "@/types/dashboard"

/** A review is due after a week (or when there never was one). */
const REVIEW_DUE_DAYS = 7
const MAX_PROJECTS = 8

/**
 * The Dashboard answers "what is getting unhealthy?": things to process, long waits and projects at risk.
 * What to do today (due, planned, this week) lives on the Today page, so nothing about due dates is repeated here.
 */
export default function DashboardPage() {
  const { data, isLoading } = useDashboard()
  const today = getLocalToday()

  const nothingToFlag = !!data
    && data.meetings_to_process.length === 0
    && data.stale_waiting_total === 0
    && data.attention_projects.length === 0

  return (
    <div className="space-y-8 max-w-4xl">
      <h1 className="text-2xl font-semibold text-text tracking-tight">Dashboard</h1>

      {/* To process */}
      <section aria-labelledby="process-heading">
        <h2 id="process-heading" className="text-sm font-semibold text-text mb-3">To process</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Tile title="Inbox" loading={isLoading}>
            {data && (
              <>
                <p className="text-3xl font-semibold text-text tabular-nums">{data.inbox_count}</p>
                <p className="text-xs text-muted">{data.inbox_count === 1 ? "task" : "tasks"} to organise</p>
                <Link to="/inbox" className="text-xs text-accent-text hover:underline mt-auto pt-1">Process inbox →</Link>
              </>
            )}
          </Tile>

          <Tile title="Meetings" loading={isLoading}>
            {data && (
              data.meetings_to_process.length === 0 ? (
                <p className="text-sm text-muted">No actions waiting from this week&apos;s meetings.</p>
              ) : (
                <>
                  <p className="text-3xl font-semibold text-text tabular-nums">{data.meetings_to_process.length}</p>
                  <p className="text-xs text-muted">
                    {data.meetings_to_process.length === 1 ? "meeting has" : "meetings have"} actions to turn into tasks
                  </p>
                </>
              )
            )}
          </Tile>

          <ReviewTile data={data} loading={isLoading} />
        </div>

        {data && data.meetings_to_process.length > 0 && (
          <ul className="mt-3 space-y-2" aria-label="Meetings to process">
            {data.meetings_to_process.map((m) => (
              <li key={m.id}>
                <Link
                  to={`/meetings/${m.id}`}
                  className="flex items-center gap-3 min-h-[44px] px-3 py-2 rounded-control border border-border bg-surface hover:bg-surface-2"
                >
                  <span className="flex-1 min-w-0">
                    <span className="block truncate text-sm font-medium text-text">{m.title}</span>
                    <span className="block truncate text-xs text-muted">{m.item_title} · {formatMeetingTime(m.held_at)}</span>
                  </span>
                  <span className="shrink-0 inline-flex items-center h-5 px-1.5 rounded-pill bg-accent-soft text-xs text-accent-text">
                    {m.open_action_count} {m.open_action_count === 1 ? "action" : "actions"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Waiting too long */}
      {data && data.stale_waiting_total > 0 && (
        <section aria-labelledby="waiting-heading">
          <h2 id="waiting-heading" className="text-sm font-semibold text-text mb-3">
            Waiting too long <span className="font-normal text-muted tabular-nums">{data.stale_waiting_total}</span>
          </h2>
          <ul className="space-y-2" aria-label="Waiting for too long">
            {data.stale_waiting.map((w) => <WaitingRow key={w.id} wait={w} />)}
          </ul>
          {data.stale_waiting_total > data.stale_waiting.length && (
            <p className="mt-2 text-xs text-muted">
              And {data.stale_waiting_total - data.stale_waiting.length} more. The rest are on{" "}
              <Link to="/today" className="text-accent-text hover:underline">Today → Waiting for</Link>.
            </p>
          )}
        </section>
      )}

      {/* Projects needing attention */}
      {(isLoading || (data && data.attention_projects.length > 0)) && (
        <section aria-labelledby="projects-heading">
          <h2 id="projects-heading" className="text-sm font-semibold text-text mb-3">
            Projects needing attention{" "}
            {data && <span className="font-normal text-muted tabular-nums">{data.attention_projects.length}</span>}
          </h2>
          {isLoading ? (
            <div className="space-y-2">{[1, 2].map((i) => <Skeleton key={i} className="h-14 w-full" delay={0} />)}</div>
          ) : (
            <>
              <ul className="space-y-2" aria-label="Projects needing attention">
                {data!.attention_projects.slice(0, MAX_PROJECTS).map((p) => <ProjectRow key={p.id} project={p} today={today} />)}
              </ul>
              {data!.attention_projects.length > MAX_PROJECTS && (
                <p className="mt-2 text-xs text-muted">
                  And {data!.attention_projects.length - MAX_PROJECTS} more in{" "}
                  <Link to="/projects" className="text-accent-text hover:underline">Projects</Link>.
                </p>
              )}
            </>
          )}
        </section>
      )}

      {nothingToFlag && (
        <EmptyState
          title="Nothing needs your attention."
          description="No meeting actions waiting, no long waits and no project at risk. See Today for what to do now."
          dashedBorder
        />
      )}

      {/* Shortcuts */}
      {data && (
        <nav aria-label="Shortcuts" className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted border-t border-border pt-4">
          <Link to="/projects" className="hover:text-accent-text">{data.counts.active_projects} active {data.counts.active_projects === 1 ? "project" : "projects"}</Link>
          <Link to="/areas" className="hover:text-accent-text">{data.counts.areas} {data.counts.areas === 1 ? "area" : "areas"}</Link>
          <Link to="/resources" className="hover:text-accent-text">{data.counts.resources} {data.counts.resources === 1 ? "resource" : "resources"}</Link>
          <Link to="/someday" className="hover:text-accent-text">{data.counts.someday} someday</Link>
          <Link to="/archive" className="hover:text-accent-text">{data.counts.archived} archived</Link>
        </nav>
      )}
    </div>
  )
}

// ---- Tiles ----

function Tile({ title, loading, children }: { title: string; loading: boolean; children?: React.ReactNode }) {
  return (
    <div className="bg-surface rounded-card border border-border p-5 shadow-card flex flex-col gap-1.5">
      <p className="text-xs font-semibold text-muted uppercase tracking-wide">{title}</p>
      {loading ? <Skeleton className="h-8 w-16" delay={0} /> : children}
    </div>
  )
}

function ReviewTile({ data, loading }: { data: DashboardData | undefined; loading: boolean }) {
  const days = data?.days_since_review ?? null
  const due = data != null && (days === null || days >= REVIEW_DUE_DAYS)
  return (
    <Tile title="Weekly review" loading={loading}>
      {data && (
        <>
          <p className={cn("text-sm", due ? "text-warn-fg font-medium" : "text-muted")}>
            {days === null
              ? "No review yet"
              : days === 0
                ? "Reviewed today"
                : `Last review ${days} ${days === 1 ? "day" : "days"} ago`}
          </p>
          <Link
            to="/review"
            className={cn(
              "mt-auto h-9 px-4 rounded-control text-sm font-medium inline-flex items-center justify-center self-start hover:opacity-90",
              due ? "bg-accent text-accent-fg" : "border border-border bg-surface text-text hover:bg-surface-2"
            )}
          >
            Start weekly review
          </Link>
        </>
      )}
    </Tile>
  )
}

// ---- Rows ----

function taskHref(w: StaleWaiting): string {
  if (w.item_id === null) return "/inbox"
  return `/${w.item_type === "area" ? "areas" : "projects"}/${w.item_id}?task=${w.id}`
}

function WaitingRow({ wait }: { wait: StaleWaiting }) {
  return (
    <li>
      <Link
        to={taskHref(wait)}
        className="flex items-center gap-3 min-h-[44px] px-3 py-2 rounded-control border border-border bg-surface hover:bg-surface-2"
      >
        <span className="flex-1 min-w-0">
          <span className="block truncate text-sm font-medium text-text">{wait.title}</span>
          <span className="block truncate text-xs text-muted">{wait.item_title ?? "Inbox"}</span>
        </span>
        <span className="shrink-0 text-xs text-muted">Waiting · {wait.waiting_for}</span>
        <span className="shrink-0 inline-flex items-center h-5 px-1.5 rounded-pill bg-warn-bg text-xs text-warn-fg tabular-nums">
          {wait.waiting_days} days
        </span>
      </Link>
    </li>
  )
}

function reasonLabel(reason: AttentionReason, p: AttentionProject, today: string): string {
  switch (reason) {
    case "overdue_tasks": return `${p.overdue_task_count} overdue ${p.overdue_task_count === 1 ? "task" : "tasks"}`
    case "deadline_passed": return `Deadline passed ${formatRelativeDate(p.project_deadline!, today).toLowerCase()}`
    case "deadline_soon": return `Due ${formatRelativeDate(p.project_deadline!, today).toLowerCase()}, ${p.progress_percentage}% done`
    case "stale": return `No activity for ${p.days_inactive} days`
    case "no_open_tasks": return "No open tasks"
  }
}

const DANGER: AttentionReason[] = ["overdue_tasks", "deadline_passed"]

function ProjectRow({ project, today }: { project: AttentionProject; today: string }) {
  return (
    <li>
      <Link
        to={`/projects/${project.id}`}
        className="flex flex-col gap-1.5 px-4 py-3 rounded-control border border-border bg-surface hover:bg-surface-2"
      >
        <span className="text-sm font-medium text-text truncate">{project.title}</span>
        <span className="flex flex-wrap gap-1.5">
          {project.reasons.map((reason) => (
            <span
              key={reason}
              className={cn(
                "inline-flex items-center h-5 px-1.5 rounded-pill text-xs",
                DANGER.includes(reason) ? "bg-danger-bg text-danger-fg" : "bg-warn-bg text-warn-fg"
              )}
            >
              {reasonLabel(reason, project, today)}
            </span>
          ))}
        </span>
      </Link>
    </li>
  )
}
