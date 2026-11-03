# Dashboard

Part of the Calm-X docs; start at [`docs/HANDOVER.md`](../HANDOVER.md). Describes what is built, for coding sessions.

## Dashboard vs Today (reworked 2026-10-30, chosen by me after the owner found the Dashboard not useful)

Split of roles: **Today = what to do now** (due, planned, waiting, meetings of the day, the week strip). **Dashboard = what is
getting unhealthy**, only exceptions, and it is empty when all is fine. Nothing about due dates is shown on the Dashboard any more.

- **Removed**: the "Needs attention" list (it repeated Today's overdue/due-today/waiting plus the week strip), the Active projects
  list with progress bars (the Projects page does that better), Overall progress (an average of per-project percentages: meaningless),
  and the Projects/Areas/Resources/Archives summary cards. Fixed with it: task rows linked to `/${item_id}`, a route that does not exist.
- **API** (`GET /api/dashboard?today=&tz_offset=`, `services/dashboard_service.py`) now returns: `inbox_count`; `last_review_date`
  and `days_since_review`; `stale_waiting` (open waiting-for tasks waiting 7+ days, longest first, capped at 10, plus `stale_waiting_total`; tasks without
  `waiting_since` are skipped); `attention_projects`; `counts` (active projects, areas, resources, archived, Someday).
- **Projects needing attention** are active projects with any of: `overdue_tasks`, `deadline_passed`, `deadline_soon` (deadline within
  14 days and progress under 50 %), `stale` (no activity for 30 days, counting tasks and meetings), `no_open_tasks`. Most reasons first,
  then most overdue, then title. The thresholds are constants at the top of the service.
- **UI** (`pages/DashboardPage.tsx`): "To process" (Inbox, Weekly review with how long ago and a
  highlighted button when a week or more has passed or there never was one), "Waiting too long", "Projects needing attention"
  (first 8, then a link), an "all clear" empty state, and one line of shortcut counts.
- **No meetings on the Dashboard** (chosen by the owner, 2026-11-03): meeting actions are optional, so the Meetings tile, the list under it
  and `meetings_to_process` are gone; the Weekly Review Meetings step is where meetings with open actions are listed.
- **Today**: a waiting task's chip now shows the age, "Waiting · Budi · 9 days" (from `waiting_since`).
- Not done: tasks completed this week (possible since `tasks.completed_at`, migration 009), an Areas health section.
