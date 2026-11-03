# Finished rounds

Part of the Calm-X docs; start at [`docs/HANDOVER.md`](../HANDOVER.md). Describes what is built, for coding sessions. These are records of finished work rounds: what was asked, and notes from the build.

## Code health round (built 2026-11-02, no visible change)

| Part | Result |
|---|---|
| 1. Faster frontend tests | `vite.config.ts` test block: `pool: 'vmThreads'`, `maxWorkers: 6`, `testTimeout: 15000` (`isolate` stays on: many files `vi.mock` the same hooks). Full suite about 221 s -> 30-55 s. `npm run test:changed` runs only tests for changed files; use it while working, run the full suite once before committing. |
| 2. `TaskDrawer` split | `components/tasks/drawer/` has `DrawerHeader`, `TaskFields`, `WaitingForField`, `TagsSection`, `SubtasksSection`, `DescriptionField`, `DrawerFooter` (with `MoveToSelect`). `TaskDrawer.tsx` 736 -> 138 lines: loads data, owns the delete/reset-subtasks confirmations and the layout. Pieces get what they show as props and call their own mutation hooks. |
| 3. `ItemDetailView` split | `components/items/detail/` has `ItemHeader` (banners, title, complete/reopen, "..." menu, their dialogs and hooks; named `ItemHeader`, not `ItemHeaderActions`), `TasksSection`, `InlineTitle`, `InlineField`, `InlineDeadline`. `ItemDetailView.tsx` 745 -> 171 lines. |
| 4. Fixed-query task lists | `task_service._tasks_to_responses(session, tasks)`: 4 queries (subtask counts grouped, tags via SQL, meetings `IN`, items `IN`) for any number of tasks; `_task_to_response` is a one-task call. Used by `list_tasks` (item tasks, inbox, reorder), `list_someday`, `get_today`, `filter_service`, `calendar_service`, meeting "create tasks". Review and dashboard do not build task responses. `test_task_response_queries.py` counts statements for 3 vs 20 tasks. |
| 5. Lazy routes | `router.tsx`: every page except Dashboard and Today is `React.lazy`. `AppShell` wraps its `Outlet` in `Suspense` (`RouteFallback`, a quiet "Loading..."); `/review` has its own. Dev gallery is only imported when `import.meta.env.DEV`. Main chunk 1,073 kB -> 346 kB (gzip 315 -> 105 kB). |

Not done on purpose: splitting `SettingsPage.tsx` (608 lines) and `TemplateDetailPage.tsx` (531): they change rarely.
Server-side pagination: not needed at this size.

Gotcha: a repo-wide guard test adds 2 tests (no BOM, no literal unicode escapes in JSX) per source file, so new files raise the test count.

## Foundation round (chosen by the owner 2026-11-02; details proposed in the brainstorming session) — DONE

Why: the next features the owner wants (Done log, weekly status report, recurring tasks) all need to know *when* a task
was completed, and a few small data issues are felt daily. Build in this order, **one commit per part**, each verified with
the recipe in `HANDOVER.md`. No new pages in this round.

### Part 1: `tasks.completed_at` (migration 009) — DONE

Built as specified below. Notes from the build: completing an already complete task changes nothing (a task completed before 009 keeps NULL even if
"completed" again); the auto-complete/reopen paths in `subtask_service` (`_reevaluate_task_status`, `create_subtask`, `mark_subtask_incomplete`) set/clear it
like `mark_complete`/`mark_incomplete`; `PUT /api/tasks/{id}` cannot set it; the filter API has `sort=completed` (with `order=desc` newest first,
NULLs always last) and the UI sends `desc`. Checked on a copy of the real DB: its 12 completed tasks stayed NULL, row counts and foreign keys unchanged.

- Migration `009_task_completed_at.py`: `ALTER TABLE tasks ADD COLUMN completed_at DATETIME` (plain ADD COLUMN, never
  `batch_alter_table`). **No backfill**: tasks completed before 009 keep NULL ("completed, date unknown"). Do not guess it
  from `updated_at`. Pin the revision in the migration test like 004/005 do.
- Set it to `now_utc()` on every path that turns a task complete, and back to NULL on every path that reopens one:
  `task_service.mark_complete` / `mark_incomplete`, and the auto-complete / auto-reopen in `subtask_service` (lines ~44, ~91, ~163).
  Grep `is_complete = ` before finishing; a path that is missed makes the Done log lie. Completing an already complete task
  keeps the first `completed_at`.
