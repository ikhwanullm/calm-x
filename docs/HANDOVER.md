# Calm-X handover

Last updated 2026-11-03. Written for the next coding session; read `CLAUDE.md` first for the hard rules.
This file is the entry point: status, what to build next, how to run and verify, architecture and gotchas.
How each feature behaves is in `docs/features/`; finished work rounds are recorded in `docs/history/rounds.md`.

## Where things stand

- Everything up to the micro-interactions round (`7a868ef`) is pushed to `origin/main`.
- The v1 spec (`.kiro/specs/para-task-manager/`: requirements, design, tasks Phases 0–11) is fully built and archived.
  Everything after that was added on top, directly in code; these docs describe it, the spec files do not.
- Schema head: **migration 010** (`items.icon`, `items.color`). The owner's real DB was at 009 when last checked (2026-11-03) and
  upgrades to 010 on the next app start.
- Tests at the last code commit: backend 663 passed, frontend 1200 passed (90 files, about 35-55 s), `tsc -b` clean.

## Next up

### Readable week strip and icons for Projects and Areas (chosen by the owner 2026-11-03, from a mockup)

Two features, one commit each (icons may take two: backend, then UI). The micro-interactions round below is done: when you
start, move its section to `docs/history/rounds.md` and leave a one-line pointer here. In the "Built after the v1 spec"
table always write the real commit hash (amend nothing; add the hash in your docs commit), never `(newest)`.

**Part 1: week strip titles no longer cut off (DONE, see `features/today-and-week.md`)** (`components/today/WeekStrip.tsx`)

Problem: a day column is about 150 px, every entry is one truncated line, and the meeting time and the waiting-for name
("· Fadhli") take part of it, so most titles end in "…".

- Each entry shows its title on up to **two lines** (`line-clamp-2`, `break-words`), then "…". Same 12px text.
- A meeting shows its time on a small line of its own above the title (same chip, `tabular-nums`, slightly muted) instead
  of in front of it.
- The waiting-for name leaves the chip; it moves to the tooltip.
- A quick **tooltip** on hover and keyboard focus (about 300 ms delay) with the full title, what the entry is (Meeting
  09:00, Due, Planned for today, Project deadline, Starts), the project/area name and "Waiting for {who}" when set.
  Use shadcn's Tooltip (`@radix-ui/react-tooltip`, generated into `components/ui/` and themed per `ui-guidelines.md` §2); it
  replaces the slow native `title`. It must close when a drag starts and must not block dropping.
- Keep `MAX_PER_DAY = 4` and "+N more"; a cell may grow taller, all cells in the row keep the same height (grid stretch).
- The vertical agenda below 768 px: titles there are full width already; only take over the new time line and tooltip text.
- Tests: long titles are no longer cut to one line (class check), meeting time rendered apart, tooltip content for each kind,
  waiting name only in the tooltip. Check in the browser at 1280 and 1024 px with the real-length titles of a DB copy.

**Part 2: an icon and a soft color per Project and Area (DONE, see `features/item-detail.md`)**

Owner's choice: line icons with a soft tint ("option 3"). This **loosens the rule "color means status, and only status"**
on purpose, for item identity only. To keep status colors unambiguous, identity tints never use red, amber/orange or green.
Update `ui-guidelines.md` §1 rule 2 and §3 tokens to say exactly that.

- Data: migration `010_item_icon.py` adds `items.icon TEXT` and `items.color TEXT` (plain `ADD COLUMN`, both NULL for
  existing rows). `icon` is a key like `database`; the backend accepts any `^[a-z0-9-]{1,40}$` (the frontend owns the list
  and shows the fallback for a key it does not know). `color` must be one of `purple`, `blue`, `teal`, `pink`, `slate`
  (400 otherwise). All item types may have them (Resources too), but the UI to pick them is on Projects and Areas only for now.
  Carry both in export/import, `ItemResponse`, and in task responses as `item_icon` / `item_color` (add them to the items
  query in `task_service._tasks_to_responses`; still four queries).
- Tokens: `--tint-{purple|blue|teal|pink|slate}-bg` / `-fg` in light and dark in `index.css` (light like the mockup:
  purple `#EEEDFE`/`#534AB7`, blue `#E6F1FB`/`#185FA5`, teal `#E1F5EE`/`#0F6E56`, pink `#FBEAF0`/`#993556`, slate
  `#EFEFEA`/`#5C5C57`; pick dark values with the same contrast rule as the other tokens: fg on bg at least 4.5:1).
  `blue` must stay visibly different from the accent; if it is too close, drop it rather than invent another hue.
