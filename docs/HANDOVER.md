# Calm-X handover

Last updated 2026-10-29. Written for the next coding session; read `CLAUDE.md` first for the hard rules.

## Where things stand

- Defer + Someday (`7b110e1`) is pushed. The safety-round commits after it are local until the owner asks for a push.
- The v1 spec (`.kiro/specs/para-task-manager/`: requirements, design, tasks Phases 0–11) is fully built.
  Everything after that was added on top, directly in code (no spec files were updated for it).
- Schema head: **migration 007**. The owner's real DB is already at 007 (checked read-only on 2026-10-29).
- Tests at the last commit: backend 504 passed, frontend 732 passed (59 files), `tsc -b` clean.

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

## Next up: Meeting notes (designed with the owner, 2026-10-29)

The owner has 3–5 meetings a week, almost always about one project. One growing Notes field per project doesn't
work for that. Notes are for the owner only (nothing is shared or sent). Build it in two commits: **A** then **B**.

### Decisions already made

- A meeting belongs to exactly **one Project or Area** (not a Resource; not an archived item). No multi-item links.
- The body is **Markdown** (GitHub-flavoured, incl. task lists). Render safely: no raw HTML; links open in a new tab
  with `rel="noopener noreferrer"`.
- No separate "series" entity: continuity comes from **carrying over** the previous meeting of the same item (part B).
- Action items for other people only become Waiting-for tasks for the owner. No export/share.

### Data model (migration 008)

- New table `meetings`: `id`, `item_id` (FK items, ON DELETE CASCADE, required), `title` (≤200), `held_at`
  (datetime UTC, entered as local date + time), `attendees` (text ≤500, free text), `body` (Markdown, ≤50 000 chars),
  `processed_at` (datetime NULL), `created_at`, `updated_at`.
- `tasks.meeting_id INTEGER NULL REFERENCES meetings(id) ON DELETE SET NULL` (plain `ADD COLUMN`): the meeting a
  task was created from.
- Export/import (remap ids, include `meeting_id` on tasks), Replace clears `meetings`, undo snapshots of tasks carry
  `meeting_id`. Deleting a meeting uses ConfirmDialog and the same Undo pattern as tasks (`undo_entries` kind `meeting`).
- Meetings of an archived item are read-only, like everything else on it.

### Line syntax parsed from the body

| Line (optionally inside a list, `- …`) | Meaning | On "Process" |
|---|---|---|
| `[ ] text` or `- [ ] text` | my action | task in the meeting's item, `meeting_id` set |
| `@Who: text` | someone else's action | task with `waiting_for = Who` (title = text), `meeting_id` set |
| `? text` | open question | stays in the notes; carried over in part B |
| `! text` | decision | stays in the notes; listed in the meeting summary |

After a line is turned into a task, rewrite it in the body as `[→] text` (or `@→Who: text`) so it is visibly done
and never converted twice. Parsing lives in one backend function used by both the preview and the process endpoint.
No natural-language dates in this round: due dates are set in the process dialog.

### Part A — meetings, editor, processing

- API: `GET/POST /api/items/{id}/meetings`, `GET/PUT/DELETE /api/meetings/{id}`, `GET /api/meetings` (all, newest
  first, `q` search on title + attendees + body with escaped LIKE), `GET /api/meetings/{id}/actions` (parsed lines),
  `POST /api/meetings/{id}/process` (body: the confirmed actions with optional due date / priority; creates tasks in
  one transaction, respects the 100-task limit, rewrites the converted lines, sets `processed_at`).
- Project and Area pages: a **Meetings** section (newest first; each row shows date, title and "N actions to process"
  while unconverted `[ ]`/`@` lines remain) with **+ Meeting**, which creates one prefilled with
  title "{item title} meeting", now as `held_at`, and a template body:
  `## Agenda`, `## Notes`, `## Decisions`, `## Actions` (with an example `[ ] ` line), `## Questions`.
- Meeting page `/meetings/:id`: title, date/time, item link, attendees; Markdown **Edit / Preview** toggle; autosave
  (debounced ~1 s and on blur, with a visible "Saved" state; never lose typing on navigation); a side panel listing the
  parsed lines live; **Process actions** button opening a dialog to tick lines, set due date/priority, then create.
- `/meetings` page + sidebar entry "Meetings": list with search, grouped by week.
- Task drawer: "From meeting: {title}, {date}" linking to the meeting.
- Command palette search includes meetings.

### Part B — continuity and review

- **+ Meeting** on an item that already has meetings adds a "From last meeting" block to the new body: the previous
  meeting's unconverted `? ` questions, and links to tasks created from it that are still open.
- Weekly Review: show meetings of the past week that still have actions to process, with a link to process them.
- Keep the parsed decisions (`! `) and created tasks easy to query; the future weekly report will use them.

### Tests and verification

Backend: parser cases (each prefix, inside lists, already converted lines, ordinary text), process creates tasks with
`meeting_id`/`waiting_for` and rewrites lines, re-processing creates nothing new, 100-task limit, archived item
read-only, cascade on item delete, `SET NULL` on meeting delete, export/import round trip, migration 008 pinned test.
Frontend: section on Project/Area, autosave, preview renders Markdown but not raw HTML, process dialog, drawer link.
Browser check on a DB copy, as in the recipe above.

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
