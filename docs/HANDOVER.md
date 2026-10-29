# Calm-X handover

Last updated 2026-10-29. Written for the next coding session; read `CLAUDE.md` first for the hard rules.

## Where things stand

- `origin/main` is at `9cb3772`; local `main` has the docs commit and the Defer + Someday commit on top (not pushed).
- The v1 spec (`.kiro/specs/para-task-manager/`: requirements, design, tasks Phases 0–11) is fully built.
  Everything after that was added on top, directly in code (no spec files were updated for it).
- Schema head: **migration 007**. The owner's real DB was at 006 when last checked (2026-10-29); it upgrades to 007
  automatically the next time the app starts.
- Tests at the last commit: backend 480 passed, frontend 731 passed (59 files), `tsc -b` clean.

### Built after the v1 spec (newest first)

| Commit | What |
|---|---|
| (newest) | Defer + Someday: `tasks.defer_until` / `tasks.is_someday` (migration 007), "Defer until" and "Move to Someday" in the drawer, "Starts {date}" / "Someday" chips, `/someday` page + sidebar entry, `GET /api/tasks/someday`, "Someday [M]" in the Weekly Review Inbox step |
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

## Next up: safety round (agreed with the owner, 2026-10-29)

From a read-only end-to-end review. Three small fixes; do them as three separate commits, in this order.

### 1. Remove shadowed duplicate backend tests

Ten test functions are defined twice in the same module, so Python keeps only the second and the first never runs
(both copies are identical, so no coverage is lost; the reported total is just 10 too high):

- `test_api_filter.py`: `test_scope_all_excludes_archived_item_tasks`, `test_scope_all_returns_inbox_and_item_tasks`,
  `test_tags_invalid_string_returns_400`, `test_tags_valid_integers_accepted`
- `test_api_links.py`: `test_convert_active_project_to_area_and_back_stays_active`,
  `test_convert_completed_project_to_area_and_back_preserves_status`, `test_convert_invalid_deadline_returns_400`,
  `test_convert_valid_deadline_accepted`
- `test_api_dashboard.py`: `test_dashboard_reference_link_count_for_resources`
- `test_api_items.py`: `test_progress_reflects_task_counts`

Delete the second copy of each. Then add a guard test (e.g. `backend/tests/test_no_duplicate_tests.py`) that parses
every `backend/tests/test_*.py` with `ast` and fails if a module defines the same top-level `test_*` name twice.
Expected: backend count drops by 10, everything still passes.

### 2. Backups while the app keeps running, and before permanent deletes

Today `check_startup_backup` (`backend/main.py`, `services/backup_service.py`) only runs at startup, so an app left
running for days makes no new backups. Retention keeps the 7 newest files.

- Make a daily backup while the app runs: a background task (FastAPI lifespan / thread with a timer) that calls the
  same "backup if the newest is older than 24 h" check, e.g. every hour. Failures are logged, never crash the server.
- Make a backup before **permanent delete of an item** (`DELETE /api/items/{id}`), using trigger `pre-delete`, like
  replace import already does with `pre-import-replace`. If that backup fails, refuse the delete (500 with the error
  contract) rather than deleting without a safety copy.
- Retention: pre-delete backups must not push out the daily ones. Either keep 7 daily + the 5 newest pre-delete/
  pre-import files separately (filter by trigger in the filename), or raise the limit; pick the first if simple.
  Never delete files that don't match the backup name pattern.
- Tests: timer logic with an injected clock (no real waiting), pre-delete backup created in the tmp backup dir,
  delete refused when backup fails, retention keeps both kinds. Use `tmp_path` configs only.

### 3. Dashboard "Needs attention" must follow the Today rules

`dashboard_service._get_upcoming_deadlines` lists every open task with a due date. Align it with `/api/tasks/today`:
exclude `is_someday` tasks and tasks whose `defer_until` is after the client's `today`. **Decision needed from the
owner**: Waiting-for tasks — exclude them (like Today) or keep them with a "Waiting" label because an overdue wait
usually needs a follow-up? Default if not decided: keep them, labelled "Waiting · {who}".
Show the same chips the task rows use. Tests: someday and deferred tasks absent, waiting task handled as decided.

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
