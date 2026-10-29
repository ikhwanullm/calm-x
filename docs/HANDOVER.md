# Calm-X handover

Last updated 2026-10-29. Written for the next coding session; read `CLAUDE.md` first for the hard rules.

## Where things stand

- Everything up to the dialog scroll fix (`9c02e85`) is pushed to `origin/main`. The Projects list rework is committed locally, not pushed.
- The v1 spec (`.kiro/specs/para-task-manager/`: requirements, design, tasks Phases 0–11) is fully built.
  Everything after that was added on top, directly in code (no spec files were updated for it).
- Schema head: **migration 008** (part B added no migration). The owner's real DB was already at 008 when last checked (2026-10-29).
- Tests at the last commit: backend 581 passed, frontend 895 passed (71 files), `tsc -b` clean.

### Built after the v1 spec (newest first)

| Commit | What |
|---|---|
| (newest) | Projects list: search, sort, filters, card/compact-list toggle, per-project stats (`GET /api/items?type=project&today=`) |
| `9c02e85` | Dialogs scroll when taller than the window |
| `59bc57a` | Week view on `/today`: 7-day strip (meetings, due, planned, deadlines, starts), week navigation in the URL, day selection, drag a task to another day to change its due date (with Undo), `GET /api/calendar/week` |
| `6b38a9f` | Sidebar toggle: collapse/expand button; on screens < 1280px it opens as an overlay |
| `93406d8` | Meeting notes, part B: "From last meeting" block on + Meeting, Weekly Review "Meetings" step |
| `f4cdc76` | Meeting notes, part A: `meetings` table + `tasks.meeting_id` (migration 008), Markdown notes with autosave, action lines turned into tasks, `/meetings` page, Meetings section on Project/Area pages, "From meeting" link in the task drawer, Undo for deleted meetings |
| `5a0c4d5` | Safety round: duplicate-test guard, daily backups while running + `pre-delete` backup, Needs attention follows the Today rules |
| `7b110e1` | Defer + Someday: `tasks.defer_until` / `tasks.is_someday` (migration 007), "Defer until" and "Move to Someday" in the drawer, "Starts {date}" / "Someday" chips, `/someday` page + sidebar entry, `GET /api/tasks/someday`, "Someday [M]" in the Weekly Review Inbox step |
| `9cb3772` | Undo for deleted tasks/subtasks: server-side snapshots in `undo_entries` (24 h), `POST /api/tasks/{id}/restore`, `POST /api/subtasks/{id}/restore`, 8 s Undo toast |
| `aaa5054` | `/today` page (Overdue, Due today, Planned for today, Waiting for) + Add to Today + Waiting for on tasks |
| `e1fded6` | `Start Calm-X.cmd` / `start-calmx.ps1` double-click launcher |
| `ba1a662` | Projects can belong to an Area (`items.area_id`), Area page lists its projects, Projects list filters by `?area=` |
| `539e016` | "Linked resources" on Project/Area pages (`GET /api/items/{id}/linked-resources`) |
| `b66df4e` | No deadline badges on archived projects or their tasks (R7.8) |
| `d8d9c5d` | Project deadline: set at creation and edit inline |

## Running and verifying

The owner starts the app with `Start Calm-X.cmd` (repo root). It rebuilds `frontend/dist` only when
`frontend/src` changed, runs `python -m backend.main` on port 8080 (migrations run at startup) and opens the browser.

### Verification recipe (never against the real DB)

1. Copy the DB read-only into a scratch folder (the backup API is safe while the app runs in WAL mode):
   ```python
   import sqlite3
   src = sqlite3.connect('file:data/calm_x.db?mode=ro', uri=True)
   dst = sqlite3.connect(r'<scratch>/verify.db'); src.backup(dst)
   ```
2. Build the frontend to a scratch folder: `cd frontend && npx vite build --outDir <scratch>/dist --emptyOutDir`.
3. Start a second server on another port with env vars pointing at the copies:
   `CALM_X_DB_PATH=<scratch>/verify.db CALM_X_BACKUP_DIR=<scratch>/bk CALM_X_FRONTEND_DIST=<scratch>/dist python -m backend.main --port 8091`
