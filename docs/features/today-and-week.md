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

## Greeting and day summary (built 2026-11-03, designed with the owner)

- The h1 is a greeting by the local hour (before 12:00 "Good morning", 12:00-16:59 "Good afternoon", from 17:00 "Good evening"),
  `hooks/useGreeting.ts`, recomputed on window focus and every 5 minutes. Only when today is the selected day; another day keeps "Today".
- The muted line under it: the date, then "N to do" (`workCount`), "N meeting(s)" (today's meetings from the current week's data)
  and "N waiting", leaving out zero parts and everything while loading. Plain text, not links.
- With `workCount` 0 the dashed empty state is replaced by an all-clear block (`Sun` icon, "All done for today.", a hint about Q and
  the week strip). It fades in (`.fade-in`) when the last task of the day was just completed.

## Readable week strip entries (built 2026-11-03, designed with the owner)

- Each entry shows its title on up to two lines (`line-clamp-2`, `break-words`). A meeting's time sits on a small line of its own
  above the title. The waiting-for name is no longer in the chip.
- Hover (300 ms) or keyboard focus shows a tooltip (`components/ui/tooltip.tsx`, `@radix-ui/react-tooltip`): full title, what it is
  (Meeting 09:00, Due, Planned for today, Project deadline, Starts), the project/area name and "Waiting for {who}". It replaced the
  native `title`. While a task is being dragged tooltips are not rendered; the content has `pointer-events-none`, so it never blocks a drop.
- **Wide screens** (2026-11-03): the shell's 1240 px cap is lifted on `/today` (`AppShell`), and the week strip spans the full content width while
  the lists below keep `max-w-6xl`. Measured on a copy of the real DB: columns are 247 px at 1920 px (no title cut at two lines), 178 px at
  1440 px and 119 px at 1024 px.
- `MAX_PER_DAY = 4` and "+N more" are unchanged; all cells of a row stay the same height. Checked with a copy of the real DB: at
  1280 px (columns 156 px) 2 of 9 titles are still cut at two lines, at 1024 px (119 px) 7 of 9; the tooltip has the full text.

## Planned earlier (built 2026-11-02, foundation round part 2)

`focus_date` never expires, so the owner decides: plans are never cleared silently.

Built in `components/today/PlannedEarlier.tsx`, `plannedLabel` in `utils/date.ts`). Details: the split is done in the browser from `get_today`'s
`focused` list (a plan counts as "for today" when `focus_date >= today`); "Clear all" and its Undo are client-side (`tasksApi.update` per task; Undo
restores each previous date; only the ones that were cleared are offered back); the week strip's `planned` list (`calendar_service`) now only holds
`focus_date >= today`, so old plans are not drawn there. If only old plans exist, no "All done for today" block is shown.
