# Calm-X — rules for coding sessions

Calm-X is a local, single-user PARA task manager (FastAPI + SQLite backend, React + Vite frontend).
The owner talks in **Indonesian**; reply in Indonesian, keep code, commits and docs in English.

**Read `docs/HANDOVER.md` first.** It has the current state, architecture, gotchas and the next item to build.

## Non-negotiable: the owner's real data

`data/calm_x.db` holds the owner's real data. The owner often has the app running on port 8080.

- Never write to, migrate, import into, replace or delete `data/calm_x.db`, and never touch `data/backups/`.
- Never stop the owner's running app (port 8080) without asking.
- Never run `npm run build` while testing: it rewrites `frontend/dist`, which the owner's running app serves.
  Build to a scratch folder instead (see the verification recipe in `docs/HANDOVER.md`).
- Test against a read-only copy made with the SQLite backup API, on another port.
- Never commit `data/`, `*.db`, backups or export files.

## How to work

- Edit code directly. Run backend and frontend tests, the type check, and verify in the browser before
  saying something works. Say plainly what was not verified.
- **Commit each finished, verified feature or fix on its own**, without being asked. Message style:
  `feat: …`, `fix(frontend): …`, `chore: …`, `docs: …`, with a short body, ending with the attribution line
  your session instructions give you (this repo has used `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`).
- **Push only when the owner asks.** Remote: `https://github.com/ikhwanullm/calm-x.git`, branch `main`.
  Never put tokens in the remote URL or files. No force push or history rewrite.
- Don't write files with PowerShell `Set-Content`/`Out-File`/here-strings (they have corrupted text before).
  Use the editor tools. UTF-8 without BOM. Never write `\uXXXX` escapes in JSX text (a test fails on it).
- Schema changes go in a new Alembic migration (`backend/migrations/versions/00N_*.py`). Never edit an applied one.

## Commands

```bash
python -m pytest -q                       # backend, from repo root (~1–2 min)
cd frontend && npx vitest run             # frontend (slow: 5–10 min, run in background)
cd frontend && npx tsc -b                 # type check; then delete frontend/tsconfig.tsbuildinfo
```
