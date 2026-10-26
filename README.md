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
