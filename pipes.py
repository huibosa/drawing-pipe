from dataclasses import dataclass

import numpy as np

from shapes import Circle, Ellipse, Rect, Shape, Square


@dataclass(frozen=True)
class Pipe:
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
    def __init__(self, outer: Circle, inner: Circle) -> None:
        super().__init__(outer, inner)


class CircleSquare(Pipe):
    def __init__(self, outer: Circle, inner: Square) -> None:
        super().__init__(outer, inner)


class RectSquare(Pipe):
    def __init__(self, outer: Rect, inner: Square) -> None:
        super().__init__(outer, inner)


class EllipseSquare(Pipe):
    def __init__(self, outer: Ellipse, inner: Square) -> None:
        super().__init__(outer, inner)
