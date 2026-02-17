# AGENTS.md - Drawing Pipe Repository Guide

Repository instructions for coding agents working in this project.
Follow these defaults unless the user explicitly requests otherwise.

## 1) Project Summary
- Stack: FastAPI (Python) + React/Vite (TypeScript)
- Python source root: `src/drawing_pipe/`
- Backend runtime entrypoint: `backend/main.py`
- Frontend app root: `frontend/`
- Package managers: `uv` (python), `bun` (frontend)

## 2) Cursor / Copilot Rule Files
Checked paths:
- `.cursor/rules/` -> not present
- `.cursorrules` -> not present
- `.github/copilot-instructions.md` -> not present
If these files are added later, treat them as higher-priority instructions.

## 3) Architecture Snapshot
Backend:
- `src/drawing_pipe/api/app.py` - app wiring (middleware + routers)
- `src/drawing_pipe/api/routers/` - route handlers (`health`, `templates`, `analyze`)
- `src/drawing_pipe/api/services/` - API orchestration logic
- `src/drawing_pipe/api/domain.py` - payload/domain conversion
- `src/drawing_pipe/templates/data/*.json` - template data (one template per file)
- `src/drawing_pipe/core/` - geometry/process domain logic
Frontend:
- `frontend/src/app/` - app shell and styles
- `frontend/src/features/` - feature modules
- `frontend/src/shared/` - shared API/types/i18n/lib

## 4) Quick Start
```bash
# Sync Python deps
uv sync

# Run backend
uv run uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload

# Run frontend
cd frontend && bun install && bun run dev
```

## 5) Build / Lint / Validation Commands
### Python / Backend
```bash
# Lint
ruff check .

# Optional autofix
ruff check --fix .

# Format
ruff format .

# Syntax compile sanity
uv run python -m py_compile backend/main.py src/drawing_pipe/api/app.py src/drawing_pipe/api/domain.py
```
### Frontend
```bash
# Install deps
cd frontend && bun install

# Dev server
cd frontend && bun run dev

# Typecheck + production build
cd frontend && bun run build

# Preview build
cd frontend && bun run preview
```

## 6) Tests (including single-test examples)
Current state: no committed `tests/` directory yet.
When Python tests are added:
```bash
# Run all tests
uv run pytest -q

# Single file
uv run pytest tests/test_process.py -q

# Single test function
uv run pytest tests/test_process.py::test_area_reduction -q

# Filter by expression
uv run pytest tests/test_process.py -k "circle and reduction" -q
```
If frontend tests are added later:
```bash
cd frontend && bun run test
cd frontend && bun run test -- path/to/file.test.ts
cd frontend && bun run test -- -t "name fragment"
```

## 7) Python Code Style
- Use explicit type hints for public functions and return values
- Keep core geometry/process logic deterministic and side-effect free
- Keep validation at schema boundaries (Pydantic)
- Prefer absolute imports under `drawing_pipe.*`
- Import order: stdlib -> third-party -> local
- Avoid broad exception swallowing; re-raise with context when needed
- Keep route handlers thin; business logic belongs in services/core

## 8) TypeScript / React Code Style
- Keep strict typing; avoid `any` unless unavoidable
- Use discriminated unions for shape variants
- Keep components focused; extract reusable hook/helper logic
- Avoid in-place state mutation
- Prefer explicit callback prop names (`onXChange`, `onHoverIndexChange`, etc.)
- Keep drag/hover code deterministic and race-safe

## 9) Naming / Formatting
- Keep domain names consistent: `origin`, `diameter`, `length`, `width`, `v1/v2/v3`
- Use i18n keys for user-visible labels (`frontend/src/shared/i18n/i18n.ts`)
- TS naming: `camelCase` vars/functions, `PascalCase` components/types
- Python formatting and naming follow ruff/PEP8 defaults

## 10) Error Handling Expectations
- Frontend must surface actionable API errors in UI
- Interactive API flows should support cancellation and latest-wins behavior
- Backend should return clear errors for invalid payloads/files
- Never silently ignore parse/validation failures

## 11) Performance / Interaction Rules
- Preserve marker lock semantics and axis-constrained drag behavior unless requested
- Preserve snap-step geometry behavior unless requested
- Keep metrics analysis request flow optimized for drag interactions
- Keep transition fullscreen modal fully interactive

## 12) Template Data Rules
- One template per JSON file in `src/drawing_pipe/templates/data/`
- Validate templates through API schema models
- Ensure template names are unique at load time
- Keep payload compatible with `PipePayload`

## 13) Environment / Generated Files
- Do not commit generated frontend output (`frontend/dist/`)
- Do not commit local `.envrc`; use `.envrc.example`
- `src/*.egg-info/` is generated metadata and should remain ignored

## 14) Commit Guidelines
- Commit format: `type(scope): subject`
- Use imperative concise subject with no trailing period
- Common types: `feat`, `fix`, `perf`, `refactor`, `style`, `docs`, `test`, `chore`
- Keep commits atomic and logically grouped

## 15) Agent Workflow Checklist
1. Read relevant files before editing
2. Make minimal coherent changes
3. Run relevant checks before finishing
4. Ensure staged files exclude generated artifacts
5. Summarize changed files + validation commands in final response
