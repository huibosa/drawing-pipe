# Drawing Pipe Process Explorer

An interactive geometric library and web app for calculating pipe properties (area, eccentricity, vertex distances, thickness) through a manufacturing process.

## Features

- **Shape Support**: Circle, Rect, Ellipse, and CubicSpline shapes
- **Process Analysis**: Calculate area reductions, eccentricity differences, and thickness reductions between consecutive pipes
- **Interactive Visualization**: View transitions between pipe shapes with real-time metrics
- **Template System**: Pre-built process templates (e.g., PROCESS, FINISH_3, FINISH_6, FINISH_8)
- **Live Editing**: Modify pipe parameters with debounced auto-apply

## Screenshots

![Drawing Pipe Process Explorer](images/screenshot.png)

## Installation

```bash
# Sync dependencies
uv sync
```

## Usage

Run backend:

```bash
ALLOWED_ORIGINS="http://localhost:5173,http://127.0.0.1:5173" uv run uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
```

Run frontend:

```bash
cd frontend
bun install
# Optional for remote access; defaults to current hostname:8000
# export VITE_API_BASE_URL="http://<server-ip>:8000"
bun run dev
```

## Fullstack App

The app uses a FastAPI backend and React frontend for interactive drag-to-edit.

- Backend entrypoint: `backend/main.py`
- Frontend app: `frontend/`

Run backend:

```bash
uv run uvicorn backend.main:app --reload
```

Run frontend:

```bash
cd frontend
bun install
bun run dev
```

## Project Structure

```
drawing_pipe/
├── backend/             # FastAPI backend
├── frontend/            # React frontend
├── src/drawing_pipe/
│   ├── api/             # FastAPI app/domain/schemas
│   └── core/            # Shape, pipe, process domain models
└── images/              # Screenshots and assets
```

## Pipe Types

| Type | Outer Shape | Inner Shape | Description |
|------|-------------|-------------|-------------|
| `CircleCircle` | Circle | Circle | Circular pipe cross-section |
| `RectRect` | Rect | Rect | Rectangular pipe with filleted corners |
| `SplineSpline` | CubicSpline | CubicSpline | Complex spline-based profile |

## API Reference

### Shapes (`src/drawing_pipe/core/shapes.py`)

- `Circle`: Defined by `origin` (x, y) and `diameter`
- `Rect`: Defined by `origin`, `length`, `width`, and `fillet_radius`
- `CubicSplineShape`: Defined by `origin` and control points `v1`, `v2`, `v3`

### Pipes (`src/drawing_pipe/core/pipes.py`)

All pipe types support:
- `area`: Cross-sectional area (outer - inner)
- `eccentricity`: Distance between outer and inner origins
- `thickness`: Array of 5 thickness values at key vertices

### Process Analysis (`src/drawing_pipe/core/process.py`)

`ProcessAnalysis` provides:
- `area_reductions`: Percentage area reduction between consecutive pipes
- `eccentricity_diffs`: Change in eccentricity between consecutive pipes
- `thickness_reductions`: Thickness reduction ratios between consecutive pipes

## License

MIT
