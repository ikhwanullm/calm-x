import React from "react"
import { Link, useSearchParams } from "react-router-dom"
import { ChevronLeft, ChevronRight, Flag } from "lucide-react"
import { useTodayTasks, useCompleteTask, useIncompleteTask } from "@/hooks/useTasks"
import { useRescheduleTask, useWeek } from "@/hooks/useCalendar"
import { TaskDrawer } from "@/components/tasks/TaskDrawer"
import { TaskRow } from "@/components/tasks/TaskRow"
import { WeekStrip } from "@/components/today/WeekStrip"
import { Button, EmptyState, Skeleton } from "@/components/common"
import { formatAbsoluteDate, getLocalToday } from "@/utils/date"
import { addDays, dayLabel, isValidDate, meetingTime, mondayOf, weekRangeLabel } from "@/utils/week"
import type { MeetingSummary, Task } from "@/types/models"

function MeetingList({ meetings }: { meetings: MeetingSummary[] }) {
  return (
    <ul className="space-y-1">
      {meetings.map((m) => (
        <li key={m.id}>
          <Link
            to={`/meetings/${m.id}`}
            className="flex items-center gap-3 min-h-[44px] px-3 py-2 rounded-control border border-border bg-surface hover:bg-surface-2"
          >
            <span className="text-sm tabular-nums text-muted">{meetingTime(m.held_at)}</span>
            <span className="flex-1 min-w-0 truncate text-sm font-medium text-text">{m.title}</span>
            <span className="text-xs text-muted truncate">{m.item_title}</span>
          </Link>
        </li>
      ))}
    </ul>
  )
}

