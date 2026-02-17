# AGENTS.md - Drawing Pipe Agent Guide

Repository guidance for coding agents working in this project.
Follow these rules unless the user explicitly overrides them.

## Project Summary

- Stack: FastAPI (Python) + React/Vite (TypeScript).
- Python package root: `src/drawing_pipe/`.
- Backend entrypoint: `backend/main.py`.
- Frontend app: `frontend/`.
- Tooling: `uv` (Python), `bun` (frontend).

## Cursor / Copilot Rule Files

Checked:

- `.cursor/rules/` -> not present
- `.cursorrules` -> not present
- `.github/copilot-instructions.md` -> not present

If these files are added later, treat them as higher-priority repo rules.

## Quick Start

```bash
# Sync Python deps
uv sync

# Run backend
uv run uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload

# Run frontend
cd frontend && bun install && bun run dev
```

## Build / Lint / Test Commands

### Python / Backend

```bash
# Lint
ruff check .

# Lint with fixes
ruff check --fix .

# Format
ruff format .

# Syntax compile check
uv run python -m py_compile backend/main.py src/drawing_pipe/api/app.py src/drawing_pipe/api/domain.py
```

### Frontend

```bash
# Install deps
cd frontend && bun install

# Dev
cd frontend && bun run dev

# Typecheck + production build
cd frontend && bun run build

# Preview
cd frontend && bun run preview
```

### Tests

Current state: no committed `tests/` directory yet.

When Python tests exist:

```bash
# All tests
uv run pytest -q

# Single file
uv run pytest tests/test_process.py -q

# Single test function
uv run pytest tests/test_process.py::test_area_reduction -q

# By expression
uv run pytest tests/test_process.py -k "circle and reduction" -q
```

If frontend tests are added later (Vitest/Jest style):

```bash
cd frontend && bun run test
cd frontend && bun run test -- path/to/file.test.ts
cd frontend && bun run test -- -t "name fragment"
```

## Important Paths

- `backend/main.py` - runtime entrypoint.
- `src/drawing_pipe/api/app.py` - FastAPI app setup/routes.
- `src/drawing_pipe/api/domain.py` - payload/domain conversion.
- `src/drawing_pipe/api/schemas.py` - API models.
- `src/drawing_pipe/core/` - geometry/process domain logic.
- `src/drawing_pipe/templates/data/*.json` - template data files (one template per file).
- `frontend/src/app/App.tsx` - app state orchestration.
- `frontend/src/features/transitions/TransitionCard.tsx` - transition plot + drag.
- `frontend/src/features/metrics/MetricLineChart.tsx` - metric charts.
- `frontend/src/shared/lib/geometry.ts` - projection/vertex helpers.

## Code Style - Python

- Use explicit type hints for public functions.
- Keep core logic deterministic and side-effect free.
- Keep API validation at schema boundaries.
- Prefer absolute imports under `drawing_pipe.*`.
- Import order: stdlib -> third-party -> local.
- Avoid broad exception swallowing.
- Return actionable errors from API endpoints.

## Code Style - TypeScript / React

- Keep strict typing; avoid `any` unless unavoidable.
- Use discriminated unions for shape variants.
- Keep components lean; move math logic to shared helpers.
- Avoid direct state mutation.
- Prefer explicit prop names and typed callbacks.
- Keep drag/hover logic deterministic and race-safe.

## Naming & Formatting

- Domain terms should stay consistent (`origin`, `diameter`, `v1/v2/v3`).
- Use i18n keys for user-visible labels (`frontend/src/shared/i18n/i18n.ts`).
- TS: `camelCase` for vars/functions, `PascalCase` for types/components.
- Python: follow ruff/PEP8 defaults.

## Error Handling Expectations

- Frontend must surface API errors in UI, not console-only.
- Interactive API flows should support cancellation and latest-wins behavior.
- Backend should reject invalid payloads with clear responses.
- Do not silently ignore failed conversions/parsing.

## Interaction / Performance Rules

- Preserve lock semantics and marker drag constraints unless asked to change.
- Preserve snap-step geometry behavior unless asked to change.
- Keep metrics analysis request flow optimized for drag interactions.
- Ensure transition fullscreen/modal keeps full interactivity.

## Environment / Generated Files

- Do not commit generated frontend output (`frontend/dist/`).
- Do not commit local `.envrc`; use `.envrc.example`.
- `src/*.egg-info/` is generated metadata and should remain ignored.

## Commit Guidelines

- Format: `type(scope): subject`.
- Use imperative subject, concise, no trailing period.
- Common types: `feat`, `fix`, `perf`, `refactor`, `style`, `docs`, `test`, `chore`.
- Keep commits atomic and logically grouped.

## Agent Workflow Checklist

1. Read relevant files before editing.
2. Make minimal coherent changes.
3. Run relevant checks before finishing.
4. Verify staged files exclude generated artifacts.
5. Summarize changed files + verification commands in the final response.