4. Create your own test items (prefix them, e.g. `ZZ …`); don't edit the owner's items even in the copy.
5. Afterwards delete the scratch files and confirm the real DB is unchanged (read-only: version + row counts).

Migrations: after starting on the copy, compare row counts of every table before/after and run
`PRAGMA foreign_key_check` on the copy.

## Architecture in one page

- **Backend** (`backend/`): FastAPI, sync SQLAlchemy 2.0, SQLite (WAL, `PRAGMA foreign_keys=ON` per connection in
  `database.get_engine`), Alembic run programmatically at startup (`database._run_migrations`).
  `api/` routers → `services/` logic → `models/` ORM; `schemas/` Pydantic.
- **Frontend** (`frontend/src/`): React 19, Vite, TypeScript, Tailwind with CSS-variable tokens (light/dark via
  `.dark`), shadcn/ui adapted per `.kiro/steering/ui-guidelines.md`, TanStack Query, sonner toasts, @dnd-kit, date-fns.
  `api/*.ts` (axios client) → `hooks/use*.ts` (query keys + mutations) → `components/`, `pages/`; routes in `router.tsx`.
- **Design rules**: `.kiro/steering/ui-guidelines.md` (tokens incl. `--border` vs `--border-strong`, spacing,
  dates §7, shortcuts §8, a11y §9). Visual reference: `docs/prototype/`.

### Conventions that matter

- **Error contract**: every error is `{error, type, fields}` with 400/403/404/409. Raise `CalmXException`
  subclasses (`backend/exceptions.py`: `ValidationError`, `NotFoundError`, `ArchivedItemError`, `ConflictError`,
  `LimitExceededError`). Never `HTTPException(detail=…)`.
- **Commit before responding**: write routes call `session.commit()` themselves before returning
  (dependency cleanup runs after the response in this FastAPI version).
- **CSRF**: non-GET requests need header `X-Calm-X: 1` (and an allowed Origin if one is sent).
- **Dates**: anything "today"-relative takes the client's local date as `?today=YYYY-MM-DD`
  (dashboard, weekly review, `/api/tasks/today`). Archive date filters send ISO datetimes with offset.
- **Datetimes**: `models.utils.now_utc()` returns *naive* UTC; `UTCDateTime` adds UTC on load. So a value you just
  wrote serializes without `Z`. `task_service._as_utc()` fixes that for task responses; follow the same idea for new
  datetime fields (the browser reads a bare ISO string as local time).
- **Archived items are read-only** (guards in `services/guards.py`); only `delete_item` bypasses them.
- **Limits**: 100 tasks per Project/Area (Inbox unlimited), 20 tags per task, 50 tasks per template,
  50 reference links per item, 20 resource links per resource.
- **Progress**: integer round-half-up `(200*m + n) // (2*n)`; use `calculate_progress` / `calculateProgress`.
- **Export/import** (`services/import_export_service.py`): every new column must be added to export, import
  validation and the merge insert (ids are remapped on merge). Replace mode clears every table incl. `undo_entries`.

## Gotchas already hit (save yourself the time)

- **Migrations on SQLite**: add columns with a plain `op.execute("ALTER TABLE … ADD COLUMN …")`. Do not use
  `batch_alter_table` on `items` or `tasks`: batch mode recreates the table (drop + rename), and with foreign
  keys on, dropping `items`/`tasks` cascades and wipes children. Migration tests upgrade to a **pinned**
  revision (`command.upgrade(cfg, "00N")`), not head, so they keep passing as new migrations land.
- **Route order**: literal paths like `/tasks/today` must be declared before `/tasks/{task_id}`.
- **Test fixtures**: adding a field to `Task`, `Project` etc. in `types/models.ts` breaks every fixture that builds
  the full object (`tsc -b` lists them). Detail-page tests (`ItemDetailView.test.tsx`, `ProjectDeadline.test.tsx`)
  mock hook modules and child sections; when a section uses a new hook, mock the section there and test it in its own file.
- **TanStack Query v5**: per-call `mutate(…, { onSuccess })` callbacks only fire for the last call on one mutation
  instance; for bulk work use `mutateAsync` + `Promise.allSettled`.