- Icon set: `utils/itemIcons.ts` maps about 40 lucide icon keys to components, grouped loosely (work: briefcase, database,
  server, cloud, code, git-branch, chart-bar, shield, rocket, file-text, presentation, users, handshake, calendar,
  wallet; life: home, heart, dumbbell, book-open, graduation-cap, plane, car, utensils, music, camera, sprout, baby,
  paw-print; general: star, flag, target, lightbulb, puzzle, wrench, package, globe, megaphone, compass, leaf, sparkles).
  Check each name exists in the installed lucide-react before adding it.
- `components/common/ItemIcon.tsx`: a rounded square (radius 6-7 px) in `--tint-{color}-bg` with the icon in
  `--tint-{color}-fg`; sizes 16 (inline), 20 (rows, picker) and 28 (detail page, cards). No icon set: the first letter of the
  title in the same square (slate when no color). Decorative (`aria-hidden`): the name next to it is the label.
- Picker on the Project/Area page: the 28 px icon next to the title is a button ("Change icon"); it opens a popover
  (shadcn Popover, `@radix-ui/react-popover`) with a search box, the icon grid, the five color swatches (with their names
  as labels) and "Remove icon". Arrow keys move in the grid, Enter picks, Esc closes; saves at once (`PUT /api/items/{id}`)
  with the usual optimistic update and error toast. Not offered on archived items (read-only).
- Shown in: Projects and Areas cards and list rows, the Project/Area detail header, the project/area name on task rows and
  in the task drawer (`ItemLink`, 16 px), `ItemPicker` entries, the Dashboard's "Projects needing attention". Not in the
  week strip (no room), not on Resources yet.
- Tests: migration on a copy of a 009 DB leaves rows NULL; invalid color 400; export/import round trip; `ItemIcon` fallback
  letter; picker keyboard flow; `item_icon` in task responses with the query count unchanged.

The micro-interactions round (completion animation, Undo after complete, Today greeting) is done; see `history/rounds.md`.

### After that

**Nothing else is queued.** The owner first uses the features marked "chosen by me" for about a week (Areas/Resources lists,
detail page, Dashboard, 8-step Weekly Review) and gives feedback. Next design candidates, to be designed with the owner:
recurring tasks, Done log + weekly status report (can use `tasks.completed_at`), Inbox "one by one" mode.

Small fixes that may be done any time (one commit each; found in the 2026-11-02 review):

- **"Planned earlier" buttons** (`components/today/PlannedEarlier.tsx`): Keep for today, Remove from Today and Clear all stay
  clickable while saving (a double click gives two toasts); disable them while their request runs. Check the row at a narrow
  width (task, label and two buttons on one line) and let the buttons wrap below the task if it is cramped.

## Feature docs

| File | Covers | Designed with the owner? |
|---|---|---|
| [`features/today-and-week.md`](features/today-and-week.md) | Today page, week strip, Planned earlier | Yes |
| [`features/defer-someday.md`](features/defer-someday.md) | Defer until, Someday | Yes |
| [`features/meetings.md`](features/meetings.md) | Meeting notes, carry-over, line syntax | Yes |
| [`features/lists.md`](features/lists.md) | Projects, Areas, Resources, All tasks lists | Projects and All tasks yes; Areas and Resources chosen by me |
| [`features/item-detail.md`](features/item-detail.md) | Project/Area/Resource page | Chosen by me |
| [`features/dashboard.md`](features/dashboard.md) | Dashboard as an exceptions page | Chosen by me |
| [`features/weekly-review.md`](features/weekly-review.md) | Waiting for and Someday steps, fixes to the old steps | Chosen by me |
| [`features/capture-and-inbox.md`](features/capture-and-inbox.md) | Smart capture syntax, Inbox triage, `ItemPicker` | Asked for by the owner, details chosen by me |
| [`history/rounds.md`](history/rounds.md) | Safety, foundation and code health rounds | Records |

When you build or change a feature, update its file (or add one and list it here), and add a row to the table below.

### Built after the v1 spec (newest first)

