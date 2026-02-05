from dataclasses import dataclass

import numpy as np

from shapes import Circle, CubicSplineShape, Ellipse, Rect, Shape, Square


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

    @property
    def vertex_distances(self) -> np.ndarray:
        thickness = (self.outer.diameter - self.inner.diameter) / 2.0

        return np.array((thickness,) * 5)


class CircleSquare(Pipe):
    def __init__(self, outer: Circle, inner: Square) -> None:
        super().__init__(outer, inner)


class RectSquare(Pipe):
    def __init__(self, outer: Rect, inner: Square) -> None:
        super().__init__(outer, inner)

    @property
    def vertex_distances(self) -> np.ndarray:
        ox_o, oy_o = self.outer.origin
        r_o = self.outer.fillet_radius
        l_o, w_o = self.outer.length, self.outer.width

        ox_i, oy_i = self.inner.origin
        r_i = self.inner.fillet_radius
        s_i = self.inner.side_length

        outer_pts = [
            (ox_o, oy_o + l_o / 2),
            (ox_o - w_o / 2 + r_o, oy_o + l_o / 2 - r_o),
            (ox_o - w_o / 2, oy_o),
            (ox_o - w_o / 2 + r_o, oy_o - l_o / 2 + r_o),
            (ox_o, oy_o - l_o / 2),
        ]

        inner_pts = [
            (ox_i, oy_i + s_i / 2),
            (ox_i - s_i / 2 + r_i, oy_i + s_i / 2 - r_i),
            (ox_i - s_i / 2, oy_i),
            (ox_i - s_i / 2 + r_i, oy_i - s_i / 2 + r_i),
            (ox_i, oy_i - s_i / 2),
        ]

        return np.array(
            [
                float(np.linalg.norm(np.array(o) - np.array(i)))
                for o, i in zip(outer_pts, inner_pts)
            ]
        )


class EllipseSquare(Pipe):
    def __init__(self, outer: Ellipse, inner: Square) -> None:
        super().__init__(outer, inner)


class SplineSpline(Pipe):
    def __init__(self, outer: CubicSplineShape, inner: CubicSplineShape) -> None:
        super().__init__(outer, inner)

    @property
    def vertex_distances(self) -> np.ndarray:
        outer_verts = self.outer.vertices[:5]
        inner_verts = self.inner.vertices[:5]
        return np.array(
            [
                float(np.linalg.norm(np.array(ov) - np.array(iv)))
                for ov, iv in zip(outer_verts, inner_verts)
            ]
        )