- **Defaults in render**: `const { data = [] } = useQuery(…)` plus a `useEffect` on `data` loops forever; use a
  module-level constant (`EMPTY_LINKS` pattern) or avoid local mirrors.
- **Radix**: ConfirmDialog renders `role="alertdialog"`; drawers opened via `?task=` need manual focus return.
- **Browser pane**: when hidden, pointer clicks can fail; keyboard (focus + Enter) or `element.click()` works.
  Toasts last 3 s (Undo toast 8 s), so read them right after the action.
- **Noise you can ignore**: git "CRLF will be replaced by LF" warnings; Vite "chunks larger than 500 kB" and
  `INEFFECTIVE_DYNAMIC_IMPORT` (SettingsPage) warnings. `tsc -b` leaves `frontend/tsconfig.tsbuildinfo`; delete it.

## Defer + Someday: how it behaves (decided with the owner, 2026-10-29)

- **Defer** (`defer_until`, local date): the task is hidden from Today (all four lists) until that date.
  In Project/Area/Inbox/All-tasks lists it stays visible, dimmed, with a "Starts {date}" chip.
- **Someday** (`is_someday`): parked idea. Hidden from Today, from the Inbox page, the Weekly Review Inbox step and the
  dashboard inbox count. Listed on `/someday` (open tasks of non-archived items). Still shown dimmed with a "Someday"
  chip in Project/Area lists and All tasks. Moving it back to active returns it to where it was (an Inbox task is back in the Inbox).
- **Validation**: `due_date < defer_until` is rejected with 400 (checked against the merged old + new values).
- Export/import and undo snapshots carry both fields; old undo snapshots without them restore as not deferred/not someday.
- Not done: no "show deferred" filter, and Someday tasks are not excluded from search or tag filters.

## Safety round (done 2026-10-29)

Three small fixes from the read-only end-to-end review, one commit each.

- **Duplicate tests**: ten test functions were defined twice in one module (the first copy never ran). The second copies
  are removed and `tests/test_no_duplicate_tests.py` fails if a module defines the same top-level `test_*` name twice.
  (The pytest total did not change: shadowed copies were never collected.)
- **Backups** (`services/backup_service.py`): `main()` starts a daemon thread (`start_periodic_backups`) that runs the
  "newest regular backup older than 24 h" check every hour. `DELETE /api/items/{id}` takes a `pre-delete` backup first, of the
  database the session is connected to; if that fails the item is not deleted (500, `BackupFailedError`); unknown ids make no
  backup. Safety copies (`pre-delete`, `pre-import-replace`) carry their kind in the file name
  (`calmx_backup_<ts>[_N]_<kind>.db`), keep the 5 newest, and are retained apart from the 7 newest regular backups; they don't
  count for the daily check. `create_backup` now refuses a missing database file (sqlite would have created and backed up an empty one).
  `backend/tests/conftest.py` sets `CALM_X_BACKUP_DIR` to a temp dir for every test, because many tests build `Config(port=8080)`
  with default paths and would otherwise write into the real `data/backups`.
- **Dashboard "Needs attention"** follows the Today rules: Someday tasks and tasks deferred past today are left out.
  **Waiting-for tasks stay in**, labelled "Waiting · {who}" (the default from the plan). The owner has not decided this; to
  exclude them instead, add `Task.waiting_for.is_(None)` to the query in `dashboard_service._get_upcoming_deadlines`
  and drop the label in `NeedsAttentionRow`.

## Meeting notes (designed with the owner, 2026-10-29)

The owner has 3–5 meetings a week, almost always about one project. Notes are for the owner only (nothing is shared or
sent). **Parts A and B are built.**

### Decisions already made

- A meeting belongs to exactly **one Project or Area** (not a Resource; not an archived item). No multi-item links.
- The body is **Markdown** (GitHub-flavoured, incl. task lists). Rendered with `react-markdown` + `remark-gfm` (added in part A):
  raw HTML is never rendered (shown as text), `javascript:` links are dropped, links open in a new tab with `rel="noopener noreferrer"`.
