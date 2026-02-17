You are a senior full-stack engineer. Build a production-quality web app called "Drawing Pipe Process Explorer".

Tech stack (must use):
- Backend: FastAPI + Pydantic (Python)
- Frontend: React + Vite + TypeScript
- Package managers: uv (python), bun (frontend)

Goal:
Create an interactive pipe-process editor and analyzer with:
1) editable pipe geometry
2) transition visualization between consecutive pipes
3) live metrics charts linked to hover/drag interactions

==================================================
CORE DOMAIN MODEL
==================================================
Shapes:
- Circle: { origin: [x,y], diameter }
- Rect: { origin: [x,y], length, width, fillet_radius }
- CubicSplineShape: { origin: [x,y], v1, v2, v3 } with mirrored symmetric control behavior

Pipe:
- pipe_type: CircleCircle | RectRect | SplineSpline
- outer shape + inner shape

Profile:
- version: 1
- pipes: list of Pipe

Metrics returned by backend:
- area_reductions: list[float]
- eccentricity_diffs: list[float]
- thickness_reductions: list[list[float]]

==================================================
BACKEND REQUIREMENTS
==================================================
Create endpoints:
- GET /health
- GET /api/templates
- POST /api/analyze

Templates:
- Store templates as JSON files, one template per file under:
  src/drawing_pipe/templates/data/*.json
- Use a repository loader to read and validate JSON templates.
- Return templates as dict[str, list[PipePayload]].

CORS:
- ALLOWED_ORIGINS env var (comma-separated), fallback to localhost origins.

Structure:
- backend/main.py as thin entrypoint
- src/drawing_pipe/api/{app.py,domain.py,schemas.py,template_repository.py}
- src/drawing_pipe/core/* for geometry/process logic

==================================================
FRONTEND LAYOUT REQUIREMENTS
==================================================
Layout:
- Left sidebar: metrics charts + controls
- Main area:
  - top: transition cards row (horizontal scroll)
  - bottom: pipe settings cards row (horizontal scroll)
- Main area must NOT scroll vertically.
- Pipe settings section should have internal vertical scroll.
- Sidebar should remain usable independently.

Transitions:
- Transition i visualizes pipe i -> pipe i+1.
- Show interactive plot with markers.

Pipe settings:
- One card per pipe.
- Each pipe has shape editors for Outer and Inner.
- Number inputs for center, diameter/length/width/fillet/v1/v2/v3.

==================================================
INTERACTION BEHAVIOR (IMPORTANT)
==================================================
Hover linking:
- Hover metric point at transition i -> highlight transition card i.
- Hover pipe card i -> highlight transition i-1 and i where applicable.
- Hover transition card i -> highlight pipe cards i and i+1.
- Hover thickness series point p_k at transition i -> highlight marker index k-1 on both sides of transition i.
- Hover input (x/y) for a point -> enlarge corresponding transition marker(s).

Marker behavior:
- Markers draggable with constraints.
- Per-axis lock support: if X locked and Y unlocked, marker can still drag along Y only.
- Center drag must respect inner and outer lock axes independently.
- Proximity hover: nearest draggable marker within small threshold enlarges.
- Cursor over marker should remain default (not hand).

Locks:
- Per-input lock button for each numeric field (x and y separate where applicable).
- Bulk lock buttons for Outer, Inner, and whole Pipe.
- Default locked fields (re-applied on template load/type change/add/delete):
  - inner center x and y
  - outer center x
  - spline outer v1.x and inner v1.x

Fullscreen:
- Each transition card has a fullscreen button.
- Open as dark overlay modal over main area only (sidebar should not darken).
- Full interactivity must remain in fullscreen.
- Support close by button, backdrop click, and Esc.

==================================================
METRICS CHARTS
==================================================
Charts in sidebar:
1) Combined dual-axis chart:
   - Area Reduction + Eccentricity on one plot
   - Left Y axis: area reduction (%)
   - Right Y axis: eccentricity (mm)
2) Thickness chart with p1..pn lines

Hover details:
- Marker point enlarges on hover.
- Use nearest-point hover detection (SVG-level), not overlapping per-point hit circles.
- Tooltip should show value only for hovered series point:
  - area example: 12.5%
  - ecc example: 0.9mm
- For dense points, should not skip middle point selection.

==================================================
PERFORMANCE REQUIREMENTS
==================================================
- Debounce analyze requests during editing/drag (about 150-200ms).
- Abort stale in-flight requests.
- Latest response wins (ignore out-of-order responses).
- Trigger immediate analyze on drag end.
- Show "Analyzing..." status without layout shift (reserve space; toggle visibility/opacity).

==================================================
STYLING REQUIREMENTS
==================================================
- Clean, compact professional UI.
- Strong blue outline highlight for hovered/linked cards:
  - visible border + outer ring/halo
- Keep card spacing compact vertically.
- Keep typography readable and hierarchy clear.

==================================================
DELIVERABLE FORMAT
==================================================
Output:
1) File tree
2) Full code for all key files
3) Run instructions
4) Validation commands:
   - ruff check .
   - uv run python -m py_compile ...
   - cd frontend && bun run build
5) Brief architecture notes and why decisions were made

Do not provide pseudo-code. Provide runnable code.