- Carry it everywhere a task's columns travel: `TaskResponse` (aware UTC, `Z`), export and import (old export files
  without the field import as NULL), undo snapshots and restore, template-to-project creation (new tasks start NULL).
- Subtasks: not in this round.
- UI, small only: the task drawer shows "Completed {relative date}" for a completed task with a date; All tasks gains the
  sort "Recently completed" (completed tasks with a date first, newest first; NULLs last). Nothing else; the Done log and
  the weekly report are designed later with the owner.
- Tests: each complete/reopen path sets/clears it; export → import round trip keeps it; migration on a copy of a pre-009 DB
  leaves existing rows NULL.

### Part 2: old "Planned for today" plans — DONE

Built as specified below (`components/today/PlannedEarlier.tsx`, `plannedLabel` in `utils/date.ts`). Details: the split is done in the browser from `get_today`'s
`focused` list (a plan counts as "for today" when `focus_date >= today`); "Clear all" and its Undo are client-side (`tasksApi.update` per task; Undo
restores each previous date; only the ones that were cleared are offered back); the week strip's `planned` list (`calendar_service`) now only holds
`focus_date >= today`, so old plans are not drawn there. If only old plans exist, no "Nothing planned for today" message is shown.

Problem: `focus_date` never expires, so a task added to Today last week still sits in "Planned for today" with no hint.
Decision proposed: **never clear plans silently**; show them and let the owner decide in one click.

- `get_today` already returns them in `focused`. The frontend splits that group: `focus_date == today` stays
  "Planned for today"; `focus_date < today` goes to a small block **"Planned earlier (N)"** under it, each row with a chip
  "Planned {weekday}" (or "Planned {d MMM}" if older than 6 days), sorted oldest first.
- Per row: **Keep for today** (sets `focus_date` to today) and **Remove from Today** (clears `focus_date`). Block header:
  **Clear all (N)** (clears all of them; one toast with Undo that puts each `focus_date` back; use a client-side undo that
  re-PATCHes, no new server snapshot type needed).
- The week view strip counts only today's plans for today; old plans are not drawn on past days.
- Dashboard: nothing new.

### Part 3: timezone-aware datetimes in every response — DONE

Built as specified below: `backend/schemas/base.py` `ApiModel` (a wrap field serializer that makes a naive datetime UTC-aware); every schema in
`backend/schemas/` inherits it, and **new schemas must too**. `task_service._as_utc` and `meeting_service._utc` are gone. `project_stats_service._utc`
stays only to compare activity moments of different tables. `backend/tests/test_api_datetimes_utc.py` walks the responses of ~50 endpoints
right after writes and fails on any datetime string without `Z`/offset (it found two real ones: reference links and subtasks). Request/response
models defined inside `api/backup.py`, `api/settings.py`, `api/tasks.py` still derive from plain `BaseModel` (they have no datetimes except the
backup list, which is built from aware values).

Item (Project/Area/Resource) responses still send naive datetimes right after a write. Fix it once, not per field:
a shared Pydantic base (e.g. `schemas/base.py` `ApiModel`) with a serializer that turns any naive `datetime` into
UTC-aware before output, and make every response schema inherit it. Then remove `task_service._as_utc` and similar
per-field patches. Test: create, update and fetch an item, a task and a meeting; every datetime string ends with `Z` or `+00:00`.

### Part 4: small cleanups (one commit) — DONE

Every hook in `hooks/useTasks.ts` (and `useTriage`) now calls the exported `refreshAfterTaskChange(qc)`; the v1 spec files carry an "archived" note. No behaviour change.

- `hooks/useTasks.ts`: the same three `invalidateQueries` lines are repeated in about eight hooks; make every hook use
  the existing `refreshAfterTaskChange(qc)` helper. No behaviour change.
- Add a note at the top of `.kiro/specs/para-task-manager/requirements.md` and `design.md`: "v1 spec, archived; current
  behaviour is in `docs/HANDOVER.md`".

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

## Micro-interactions round (done 2026-11-03)

Commits `802d1b9` (completion animation), `6a1e191` (Undo after complete), `7a868ef` (Today greeting). Behaviour is in
`features/lists.md` and `features/today-and-week.md`. The design as it was handed over:

#### Design (chosen by the owner 2026-11-03, from an interactive mockup)