- No separate "series" entity: continuity comes from **carrying over** the previous meeting of the same item (part B).
- Action items for other people only become Waiting-for tasks for the owner. No export/share.

### Part A: how it works (done)

- **Data**: `meetings` (`item_id` CASCADE, `title` ≤200, `held_at` UTC, `attendees` ≤500, `body` ≤50 000, `processed_at`) and
  `tasks.meeting_id` (ON DELETE SET NULL). Export/import carry both (`meetings` is optional in files, so older exports
  still import; merge inserts meetings before tasks and remaps `meeting_id`). Replace import wipes `meetings`.
- **Line syntax** (`services/meeting_parser.py`, one function for the preview and the process endpoint; indentation and a
  `-`/`*`/`+` list marker are ignored; fenced code blocks and lines without text are ignored):
  `[ ] text` my action, `@Who: text` someone else's action (Waiting-for task), `? text` question, `! text` decision.
  Processed lines become `[→] text` / `@→Who: text` and are only counted.
- **API** (`api/meetings.py`): `GET/POST /api/items/{id}/meetings`, `GET /api/meetings?q=` (title, attendees, notes),
  `GET/PUT/DELETE /api/meetings/{id}`, `POST /api/meetings/{id}/restore` (Undo), `GET /api/meetings/{id}/actions`,
  `POST /api/meetings/{id}/process`. Process re-parses the saved notes and refuses (409, nothing created) if a chosen line
  moved or changed; it is all-or-nothing, respects the 100-task limit, and puts a title longer than 200 chars in the
  description. Tasks carry `meeting_id`, `meeting_title`, `meeting_held_at`.
- **Undo** of a deleted meeting (`undo_entries` kind `meeting`, 24 h) re-creates it and re-links its tasks that still exist.
  Unlike tasks it cannot fall back to the Inbox: if the Project/Area is gone (404) or archived (403) the restore is refused.
- **Search**: `/api/search` also returns `type: "meeting"` rows; the command palette has a Meetings group.
- **UI**: `MeetingsSection` on Project/Area pages (+ Meeting creates "{item} meeting" with the template and opens it),
  `/meetings/:id` (Edit/Preview, autosave ~1 s + on blur + on leaving, "Saved / Unsaved changes / Couldn't save" status,
  side panel with the parsed lines, Process dialog with due date and priority per line), `/meetings` (search, grouped by
  week, Monday start), sidebar entry, task drawer link. `hooks/useAutosave.ts` is generic (debounce, merged patches, flush,
  retry, `beforeunload` warning).
