# Projects, Areas, Resources and All tasks lists

Part of the Calm-X docs; start at [`docs/HANDOVER.md`](../HANDOVER.md). Describes what is built, for coding sessions.

## Richer Projects and All tasks lists (designed with the owner, 2026-10-29)

The owner found the list pages static. **Projects, All tasks, Areas and Resources are built**, all with the same toolbar
(`components/lists/ListToolbar.tsx`).

### Projects: how it works (done)

- **API**: `GET /api/items?type=project&today=YYYY-MM-DD` adds `stats` to each project (`services/project_stats_service.py`,
  one grouped query per aggregate for the whole list, test asserts the query count stays flat): `open_task_count` and
  `overdue_task_count` / `waiting_task_count` (open = not complete and not Someday), `next_task` (earliest due date, else
  first by sort order; not Someday, not deferred past today), `next_meeting_at` / `last_meeting_at`, `linked_resource_count`
  (active resources only), `last_activity_at` (latest of the project, its tasks and its meetings). No `today` = no `stats`.
- **UI**: `pages/ProjectsPage.tsx` (replaces `ItemListView` for projects), `components/lists/ListToolbar.tsx` (reusable: search
  with 250 ms debounce, sort, toggle/select chips, view toggle, Clear filters), `components/projects/ProjectCard.tsx` and
  `ProjectList.tsx`, `utils/projectList.ts` (filter + sort, pure), `utils/projectFacts.ts` (meeting and activity labels),
  hooks `useUrlParams` and `useViewMode`. Filtering and sorting happen in the browser on the full list. URL params:
  `sort` (omitted = deadline), `q`, `active=0`, `completed=1`, `area` (id or `none`), `deadline` (overdue/week/30days/none),
  `overdue=1`, `stale=1`. The card/list choice is in `localStorage` (`calmx.view.projects`), not in the URL.
- **Chosen by me**: Active/Completed are two toggle chips (both off shows nothing); "this week" means up to Sunday;
  a completed project is never "overdue"; the meeting chip shows the next meeting, else "Last meeting …"; Someday and
  not-yet-started tasks are left out of the open count and the Next line.
- Not done: server-side sorting (not needed at this size).

### Areas and Resources: how it works (done; not designed with the owner, chosen by me)

- **API**: `GET /api/items?type=area|resource&today=` adds `stats` (same `today` rule as Projects). Areas get the Project stats
  (`ProjectStats`) computed for the Area's **own** tasks, plus `project_count` (active projects in the Area) and a last activity
  that also counts its projects' updates. Resources get `ResourceStats`: `reference_link_count` (URLs) and `linked_item_count`
  (active Projects/Areas it is linked to). Both are grouped queries, with a flat-query-count test
  (`services/project_stats_service.py`: `get_project_stats`, `get_resource_stats`).
- **UI**: `pages/AreasPage.tsx`, `pages/ResourcesPage.tsx`, `components/areas/AreaViews.tsx`, `components/resources/ResourceViews.tsx`,
  `utils/areaResourceList.ts`; `ItemListView` is gone. Areas: sort Name (default) / Last activity / Most overdue / Most projects /
  Most open tasks; chips Has overdue, Stale 30+ days, No projects. Resources: sort Name (default) / Recently updated / Most used;
  chips Not linked, No links, Stale 90+ days. Card/list toggle remembered per page (`calmx.view.areas`, `calmx.view.resources`).
  Search covers title and description; state is in the URL like on Projects.
- **Chosen by me**: an Area card's task numbers are the Area's own tasks, not its projects' (the project count is shown beside
  them); "stale" for Areas is 30 days like Projects and 90 days for Resources; an Area with no open tasks shows no "add a next step" hint.
- Not done: counting an Area's projects' tasks in its numbers, a per-Area dashboard (backlog).

### All tasks: how it works (done)

- **API** (`GET /api/tasks`, handled by `services/filter_service.filter_tasks` once any filter is present): new params `q` (title,
  description, notes; LIKE wildcards escaped), `status` (`open|completed|all`, replaces `include_complete`), tri-state
  `waiting`, `someday`, `deferred`, `from_meeting` (true = only those, false = leave them out; `deferred` means
  `defer_until` after `today`, and needs `today`), `sort` (`due|priority|project|created|updated`) with `order`. No-value-last
  for due date, ties by id, Inbox sorts as an empty project name. Unknown values give 400. Calls without the new params behave as before.
- **UI**: `pages/AllTasksPage.tsx`, `components/tasks/TaskCompactList.tsx`, `utils/taskList.ts` (grouping), `hooks/useFilterTasks.ts`
  (`hideParked` sends `someday=false&deferred=false`). The old FilterPanel (tags, priority, due range, category) stays below the toolbar.
  URL params: `q`, `status` (omitted = open), `sort` (omitted = due), `group` (none/project/due/priority), `waiting`, `deferred`,
  `someday`, `meeting` (=1), plus the FilterPanel's `tags`, `priorities`, `due_start`, `due_end`, `category` and the drawer's
  `task`. Grouping is done in the browser; group headers show counts and collapse. "Clear filters" resets search, status, chips and
  the panel but keeps sort and group. View choice: `localStorage` (`calmx.view.tasks`).
- **Chosen by me**: Someday and not-yet-started tasks are hidden unless their chip is on (the Today rules); chips combine with AND;
  the old separate "Completed (n)" block is gone (use the Status select); completed tasks due earlier go in an "Earlier (completed)"
  group instead of "Overdue"; the compact list repeats its header row in every group.
- Not done: ascending/descending toggle in the UI (the API has `order`), server-side grouping, the toolbar for Areas/Resources.
