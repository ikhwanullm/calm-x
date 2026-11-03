# Calm-X

A local, single-user task manager built around the PARA method (Projects, Areas, Resources, Archives).
It runs entirely on your own computer: a FastAPI + SQLite backend serves a React app on `localhost`, with no account
and no internet connection needed.

## What it does

- **Capture**: press `Q` anywhere, or type in the Inbox. One line per task; markers in the text set the details
  (see [Capture syntax](#capture-syntax)). Paste a list and every line becomes a task.
- **Inbox triage**: move, prioritise, plan, park or delete tasks one by one or in bulk, with a searchable project picker.
- **Today**: a week strip (meetings, due dates, plans, project deadlines, start dates) above what to do now: overdue,
  due today, planned for today, plans left over from earlier days, and what you are waiting for (with how long).
- **Projects, Areas, Resources**: lists with search, sort, filters and a card/list toggle; detail pages with a summary,
  tasks (quick add, drag to reorder), meeting notes, notes, reference links and linked resources. Projects can belong
  to an Area, have a deadline and are completed and archived when done.
- **Tasks**: subtasks, tags, priority, due date, "Add to Today", "Waiting for", "Defer until", "Someday", and Undo after a delete.
- **Meeting notes**: Markdown notes per Project or Area with autosave. Lines like `[ ] do this` or `@Budi: send that`
  can become tasks (optional: `[x]` or "Nothing more to process" means handled); questions and decisions are kept; the next
  meeting starts with what is still open from the last one.
- **Dashboard**: only what needs attention: things to process, waits that take too long, projects that are slipping.
- **Weekly Review**: a guided session: Inbox, Meetings, Waiting for, Projects, Areas, Resources, Someday, Summary.
- **Templates**, **Archive**, global search, command palette, light and dark theme, automatic backups, JSON export/import.

## Requirements

- Windows, macOS or Linux (the double-click launcher is for Windows)
- Python 3.11+
- Node.js 18+

## First-time setup

```bash
python -m venv .venv
.venv\Scripts\activate            # Windows; on macOS/Linux: source .venv/bin/activate
pip install -e ".[dev]"
cd frontend
npm install
```

## Starting the app

**Windows:** double-click `Start Calm-X.cmd`. It builds the frontend when the source changed since the last build,
starts the server on <http://127.0.0.1:8080> and opens the browser. Keep the window open while you use the app; close it
or press `Ctrl+C` to stop. Options: `start-calmx.ps1 -Port 9090 -NoBrowser -SkipBuild`.

**Windows, without a console window:** run `install-shortcuts.ps1` once (right-click > Run with PowerShell). It puts
"Calm-X" and "Stop Calm-X" shortcuts (with the Calm-X icon) on the Desktop and in the Start Menu. "Calm-X" starts the
server hidden (it also rebuilds the frontend first when the source changed) and opens Calm-X in its own Edge or Chrome
app window; if the server already runs it only opens the window. "Stop Calm-X" stops the server. Logs go to `logs/`.
`install-shortcuts.ps1 -Remove` deletes the shortcuts.

**Any platform, by hand:**

```bash
cd frontend && npm run build && cd ..
python -m backend.main             # or: python -m backend.main --port 9090
```

Then open <http://localhost:8080>. Database migrations run automatically when the server starts.

## Capture syntax

Used by the Inbox capture box and Quick capture (`Q`). Markers are removed from the title; anything that does not match
stays in the title as typed.

| Marker | Meaning | Examples |
|---|---|---|
| `!high` `!medium` `!low` | Priority (also `!h` `!m` `!l`, `!tinggi` `!sedang` `!rendah`) | `Call supplier !h` |
| `#tag` | Tag | `#finance` |
| `@name`, `@"two words"` | Project or Area (by title, only when exactly one matches) | `@website`, `@"Home renovation"` |
| Date words | Due date: `today`/`hari ini`, `tomorrow`/`besok`, `lusa`, a weekday in English or Indonesian (the next one), `+3d`, `+2w`, `2026-11-05` | `Send invoice jumat` |
| `\word` | Keep a word plain | `\besok` stays "besok" |

`Enter` adds, `Shift+Enter` starts a new line; up to 50 lines at once, list bullets and `[ ]` are dropped.

## Keyboard shortcuts

Shortcuts do not fire while you type in a field. Press `?` in the app for the full list.

| Key | Action |
|---|---|
| `Q` | Quick capture |
| `/` | Search (opens the command palette) |
| `Ctrl/⌘ + K` | Command palette |
| `?` | Shortcut list |
| `Esc` | Close dialog, drawer or palette |
| Weekly Review, Inbox step | `P` to project, `A` to area, `M` Someday, `C` complete, `D` delete, `S` skip |

## Your data

Everything is stored under `data/` in the project folder (not committed to git):

```
data/
  calm_x.db      SQLite database
  backups/       automatic, manual and safety backups
```

### Backups

- **Automatic**: when the server starts and every hour while it runs, a backup is made if the newest one is more than
  24 hours old.
- **Manual**: Settings → Backups → Create backup now.
- **Safety copies**: taken right before deleting a Project/Area/Resource and before a "Replace" import. If that copy
  fails, the delete or import does not happen.
- The 7 newest regular backups and the 5 newest safety copies are kept. Files are named
  `calmx_backup_YYYYMMDD_HHMMSS_mmm[_kind].db` (safety copies end in `_pre-delete` or `_pre-import-replace`).

**Restoring a backup:** stop the app, copy the backup over the database, start the app again:

```bash
copy data\backups\calmx_backup_20261102_103045_042.db data\calm_x.db     # Windows
cp data/backups/calmx_backup_20261102_103045_042.db data/calm_x.db       # macOS/Linux
```

### Export and import

- **Export**: Settings → Data → Export JSON downloads `calmx_export_YYYYMMDD.json` with all data: items, tasks,
  subtasks, meetings, tags, links, templates, weekly reviews and preferences.
- **Import**: Settings → Data → Choose JSON file.
  - **Merge** adds the file's data next to yours with new ids; tags are matched case-insensitively; your preferences stay.
  - **Replace** swaps all data for the file's, after a verified safety backup (no backup, no import).
  - The whole file is validated first; an invalid file changes nothing. Exports from older versions still import.

## Configuration

Set in a `.env` file in the project root (see `.env.example`) or as environment variables. Paths are relative to the
project root.

| Variable | Default | Description |
|---|---|---|
| `CALM_X_PORT` | `8080` | Server port (or `--port`) |
| `CALM_X_DB_PATH` | `data/calm_x.db` | SQLite database file |
| `CALM_X_BACKUP_DIR` | `data/backups` | Backup folder (point it at a synced folder to keep copies off this machine) |
| `CALM_X_FRONTEND_DIST` | `frontend/dist` | Built frontend served by the backend |
| `CALM_X_DEV_ORIGINS` | (empty) | Comma-separated origins allowed for the Vite dev server, e.g. `http://localhost:5173` |

## Development

```bash
cp .env.example .env               # first time only: allows the Vite dev origin
cd frontend
npm run dev:full                   # Vite on http://localhost:5173 (hot reload) + backend on :8080
```

Or separately: `python -m backend.main` and `cd frontend && npm run dev`. Vite proxies `/api` to `127.0.0.1:8080`.

**Never experiment on your real data.** Run a second server on another port with a copy of the database and a scratch
build; [`docs/HANDOVER.md`](docs/HANDOVER.md) has the exact recipe.

### Tests

```bash
python -m pytest -q                  # backend
cd frontend && npx vitest run        # frontend, all tests (~35 s)
cd frontend && npm run test:changed  # only tests related to uncommitted changes
cd frontend && npx tsc -b            # type check
```

### Project docs

| File | For |
|---|---|
| [`CLAUDE.md`](CLAUDE.md) | Rules for AI coding sessions (data safety, commits, commands) |
| [`docs/HANDOVER.md`](docs/HANDOVER.md) | Current state, what to build next, architecture, conventions, gotchas |
| [`docs/features/`](docs/features/) | How each feature behaves, one file per area |
| [`docs/history/rounds.md`](docs/history/rounds.md) | Records of finished work rounds |
| [`.kiro/steering/ui-guidelines.md`](.kiro/steering/ui-guidelines.md) | Design tokens, spacing, dates, shortcuts, accessibility |
| `.kiro/specs/para-task-manager/` | The original v1 spec (archived) |

Stack: FastAPI, SQLAlchemy 2.0, Alembic, SQLite (WAL) · React 19, Vite, TypeScript, Tailwind, shadcn/Radix,
TanStack Query, date-fns.
