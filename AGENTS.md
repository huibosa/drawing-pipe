# AGENTS.md - Drawing Pipe Project Guidelines

## NOTE:
- Do NOT create `.venv` or install packages via `pip` to the current folder
- Do NOT Add x and y axis label to any matplotlib axes

## Project Overview
Geometric library for calculating pipe properties (area, eccentricity, vertex distances, thickness) using shapes (Circle, Rect, Square, Ellipse, CubicSpline).

## Environment & Tools
- **Python**: 3.10+
- **Package Manager**: `uv` (preferred over pip)
- **Linter/Formatter**: `ruff`
- **Dependencies**: `numpy`, `scipy`

## Lint, and Test Commands

### Run Linting
```bash
ruff check .
ruff check --fix .  # Auto-fix issues
```

### Run Formatting
```bash
ruff format .
```

### Execute Code
```bash
uv run python main.py
```

### Run a Single Test (if using pytest)
```bash
pytest tests/test_file.py::TestClass::test_method -v
```

### Run All Tests
```bash
pytest tests/ -v
```

## Code Style Guidelines

### Immutability
- Use `@dataclass(frozen=True)` for all data models (shapes, pipes)
- Avoid mutable state; use dataclasses for type safety and hashability

### Abstract Base Classes
- Use `ABC` for base shape hierarchy
- Mark properties/methods as `@abstractmethod`
- Example in `shapes.py`:
  ```python
  class Shape(ABC):
      origin: tuple[float, float]

      @property
      @abstractmethod
      def area(self) -> float: ...
  ```

### Type Hints
- Required for all function signatures
- Use `tuple[float, float]` for coordinates, not `Tuple[float, float]`
- Return types must be specified (e.g., `-> np.ndarray`)

### Coordinate Naming Conventions
- `ox, oy`: outer origin x/y
- `ix, iy`: inner origin x/y
- `l_o, w_o`: outer length/width
- `s_i`: inner side_length
- `r_o, r_i`: outer/inner fillet_radius

### Vertex Conventions
- Shapes follow 5-vertex symmetry: Top(0), Top-Right(1), Right(2), Bottom-Right(3), Bottom(4)
- CubicSplineShape vertices are relative to origin; add origin offset when computing
- Index 0 (Top) and 4 (Bottom) are on y-axis; Index 2 (Right) is on x-axis

### Import Style
- Standard library first, then third-party (`numpy`, `scipy`)
- Relative imports for intra-package imports
- Example:
  ```python
  from dataclasses import dataclass, field
  import numpy as np
  from scipy.interpolate import CubicSpline
  from shapes import Circle, Rect
  ```

### Error Handling
- Raise `NotImplementedError` for missing implementations (e.g., vertex generators)
- Avoid silent failures; validate inputs where reasonable

## Git Commit Format
- **Format**: `type(scope): subject` (e.g., `feat(pipes):`, `fix(core):`, `chore:`)
- **Subject**: Max 50 chars, imperative mood, no trailing period
- **Examples**:
  ```
  feat(pipes): add thickness property with axial distance calculation
  fix(shapes): correct spline vertex calculation
  chore(visualization): remove duplicate entrypoint
  ```
