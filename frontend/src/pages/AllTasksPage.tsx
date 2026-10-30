import React from "react"
import { ChevronDown, ChevronRight } from "lucide-react"
import { useFilteredTasks, type FilterParams, type TaskListParams } from "@/hooks/useFilterTasks"
import { useCompleteTask, useIncompleteTask } from "@/hooks/useTasks"
import { useDeadlineThreshold } from "@/hooks/useSettings"
import { useUrlParams } from "@/hooks/useUrlParams"
import { useViewMode } from "@/hooks/useViewMode"
import { TaskDrawer } from "@/components/tasks/TaskDrawer"
import { TaskRow } from "@/components/tasks/TaskRow"
import { TaskCompactList } from "@/components/tasks/TaskCompactList"
import { ListToolbar } from "@/components/lists/ListToolbar"
import type { ToolbarChip } from "@/components/lists/ListToolbar"
import { EmptyState, Skeleton } from "@/components/common"
import { FilterPanel } from "@/components/filters/FilterPanel"
import { getLocalToday } from "@/utils/date"
import {
  GROUPS, STATUSES, TASK_SORTS, groupTasks, isGroupBy, isTaskSort, isTaskStatus,
} from "@/utils/taskList"
import type { Task } from "@/types/models"

// Every key this page keeps in the query string besides `task` (the open drawer)
const LIST_KEYS = ["q", "status", "sort", "group", "waiting", "deferred", "someday", "meeting"]
const PANEL_KEYS = ["tags", "priorities", "due_start", "due_end", "category"]