Three commits in this order: completion animation, Undo after complete, Today header. Owner's choices: **subtle motion**
(about 180 ms per step, no bounce or overshoot) and **English** copy, like the rest of the UI. Add motion tokens once in
`index.css` (`--dur-fast: 120ms`, `--dur: 180ms`, `--ease: cubic-bezier(.2,0,0,1)`) and document them in `ui-guidelines.md`
§3 next to the other tokens. Everything that moves sits behind `@media (prefers-reduced-motion: no-preference)` (Tailwind
`motion-safe:`); with reduced motion the end state appears at once and nothing else changes.

**Part 1: completing a task feels finished (DONE, see `features/lists.md`; Parts 2 and 3 are still to build)**

- In `TaskRow` and `TaskCompactList` (so Today, Inbox, Someday, All tasks and Project/Area pages all get it):
  1. The checkbox fills with the accent and the check mark draws itself (stroke-dashoffset), `--dur`. Keep a real
     `<input type="checkbox">` for keyboard and screen readers; style it with `appearance-none` plus an SVG check, or put a
     visual box over a visually hidden input. Focus ring as now.
  2. The title gets a strike-through that grows left to right and turns `--muted`, `--dur`.
  3. In lists that drop completed tasks (Today, Inbox, Someday, an open-only All tasks), the row stays visible for about
     400 ms after the click, then fades and collapses its height (`--dur`), and the rows below slide up. Today, a refetch
     removes it at once; keep a leaving row on screen with a small helper (e.g. `hooks/useLeavingRows.ts`: remembers rows
     that left the data in the last ~600 ms and renders them with a leaving class). Lists that keep completed tasks
     (project page with "Show completed", All tasks with Status all) only do steps 1-2.
  4. Reopening (unchecking) has no exit animation: the strike-through simply goes away.
- `ProgressBar` animates its width (`transition: width 300ms`), so a project's progress moves to the new value.
- Drag and drop must still work (`@dnd-kit` rows with a leaving class are not draggable).
- Tests: the existing TaskRow/TaskList/Today tests must keep passing; add tests that a completed row is still in the DOM
  right after completion and gone after the delay (fake timers), and that with `prefers-reduced-motion: reduce` it goes at once.

**Part 2: "Completed · Undo" toast (DONE, see `features/lists.md`)**

- `useCompleteTask` shows `notify.success('Task completed', { action: Undo, duration: UNDO_TOAST_MS })` for completions from
  task rows and the drawer. The Weekly Review steps (`InboxStep`, `ProjectsStep`, `WaitingStep`) keep their own outcome UI
  and show no toast (pass an option such as `{ quiet: true }`), because an Undo there would not update the step's counters.
- Undo must put the task back **exactly** as it was, including its subtasks. Plain `incomplete` is not enough: completing a
  task completes all its subtasks, and reopening it reopens all of them (R8.9), so 2 of 3 done would come back as 0 of 3.
  Add `POST /api/tasks/{id}/undo-complete`: `mark_complete` records the ids of the subtasks that were open just before
  (in `undo_entries`, kind `complete`, 24 h like the others); undo reopens the task, clears `completed_at`, and reopens only
  those subtasks. Refuse with 409 if the task was changed since (reopened, deleted or completed again), and the toast then says
  "Couldn't undo: the task changed".
- Tests (backend): complete then undo restores subtask states and `completed_at` NULL; undo twice is refused; undo after a
  manual reopen is refused. Export/import does not need the new undo kind (Replace already clears `undo_entries`).

**Part 3: Today header (DONE, see `features/today-and-week.md`)**

- Replace the plain "Today" h1 with a greeting by the local hour: before 12:00 "Good morning", 12:00-16:59 "Good afternoon",
  from 17:00 "Good evening". Same h1 size and weight as now; the page title in the tab stays "Today". Recompute when the window
  regains focus and every 5 minutes, so a tab left open does not keep saying "Good morning" at night.
- Under it, one muted line: the date as now, then a summary of today, leaving out zero parts:
  "Tue, 3 Nov 2026 · 3 to do · 1 meeting · 6 waiting" ("to do" = overdue + due today + planned for today + planned earlier,
  the existing `workCount`; meetings of today from the week data; waiting = the Waiting for list). Each part is plain text,
  not a link. Nothing at all when the data is still loading (no "0").
- When `workCount` is 0 replace the dashed empty state with a calm all-clear block: a `Sun` icon (lucide, 20 px, muted),
  "All done for today." and a muted second line "Add something with Q, or plan from the week above.". If there were tasks
  today and the last one was just completed, the block fades in (`--dur`) instead of popping.
- Only on Today and only for today's view; selecting another day in the week strip keeps that day's heading as now.