| Commit | What |
|---|---|
| `e7d8c32`, `f2de554` | Icon and soft color per Project and Area: migration 010 (`items.icon`, `items.color`), `item_icon`/`item_color` on tasks, `ItemIcon`, picker popover on the detail page, shown on cards, rows, task item links, ItemPicker and the Dashboard |
| `68970eb` | Week strip: titles on two lines, meeting time on its own line, tooltip (Radix) with kind, project/area and waiting-for |
| `7a868ef` | Today greeting by hour, one-line day summary (to do, meetings, waiting) and an all-clear block that fades in |
| `6a1e191` | Undo after completing a task: "Task completed" toast, `POST /api/tasks/{id}/undo-complete` (restores subtask states, 409 if the task changed since), quiet in the Weekly Review steps |
| `802d1b9` | Completion animation: `TaskCheckbox` (self-drawing check), growing strike-through, completed row lingers 400 ms then fades and collapses (`useLeavingRows`), motion tokens in `index.css`, `ProgressBar` width transition |
| `748e1bc` | Browser cache of `index.html`: the server sends `Cache-Control: no-cache` for `index.html` and root files, and the launcher opens `/?v=<timestamp>`, so a window never starts from an old copy that points at deleted chunk files (the cause of "Resources errors / links missing" seen via the desktop shortcut) |
| `0cd815b`, `86d9b9f`, `c21d353` | Stale tab after a rebuild: `vite:preloadError` reloads the page once (`lib/staleBuild.ts`, 10 s guard against loops), router `errorElement` `RouteError` ("Calm-X was updated" + Reload). Also: project/area names on tasks are links (`ItemLink`); windowless launcher (`install-shortcuts.ps1`) |
| `dd60644`, `acb1e3c` | Typography and identity: Plus Jakarta Sans bundled with @fontsource (no Google Fonts request; guard test `noExternalFonts`), `components/common/Logo.tsx` in the sidebar header (collapsed: the logo is the expand button), new `public/favicon.svg` linked in `index.html`, `icons.svg` removed |
| `bf7f813` to `69a7d7a` | Code health round, parts 1-5: faster tests, `TaskDrawer` and `ItemDetailView` split, task lists in fixed queries, lazy routes |
| `a868009` | Foundation part 4: one refresh helper for task hooks, v1 spec files marked archived |
| `155e2a9` | Foundation part 3: every API datetime is timezone-aware (`schemas/base.py` `ApiModel`) |
| `a0825af` | Foundation part 2: "Planned earlier" block on Today (Keep for today / Remove from Today / Clear all with Undo) |
| `ec8ef37` | Foundation part 1: `tasks.completed_at` (migration 009), "Completed …" in the task drawer, All tasks sort "Recently completed" |
| `be2fc2d` | Searchable project/area picker (`ItemPicker`) replaces long dropdowns |
| `319ed78` | Smart capture (due date, priority, tags, project from the text; several lines at once) and Inbox row/bulk triage actions |
| `5ce1e21`, `52f7ef4` | Weekly Review: new "Waiting for" and "Someday" steps (8 steps now), `POST /api/tasks/{id}/follow-up`, `GET /api/weekly-review/waiting` |
| `634ee2c` | Dashboard reworked into an exceptions page (to process, waiting too long, projects needing attention); Today shows how long a task has waited; fixes broken task links on the Dashboard |
| `2ba0b34` | Project/Area detail page: summary strip, tasks and meetings moved up, quick add, working drag-reorder, wider layout (`GET /api/items/{id}?today=` adds `stats`) |
| `83509d2` | Areas and Resources lists: search, sort, filters, card/compact-list toggle, per-item stats (`GET /api/items?type=area|resource&today=`); `ItemListView` removed |
| `81f688b` | All tasks: search, status, state chips, sort, group by, card/compact-list toggle (`GET /api/tasks` gains `q`, `status`, `waiting`, `someday`, `deferred`, `from_meeting`, `today`, `sort`, `order`) |
| `07cee28` | Projects list: search, sort, filters, card/compact-list toggle, per-project stats (`GET /api/items?type=project&today=`) |
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
That window must stay open. The windowless way: `install-shortcuts.ps1` creates "Calm-X" / "Stop Calm-X" shortcuts
(`calmx-hidden.vbs` runs `start-calmx.ps1 -Background` / `stop-calmx.ps1` with no console; icon `assets/calmx.ico`; logs in
`logs/`, gitignored). `-Background` never starts a second server and opens an Edge/Chrome `--app=` window. `stop-calmx.ps1`
only stops a process on the port whose command line contains `backend.main`. To test the launcher, use another `-Port`,
`-SkipBuild` and `CALM_X_*` env vars pointing at copies, so `frontend/dist` and the real DB stay untouched.

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
- **Datetimes**: `models.utils.now_utc()` returns *naive* UTC; `UTCDateTime` adds UTC on load. A value you just wrote is still
  naive in memory, so every response schema derives from `schemas.base.ApiModel`, which makes any naive datetime aware
  (the browser reads a bare ISO string as local time). Derive new schemas from `ApiModel`, not `BaseModel`.
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
  `INEFFECTIVE_DYNAMIC_IMPORT` warnings if they show up. `tsc -b` leaves `frontend/tsconfig.tsbuildinfo`; delete it.

## Backlog (not prioritised yet)

Ideas the owner liked: recurring tasks; weekly status report generated at the end of Weekly Review; "Done" log; one
"next action" per project; "+ New project in this area" on the Area page; per-Area dashboard; search inside notes; bulk
actions in project task lists; duplicate project / save project as template; desktop reminders; backups to a synced
folder via `CALM_X_BACKUP_DIR`.

Known gaps:

- Search and tag filters ignore Someday/Defer: label them in results or hide them by default with a toggle.
- Smaller "Not done" notes are kept at the end of each feature file.
