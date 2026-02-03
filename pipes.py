from typing import Tuple

import numpy as np

from shapes import Circle, Rect, Shape, Square


class Pipe:
    """Base class for pipe geometries (outer shape with inner hole)."""

    def __init__(self, outer: Shape, inner: Shape) -> None:
        self.outer = outer
        self.inner = inner

    @property
    def area(self) -> float:
        return self.outer.area - self.inner.area

    @property
    def eccentricity(self) -> float:
        origin1 = np.array(self.outer.origin)
        origin2 = np.array(self.inner.origin)
        return float(np.linalg.norm(origin1 - origin2))


class CircleCircle(Pipe):
    """Pipe with circular outer and circular inner."""

    def __init__(self, outer: Circle, inner: Circle) -> None:
        super().__init__(outer, inner)


class CircleSquare(Pipe):
    """Pipe with circular outer and square inner."""

    def __init__(self, outer: Circle, inner: Square) -> None:
        super().__init__(outer, inner)


class RectSquare(Pipe):
    """Pipe with rectangular outer and square inner."""

    def __init__(self, outer: Rect, inner: Square) -> None:
        super().__init__(outer, inner)
