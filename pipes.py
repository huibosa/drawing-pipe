from dataclasses import dataclass

import numpy as np

from shapes import Circle, Ellipse, Rect, Shape, Square


@dataclass(frozen=True)
class Pipe:
    """Base class for pipe geometries (outer shape with inner hole)."""

    outer: Shape
    inner: Shape

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


class EllipseSquare(Pipe):
    """Pipe with elliptical outer and square inner."""

    def __init__(self, outer: Ellipse, inner: Square) -> None:
        super().__init__(outer, inner)
