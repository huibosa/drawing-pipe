# AGENTS.md - Drawing Pipe Repository Guide

This file is for coding agents operating in this repository.
Follow these rules unless the user explicitly overrides them.

## Project Scope

- Python geometry/process domain (`shapes.py`, `pipes.py`, `process.py`).
- Streamlit app (`streamlit_app.py`) for current production UI.
- FastAPI backend (`backend/`) + React/Vite frontend (`frontend/`) rewrite.

## Quick Start for Agents

```bash
# 1) Sync Python dependencies
uv sync

# 2) Run backend API
uv run uvicorn backend.main:app --reload

# 3) Run Streamlit app (legacy/current production UI)
uv run streamlit run streamlit_app.py

# 4) Run frontend dev server (new rewrite UI)
cd frontend && bun install && bun run dev

# 5) Validate changes before finishing
ruff check . && uv run python -m py_compile streamlit_app.py backend/main.py && cd frontend && bun run build
```

## Hard Rules for This Repo

- Use `uv` for Python commands.
- Use `bun` for frontend commands.
- Do **not** create `.venv`.
- Do **not** install with `pip` in this repo.
- Do **not** add matplotlib x/y axis labels.
- Keep code/docs/commits in English.

## Rule File Discovery

- Cursor rules: none found (`.cursor/rules/` and `.cursorrules` absent).
- Copilot rules: none found (`.github/copilot-instructions.md` absent).
- If those files appear later, treat them as higher-priority instructions.

## Important Paths

- `streamlit_app.py`: Streamlit UI logic.
- `backend/main.py`: FastAPI app entrypoint.
- `backend/domain.py`: payload/domain conversion.
- `backend/schemas.py`: API models.
- `frontend/src/App.tsx`: main frontend state/UI.
- `frontend/src/TransitionCard.tsx`: transition plot + drag markers.
- `frontend/src/geometry.ts`: shape vertices/projection helpers.

## Build / Lint / Test Commands

### Python and Backend

```bash
# Sync Python dependencies
uv sync

# Run Streamlit
uv run streamlit run streamlit_app.py

# Run FastAPI backend
uv run uvicorn backend.main:app --reload

# Syntax check selected modules
uv run python -m py_compile streamlit_app.py backend/main.py backend/domain.py
```

### Frontend

```bash
# Install deps
cd frontend && bun install

# Dev server
cd frontend && bun run dev

# Production build (includes TS build)
cd frontend && bun run build

# Preview
cd frontend && bun run preview
```

### Lint / Format

```bash
# Python lint
ruff check .

# Python lint with fixes
ruff check --fix .

# Python format
ruff format .

# Frontend type + bundle validation
cd frontend && bun run build
```

### Tests

Current repo state: no committed `tests/` directory yet.

When tests exist, use `pytest` via `uv`:

```bash
# All tests
uv run pytest -q

# Single file
uv run pytest tests/test_process.py -q

# Single test function
uv run pytest tests/test_process.py::test_area_reduction -q

# Single test by expression
uv run pytest tests/test_process.py -k "circle and reduction" -q
```

If frontend tests are added later, use `bun run test` plus file/name filters.

## Python Style

- Prefer explicit type hints for public functions/methods.
- Keep domain logic pure and deterministic.
- Use Pydantic validation at model/API boundaries.
- Avoid silent coercion or silent failure paths.
- Keep geometry naming clear (`origin`, `diameter`, `length`, `width`, `v1/v2/v3`).

### Python Imports

- Order: stdlib -> third-party -> local imports.
- Keep import groups sorted (ruff-compatible).
- Follow existing local absolute import style where used.

## TypeScript / React Style

- Keep strict typing; avoid `any`.
- Use discriminated unions for shape/pipe variants.
- Prefer pure helper functions for math/geometry transformations.
- Keep component props typed and minimal.
- Keep drag behavior deterministic and frame-safe.

## Error Handling

- Backend should return clear, actionable errors for invalid payloads.
- Frontend should surface API errors in UI, not console-only.
- Validate user-edited values close to update boundaries.

## UI Behavior Conventions

- Preserve existing interaction constraints unless user asks to change:
  - center `x` lock behavior,
  - drag step snapping,
  - debounce analysis behavior,
  - marker visibility and style controls.
- Keep transition plot equal-axis projection to avoid distortion.

## Commit Guidelines

- Use: `type(scope): subject`.
- Subject: imperative, concise, no trailing period.
- Common types: `feat`, `fix`, `refactor`, `style`, `test`, `docs`, `chore`.
- Keep commits atomic and logically grouped.

## Agent Workflow Checklist

1. Read relevant files before editing.
2. Make minimal coherent changes.
3. Run relevant checks (`ruff`, `py_compile`, `bun run build`).
4. Do not commit generated outputs (`frontend/dist`, cache files).
5. Summarize changed files and verification commands in final response.