- **Chosen by me, not by the owner**: an item that has meetings **cannot be converted to a Resource** (400, "delete them
  first"), because meetings can't live on a Resource and silently deleting notes is worse. Meetings of an archived item are
  read-only (also not deletable), like its tasks.
- Not done in A: moving a meeting to another item, a meeting count on the Projects list, natural-language dates in lines.

### Part B: how it works (done)

- **Carry-over**: `GET /api/items/{id}/meetings/carry-over` returns the item's newest meeting (by `held_at`) with its `?` lines and
  the tasks made from it that are still open (`null` when the item has no meetings). `+ Meeting` always asks for it (the
  meetings list may still be loading), and `buildMeetingBody` in `utils/meeting.ts` puts a "From last meeting" block above the
  template: a link to that meeting, its questions as `?` lines (so they stay questions in the new notes), and open tasks as
  plain `- Task: …` bullets. Tasks have no URL of their own, hence no links; the `Task:` prefix keeps a title like `? x` or
  `[ ] x` from being read as a meeting line. If the lookup fails the plain template is used.
- **Weekly Review**: new step "Meetings" after Inbox (`MeetingsStep`, `GET /api/weekly-review/meetings?today=&tz_offset=`):
  meetings of the last 7 days (today included, client timezone) that still have actions to process, items not archived,
  newest first. "Process" opens the meeting in a new tab so the review keeps its place; the list refetches when the tab
  regains focus. Processing happens on the meeting page, not inside the review.
- Decisions (`! `) and created tasks stay queryable for the future weekly report: `GET /api/meetings/{id}/actions` has the
  decisions, and `tasks.meeting_id` links tasks to meetings.
- Not done: processing from inside the review step; counting meetings in the review summary.

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

## Richer Projects and All tasks lists (designed with the owner, 2026-10-29)

The owner found the list pages static. **Projects is built; All tasks is next** (Areas and Resources follow later with the
same pattern). Two commits: Projects, then All tasks.

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
- `ItemListView` is still used by Areas and Resources; its project-only area filter is now dead code.
- Not done: the filter toolbar for Areas/Resources, server-side sorting (not needed at this size).

### Decisions already made (apply to both pages)

- Both pages get a **card view and a compact list view** with a toggle; the choice is remembered per page
  (`localStorage`, wrapped in try/catch, falling back to cards).
- **Default sort for Projects: nearest deadline first** (projects without a deadline last, then by title).
- The card contents below are approved as they are.
- Sort, filters and search live in the URL query string (shareable, survive refresh); the view toggle does not.

### Shared toolbar (one component for both pages, reusable later for Areas/Resources)

Search box (filters as you type, debounced), Sort select, filter chips (toggle chips and dropdown chips), view toggle
(grid / list icons with `aria-label`s and `aria-pressed`), and a "Clear filters" link when anything is active.
Empty result: "No projects match these filters" with Clear filters.

### All tasks page

- Keep the existing FilterPanel filters (tags, priority, due range, category) inside the new toolbar, and add:
  text search (title, description, notes), status (Open default / Completed / All), and state chips
  Waiting, Deferred, Someday, From a meeting (each: show only those; Someday and deferred-not-started are hidden
  unless their chip is on, matching the Today rules).
- **Sort**: Due date (default; no due date last), Priority, Project, Created, Updated.
- **Group by**: Project, Due (Overdue / This week / Later / No due date), Priority, None (default). Group headers show
  counts and can collapse.
- **Compact list**: one row per task: checkbox, title, Project/Area, due (relative, coloured as usual), priority chip,
  tags, state chips. Card view = today's TaskRow style.

### Backend

- Tasks list: extend `GET /api/tasks` (scope=all) with `q`, `status`, `waiting`, `deferred`, `someday`, `from_meeting`,
  `sort`, `order`; grouping can stay client-side. Validate params (400 on unknown sort/status).
- Escape LIKE wildcards in `q` like SearchService does.

### Tests

Backend: each new aggregate (incl. overdue relative to `today`, next task choice, last activity), each sort with ties,
each filter and combinations, params validation, no N+1 (assert query count stays flat as projects grow, e.g. with an
SQLAlchemy event counter). Frontend: toolbar state in the URL, view toggle remembered, card and list render the
fields, sort/group/filter behaviour, empty state with Clear filters. Browser check on a DB copy.

## Other ideas the owner liked (backlog, not prioritised yet)

Recurring tasks; weekly status report generated at the end of Weekly Review; one "next action" per project;
"+ New project in this area" on the Area page; per-Area dashboard; search inside notes; "Done" log; bulk actions in
project task lists; duplicate project / save project as template; smart quick-capture parsing
(`besok`, `!high`, `#tag`, `@project`); desktop reminders; backups to a synced folder via `CALM_X_BACKUP_DIR`.

Also from the 2026-10-29 review, after the safety round:

- **Weekly Review steps for Waiting for and Someday** (follow up waits, promote or drop parked ideas). Highest value;
  design it with the owner first.
- "Planned for today" never expires: show "planned since …" and offer to clear old plans, or reset daily.
- Search and tag filters ignore Someday/Defer: label them in results or hide by default with a toggle.
- Item (Project/Area/Resource) responses still send naive datetimes right after a write; fix once for all responses
  (e.g. a shared serializer) instead of per field like `task_service._as_utc`.
- `requirements.md` / `design.md` don't describe the features built after v1; `HANDOVER.md` is the source of truth.
- Performance later: 3–4 queries per task in list responses (subtask counts, tags, item); frontend tests take
  5–10 min because jsdom is created per file (vitest pool/isolation settings); 811 kB bundle could use route lazy loading.