export default function AllTasksPage() {
  const url = useUrlParams()
  const drawerTriggerRef = React.useRef<HTMLElement | null>(null)
  const [view, setView] = useViewMode("tasks")
  const [collapsed, setCollapsed] = React.useState<Set<string>>(new Set())
  const today = getLocalToday()

  const selectedTaskId = url.get("task") ? Number(url.get("task")) : null
  const tagParam = url.get("tags")
  const priParam = url.get("priorities")
  const panel: FilterParams = {
    tagIds: tagParam ? tagParam.split(",").map(Number).filter(Boolean) : undefined,
    priorities: priParam ? priParam.split(",").filter(Boolean) : undefined,
    dueStart: url.get("due_start") || undefined,
    dueEnd: url.get("due_end") || undefined,
    category: url.get("category") || undefined,
  }
  const statusParam = url.get("status")
  const sortParam = url.get("sort")
  const groupParam = url.get("group")
  const status = isTaskStatus(statusParam) ? statusParam : "open"
  const sort = isTaskSort(sortParam) ? sortParam : "due"
  const group = isGroupBy(groupParam) ? groupParam : "none"
  const q = url.get("q")
  const chipOn = { waiting: url.get("waiting") === "1", deferred: url.get("deferred") === "1", someday: url.get("someday") === "1", meeting: url.get("meeting") === "1" }

  const params: TaskListParams = {
    ...panel, q, status, sort, hideParked: true,
    waiting: chipOn.waiting, deferred: chipOn.deferred, someday: chipOn.someday, fromMeeting: chipOn.meeting,
  }
  const { data: tasks = [], isLoading } = useFilteredTasks(params)
  const completeTask = useCompleteTask()
  const incompleteTask = useIncompleteTask()
  useDeadlineThreshold()  // consumed by TaskRow children

  const panelActive = !!(panel.tagIds?.length || panel.priorities?.length || panel.dueStart || panel.dueEnd || panel.category)
  const hasActiveFilters = panelActive || q !== "" || status !== "open" || chipOn.waiting || chipOn.deferred || chipOn.someday || chipOn.meeting

  function clearAll() {
    url.set(Object.fromEntries([...LIST_KEYS.filter((k) => k !== "sort" && k !== "group"), ...PANEL_KEYS].map((k) => [k, null])))
  }

  function handlePanelChange(f: FilterParams) {
    url.set({
      tags: f.tagIds?.length ? f.tagIds.join(",") : null,
      priorities: f.priorities?.length ? f.priorities.join(",") : null,
      due_start: f.dueStart ?? null,
      due_end: f.dueEnd ?? null,
      category: f.category ?? null,
    })
  }

  function openDrawer(taskId: number) {
    drawerTriggerRef.current = document.activeElement as HTMLElement | null
    url.set({ task: String(taskId) })
  }

  function closeDrawer() {
    url.set({ task: null })
    requestAnimationFrame(() => {
      drawerTriggerRef.current?.focus()
      drawerTriggerRef.current = null
    })
  }

  function handleToggleComplete(task: Task) {
    if (task.is_complete) incompleteTask.mutate(task.id)
    else completeTask.mutate(task.id)
  }

  function toggleCollapsed(key: string) {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const toggle = (id: string, label: string, key: string, on: boolean): ToolbarChip => ({
    kind: "toggle", id, label, pressed: on, onToggle: () => url.set({ [key]: on ? null : "1" }),
  })
  const chips: ToolbarChip[] = [
    {
      kind: "select", id: "status", label: "Status", emptyLabel: "Open", value: status === "open" ? "" : status,
      options: [{ value: "", label: "Open" }, ...STATUSES.filter((s) => s.value !== "open")],
      onChange: (v) => url.set({ status: v }),
    },
    toggle("waiting", "Waiting", "waiting", chipOn.waiting),
    toggle("deferred", "Deferred", "deferred", chipOn.deferred),
    toggle("someday", "Someday", "someday", chipOn.someday),
    toggle("meeting", "From a meeting", "meeting", chipOn.meeting),
  ]

  const groups = groupTasks(tasks, group, today)

  function renderTasks(list: Task[], label: string) {
    if (view === "list") {
      return (
        <TaskCompactList
          tasks={list}
          label={label}
          selectedTaskId={selectedTaskId}
          onOpenDrawer={openDrawer}
          onToggleComplete={handleToggleComplete}
        />
      )
    }
    return (
      <div className="space-y-1" role="list" aria-label={label}>
        {list.map((task) => (
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
    )
  }

  return (
    <div className="max-w-5xl">
      <h1 className="text-2xl font-semibold text-text mb-6 tracking-tight" style={{ letterSpacing: "-0.02em" }}>
        All tasks
      </h1>

      <ListToolbar
        searchValue={q}
        onSearchChange={(v) => url.set({ q: v })}
        searchLabel="Search tasks"
        sort={{ value: sort, options: TASK_SORTS, onChange: (v) => url.set({ sort: v === "due" ? null : v }) }}
        chips={chips}
        view={{ value: view, onChange: setView }}
        hasActiveFilters={hasActiveFilters}
        onClear={clearAll}
      >
        <select
          value={group}
          onChange={(e) => url.set({ group: e.target.value === "none" ? null : e.target.value })}
          aria-label="Group by"
          className="h-9 px-2 text-sm rounded-control border border-border-strong bg-surface text-text focus:outline-2 focus:outline-offset-2 focus:outline-accent"
        >
          {GROUPS.map((g) => <option key={g.value} value={g.value}>{g.value === "none" ? "No grouping" : `Group: ${g.label}`}</option>)}
        </select>
      </ListToolbar>

      <div className="mb-4">
        <FilterPanel filters={panel} onChange={handlePanelChange} />
      </div>

      {isLoading ? (
        <div className="space-y-2 mt-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" delay={0} />)}
        </div>
      ) : tasks.length === 0 ? (
        <EmptyState
          title="No matching tasks found."
          description="Try adjusting or clearing the filters."
          dashedBorder
        />
      ) : group === "none" ? (
        <div className="mt-4">{renderTasks(tasks, "Filtered tasks")}</div>
      ) : (
        <div className="mt-4 space-y-5">
          {groups.map((g) => {
            const isCollapsed = collapsed.has(g.key)
            return (
              <section key={g.key} aria-label={g.label}>
                <button
                  type="button"
                  aria-expanded={!isCollapsed}
                  onClick={() => toggleCollapsed(g.key)}
                  className="flex items-center gap-1.5 mb-2 text-xs font-semibold text-muted uppercase tracking-wide hover:text-text"
                >
                  {isCollapsed ? <ChevronRight size={14} aria-hidden="true" /> : <ChevronDown size={14} aria-hidden="true" />}
                  {g.label} <span className="font-normal tabular-nums">{g.tasks.length}</span>
                </button>
                {!isCollapsed && renderTasks(g.tasks, g.label)}
              </section>
            )
          })}
        </div>
      )}

      <TaskDrawer taskId={selectedTaskId} onClose={closeDrawer} />
    </div>
  )
}
