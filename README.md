# Drawing Pipe Process Explorer

Interactive pipe-shape process explorer with a FastAPI backend and React frontend.

It supports parametric editing of consecutive pipe sections, transition visualization,
and process metrics (area reduction, eccentricity, thickness reduction).

## Features

- Shape support: `Circle`, `Rect`, `CubicSplineShape`
- Pipe types: `CircleCircle`, `RectRect`, `SplineSpline`
- Interactive transition cards with marker drag, axis locks, and fullscreen modal
- Live metric charts with hover linkage to transition markers
- Template-based workflow (`PROCESS`, `FINISH_3`, `FINISH_6`, `FINISH_8`)

## Screenshot

![Drawing Pipe Process Explorer](images/screenshot.png)

## Tech Stack

- Backend: FastAPI + Pydantic
- Frontend: React + Vite + TypeScript
- Python tooling: `uv`, `ruff`, `pytest` (when tests exist)
- Frontend tooling: `bun`

## Project Layout

```text
drawing_pipe/
├── backend/                     # Runtime entrypoint (uvicorn target)
├── frontend/                    # React/Vite app
├── src/drawing_pipe/
│   ├── api/                     # FastAPI app, schemas, domain conversion
│   └── core/                    # Geometry/domain logic
├── images/
└── AGENTS.md
```

## Prerequisites

- Python 3.13+
- `uv`
- `bun`

## Setup

```bash
# Install/sync Python dependencies
uv sync

# Install frontend dependencies
cd frontend && bun install
```

## Run (Development)

Backend:

```bash
ALLOWED_ORIGINS="http://localhost:5173,http://127.0.0.1:5173,http://192.168.2.160:5173" \
uv run uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
```

Frontend:

```bash
cd frontend
# Vite proxies /api -> http://127.0.0.1:8000 (configured in vite.config.ts)
bun run dev
```

Notes:

- For local/LAN dev, leave `VITE_API_BASE_URL` unset to use Vite proxy.
- Use `.envrc.example` as a template if you use `direnv`.

## Build / Lint / Validate

Python/backend:

```bash
ruff check .
ruff format .
uv run python -m py_compile backend/main.py src/drawing_pipe/api/app.py src/drawing_pipe/api/domain.py
```

Frontend:

```bash
cd frontend && bun run build
```

## Tests

Current repository state: no committed `tests/` directory yet.

When tests are added, recommended commands:

```bash
# Run all tests
uv run pytest -q

# Run one file
uv run pytest tests/test_process.py -q

# Run one test function
uv run pytest tests/test_process.py::test_area_reduction -q

# Run by expression
uv run pytest tests/test_process.py -k "circle and reduction" -q
```

## API Endpoints

- `GET /health`
- `GET /api/templates`
- `POST /api/analyze`

## Domain Notes

- `src/drawing_pipe/core/shapes.py`: `Circle`, `Rect`, `CubicSplineShape`
- `src/drawing_pipe/core/pipes.py`: pipe types and derived properties
- `src/drawing_pipe/core/process.py`: `ProcessAnalysis`
- Metrics payload fields:
  - `area_reductions`
  - `eccentricity_diffs`
  - `thickness_reductions`

## Agent Guidance

If you are running an agentic coding workflow, use `AGENTS.md` for repository-
specific instructions, style expectations, and command checklist.

## License

MIT