export default function TodayPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const selectedTaskId = searchParams.get("task") ? Number(searchParams.get("task")) : null
  const drawerTriggerRef = React.useRef<HTMLElement | null>(null)
  const [showWaiting, setShowWaiting] = React.useState(true)

  const { data, isLoading, isError } = useTodayTasks()
  const completeTask = useCompleteTask()
  const incompleteTask = useIncompleteTask()

  // The week and the selected day live in the URL (?week=<Monday>&day=<date>) so they survive a refresh
  const today = getLocalToday()
  const currentMonday = mondayOf(today)
  const weekParam = searchParams.get("week")
  const weekStart = isValidDate(weekParam) ? mondayOf(weekParam) : currentMonday
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const dayParam = searchParams.get("day")
  const selectedDay = isValidDate(dayParam) && weekDays.includes(dayParam)
    ? dayParam
    : weekDays.includes(today) ? today : weekStart

  const { data: week } = useWeek(weekStart)
  const reschedule = useRescheduleTask()
  const selectedWeekDay = week?.days.find((d) => d.date === selectedDay)

  // Change some params and keep the others (week, day, task)
  function patchParams(changes: Record<string, string | null>) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      for (const [key, value] of Object.entries(changes)) {
        if (value === null) next.delete(key)
        else next.set(key, value)
      }
      return next
    })
  }

  function goToWeek(start: string) {
    patchParams({ week: start === currentMonday ? null : start, day: null })
  }

  function openDrawer(taskId: number) {
    drawerTriggerRef.current = document.activeElement as HTMLElement | null
    patchParams({ task: String(taskId) })
  }

  function closeDrawer() {
    patchParams({ task: null })
    requestAnimationFrame(() => {
      drawerTriggerRef.current?.focus()
      drawerTriggerRef.current = null
    })
  }

  function handleToggleComplete(task: Task) {
    if (task.is_complete) incompleteTask.mutate(task.id)
    else completeTask.mutate(task.id)
  }

  const overdue = data?.overdue ?? []
  const dueToday = data?.due_today ?? []
  const focused = data?.focused ?? []
  const waiting = data?.waiting ?? []
  const workCount = overdue.length + dueToday.length + focused.length

  function renderSection(title: string, tasks: Task[], id: string) {
    if (tasks.length === 0) return null
    return (
      <section aria-labelledby={id} className="mt-6">
        <h2 id={id} className="text-xs font-semibold text-muted uppercase tracking-wide mb-2">
          {title} <span className="font-normal tabular-nums">{tasks.length}</span>
        </h2>
        <div className="space-y-1" role="list">
          {tasks.map((task) => (
            <div key={task.id} role="listitem">
              <TaskRow
                task={task}
                isSelected={selectedTaskId === task.id}
                onOpenDrawer={openDrawer}
                onToggleComplete={handleToggleComplete}
                isDraggable={false}
                showItem
              />
            </div>
          ))}
        </div>
      </section>
    )
  }

  /** The chosen day when it is not today: meetings, tasks due, project deadlines and tasks that start. */
  function renderOtherDay() {
    if (selectedDay === today || !selectedWeekDay) return null
    const { meetings, due, deadlines, starts } = selectedWeekDay
    return (
      <section aria-label={`Plan for ${dayLabel(selectedDay)}`} className="mt-6">
        <h2 className="text-base font-semibold text-text">{dayLabel(selectedDay)}</h2>
        {meetings.length + due.length + deadlines.length + starts.length === 0 && (
          <p className="text-sm text-muted mt-2">Nothing on this day.</p>
        )}
        {meetings.length > 0 && (
          <div className="mt-4">
            <h3 className="text-xs font-semibold text-muted uppercase tracking-wide mb-2">Meetings</h3>
            <MeetingList meetings={meetings} />
          </div>
        )}
        {renderSection("Due", due, "day-due")}
        {deadlines.length > 0 && (
          <div className="mt-6">
            <h3 className="text-xs font-semibold text-muted uppercase tracking-wide mb-2">Project deadlines</h3>
            <ul className="space-y-1">
              {deadlines.map((d) => (
                <li key={d.id}>
                  <Link
                    to={`/projects/${d.id}`}
                    className="flex items-center gap-2 min-h-[44px] px-3 py-2 rounded-control border border-border bg-surface hover:bg-surface-2 text-sm text-text"
                  >
                    <Flag size={14} aria-hidden="true" className="text-warn-fg" />
                    {d.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
        {renderSection("Starts", starts, "day-starts")}
      </section>
    )
  }

  return (
    <div className="max-w-6xl">
      <h1 className="text-2xl font-semibold text-text tracking-tight" style={{ letterSpacing: "-0.02em" }}>
        Today
      </h1>
      <p className="text-sm text-muted mt-1">{formatAbsoluteDate(today)}</p>

      <section aria-label="Week view" className="mt-5">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <Button type="button" variant="secondary" size="sm" aria-label="Previous week" onClick={() => goToWeek(addDays(weekStart, -7))}>
            <ChevronLeft size={14} aria-hidden="true" />
          </Button>
          <Button type="button" variant="secondary" size="sm" aria-label="Next week" onClick={() => goToWeek(addDays(weekStart, 7))}>
            <ChevronRight size={14} aria-hidden="true" />
          </Button>
          <Button type="button" variant="secondary" size="sm" disabled={weekStart === currentMonday} onClick={() => goToWeek(currentMonday)}>
            This week
          </Button>
          <span className="text-sm font-medium text-text tabular-nums">{weekRangeLabel(weekStart)}</span>
        </div>
        {week ? (
          <WeekStrip
            days={week.days}
            today={today}
            selectedDay={selectedDay}
            onSelectDay={(date) => patchParams({ day: date })}
            onOpenTask={openDrawer}
            onMoveTask={(task, toDate) => reschedule.mutate({ task, toDate })}
          />
        ) : (
          <Skeleton className="h-28 w-full" delay={0} />
        )}
      </section>

      {renderOtherDay()}

      {selectedDay === today && (isLoading ? (
        <div className="space-y-2 mt-6">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" delay={0} />)}
        </div>
      ) : isError ? (
        <p className="mt-6 text-sm text-danger-fg">
          Couldn&apos;t load Today. Check that the server is running and try again.
        </p>
      ) : (
        <>
          {selectedWeekDay && selectedWeekDay.meetings.length > 0 && (
            <section aria-labelledby="today-meetings" className="mt-6">
              <h2 id="today-meetings" className="text-xs font-semibold text-muted uppercase tracking-wide mb-2">
                Meetings <span className="font-normal tabular-nums">{selectedWeekDay.meetings.length}</span>
              </h2>
              <MeetingList meetings={selectedWeekDay.meetings} />
            </section>
          )}

          {workCount === 0 ? (
            <div className="mt-6">
              <EmptyState
                title="Nothing planned for today."
                description="Open any task and choose Add to Today. Overdue and due-today tasks appear here on their own."
                dashedBorder
              />
            </div>
          ) : (
            <>
              {renderSection("Overdue", overdue, "today-overdue")}
              {renderSection("Due today", dueToday, "today-due")}
              {renderSection("Planned for today", focused, "today-focused")}
            </>
          )}

          {waiting.length > 0 && (
            <section aria-labelledby="today-waiting" className="mt-8 border-t border-border pt-4">
              <button
                type="button"
                id="today-waiting"
                aria-expanded={showWaiting}
                onClick={() => setShowWaiting((v) => !v)}
                className="text-xs font-semibold text-muted uppercase tracking-wide hover:text-text"
              >
                Waiting for <span className="font-normal tabular-nums">{waiting.length}</span>
              </button>
              {showWaiting && (
                <div className="space-y-1 mt-2" role="list">
                  {waiting.map((task) => (
                    <div key={task.id} role="listitem">
                      <TaskRow
                        task={task}
                        isSelected={selectedTaskId === task.id}
                        onOpenDrawer={openDrawer}
                        onToggleComplete={handleToggleComplete}
                        isDraggable={false}
                        showItem
                      />
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}
        </>
      ))}

      <TaskDrawer taskId={selectedTaskId} onClose={closeDrawer} />
    </div>
  )
}
