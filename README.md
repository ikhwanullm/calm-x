# Calm-X

A local PARA Method task manager. Runs entirely on localhost — no internet required.

## Prerequisites

- Python 3.11+
- Node.js 18+

## Setup

### Backend

```bash
cd d:/Kiro Local/calm-x
python -m venv .venv
.venv\Scripts\activate  # Windows
# source .venv/bin/activate  # macOS/Linux
pip install -e ".[dev]"
```

### Frontend

```bash
cd frontend
npm install
```

## Development

### Run both servers together (recommended)

Copy the example environment file on first run:

```bash
cp .env.example .env
```

Then start both servers:

```bash
cd frontend
npm run dev:full
```

This starts:
- **Frontend** at `http://localhost:5173` (Vite dev server, hot reload)
- **Backend** at `http://127.0.0.1:8080` (FastAPI + uvicorn)

API calls from the frontend are proxied from `/api` → `http://127.0.0.1:8080/api`.

### Run servers individually

Backend:
```bash
python -m backend.main
# or with a custom port:
python -m backend.main --port 9090
```

Frontend:
```bash
cd frontend
npm run dev
```

## Production Build

```bash
cd frontend
npm run build
# Then serve via backend:
python -m backend.main
# Open http://localhost:8080
```

## Tests

Backend:
```bash
python -m pytest
```

Frontend:
```bash
cd frontend
npx vitest run
```

## Environment Variables

All variables use the `CALM_X_` prefix and can be set in `.env` or as OS environment variables.

| Variable | Default | Description |
|---|---|---|
| `CALM_X_PORT` | `8080` | Port for the backend server (also settable with `--port` CLI flag) |
| `CALM_X_DB_PATH` | `data/calm_x.db` | Path to the SQLite database file, relative to the project root |
| `CALM_X_BACKUP_DIR` | `data/backups` | Directory where automatic and manual backups are stored |
| `CALM_X_DEV_ORIGINS` | `` | Comma-separated list of allowed dev origins (e.g. `http://localhost:5173`) for the CSRF middleware |

**Safety:** Never use your production database for testing. Point `CALM_X_DB_PATH` and `CALM_X_BACKUP_DIR` to a temporary directory when experimenting:

```bash
CALM_X_DB_PATH=/tmp/calm_test.db CALM_X_BACKUP_DIR=/tmp/calm_backups python -m backend.main
```

## Data Location

By default, all data is stored under `data/` in the project root:

```
data/
  calm_x.db      # SQLite database
  backups/       # Automatic and manual backups
```

## Backup and Restore

Calm-X creates automatic backups when the server starts (if the last backup is more than 24 hours old). Manual backups can be created from **Settings → Backups → Create backup now**.

Backup files follow the naming pattern: `calmx_backup_YYYYMMDD_HHMMSS_mmm.db`

A maximum of 7 backups are kept; older ones are automatically deleted when a new backup is created.

**Restoring from a backup:**
1. Stop the backend server.
2. Copy the backup file over the database file:
   ```bash
   cp data/backups/calmx_backup_20261028_103045_042.db data/calm_x.db
   ```
3. Restart the backend server.

## Import and Export

**Export:** From **Settings → Data → Export JSON**. Downloads a JSON file (`calmx_export_YYYYMMDD.json`) containing all your data: items, tasks, subtasks, tags, templates, weekly reviews, and preferences.

**Import:** From **Settings → Data → Choose JSON file**. Two modes:

- **Merge** — Adds imported data alongside existing data. All imported records receive new IDs. Tags are merged case-insensitively (no duplicates created). Existing preferences are not overwritten.
- **Replace** — Replaces all existing data with the file contents. A verified backup is created automatically before any data is modified. If the backup fails, the import is cancelled.

The import validates the full file structure, all internal references, and field constraints before writing anything. An invalid file returns an error with no data changed.
