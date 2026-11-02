# Today page and week view

Part of the Calm-X docs; start at [`docs/HANDOVER.md`](../HANDOVER.md). Describes what is built, for coding sessions.

## Week view on the Today page (built 2026-10-29, designed with the owner)

`/today` now starts with a 7-column week strip (Monday first, weekends dimmed, today outlined); the existing Today lists
stay below it. Only meetings have a time; everything else is date-only, so it is not an hourly calendar.

- **API**: `GET /api/calendar/week?start=<Monday>&today=&tz_offset=` (`api/calendar.py`, `services/calendar_service.py`) returns
  seven days of `{date, meetings, due, planned, deadlines, starts}`; `start` must be a Monday (400 otherwise). Rules: open,
  non-Someday tasks outside archived items; meetings of archived items left out; meetings bucketed by the client's local
  date (`tz_offset`); `planned` (`focus_date`) only in today's column and only when the visible week contains today, left out
  when the task is also due that week or deferred past today; `deadlines` are active, unarchived projects; `starts` are
  tasks by `defer_until`. Waiting-for tasks keep their `waiting_for`. Not included: overdue tasks from before the visible
  week (they stay in the Today list's Overdue section).
- **UI** (`components/today/WeekStrip.tsx`, `pages/TodayPage.tsx`, `hooks/useCalendar.ts`, `utils/week.ts`): ‹ / This week / › in
  the URL (`?week=<any date, snapped to its Monday>&day=<date>`; bad values fall back to the current week/day). Entries per day in
  the order meetings, due, planned, deadlines, starts; max 4 then "+N more" (selects the day). Selecting today keeps the old
  Today sections and adds a Meetings section on top; another day lists its meetings, tasks due, project deadlines and starts.
  Below 768 px the strip is a vertical agenda. Opening the task drawer keeps `week`/`day` in the URL.
- **Drag**: tasks (due, planned, starts entries) can be dropped on today or a later day: `PUT /api/tasks/{id}` with
  `due_date`, optimistic update, rollback + the server message on error, toast "Due date moved to Fri 30 Oct" with
  Undo (restores the old due date, or clears it). Past days are not drop targets; meetings and deadlines are not draggable.
  Keyboard users change the date in the task drawer (no keyboard drag).
- **Chosen by me**: the design's "violet" and "orange" tints do not exist as tokens, so meetings use accent-soft, due tasks
  warn, overdue danger, deadlines a bordered chip with a flag icon, starts muted.
- Not done: dragging with the keyboard, showing overdue tasks of earlier weeks in the strip.

## Planned earlier (built 2026-11-02, foundation round part 2)

`focus_date` never expires, so the owner decides: plans are never cleared silently.

Built in `components/today/PlannedEarlier.tsx`, `plannedLabel` in `utils/date.ts`). Details: the split is done in the browser from `get_today`'s
`focused` list (a plan counts as "for today" when `focus_date >= today`); "Clear all" and its Undo are client-side (`tasksApi.update` per task; Undo
restores each previous date; only the ones that were cleared are offered back); the week strip's `planned` list (`calendar_service`) now only holds
`focus_date >= today`, so old plans are not drawn there. If only old plans exist, no "Nothing planned for today" message is shown.
