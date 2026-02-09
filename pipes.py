import numpy as np
from pydantic import BaseModel, ConfigDict

from shapes import Circle, CubicSplineShape, Ellipse, Rect


class Pipe(BaseModel):
    model_config = ConfigDict(
        frozen=True,
        arbitrary_types_allowed=True,
    )
    outer: Circle | Rect | Ellipse | CubicSplineShape
    inner: Circle | Rect | Ellipse | CubicSplineShape

    @property
    def area(self) -> float:
        return self.outer.area - self.inner.area

    @property
    def eccentricity(self) -> float:
        origin1 = np.array(self.outer.origin)
        origin2 = np.array(self.inner.origin)
        return float(np.linalg.norm(origin1 - origin2))


class CircleCircle(Pipe):
    model_config = ConfigDict(
        frozen=True,
        strict=True,
        extra="forbid",
    )

    @property
    def thickness(self) -> np.ndarray:
        thickness = (self.outer.diameter - self.inner.diameter) / 2.0

        return np.array((thickness,) * 5)


class CircleRect(Pipe):
    model_config = ConfigDict(
        frozen=True,
        strict=True,
        extra="forbid",
    )


class EllipseRect(Pipe):
    model_config = ConfigDict(
        frozen=True,
        strict=True,
        extra="forbid",
    )


class RectRect(Pipe):
    model_config = ConfigDict(
        frozen=True,
        strict=True,
        extra="forbid",
    )

    @property
    def thickness(self) -> np.ndarray:
        ox_o, oy_o = self.outer.origin
        r_o = self.outer.fillet_radius
        l_o, w_o = self.outer.length, self.outer.width

        ox_i, oy_i = self.inner.origin
        r_i = self.inner.fillet_radius
        l_i, w_i = self.inner.length, self.inner.width

        outer_pts = [
            (ox_o, oy_o + l_o / 2),
            (ox_o - w_o / 2 + r_o, oy_o + l_o / 2 - r_o),
            (ox_o - w_o / 2, oy_o),
            (ox_o - w_o / 2 + r_o, oy_o - l_o / 2 + r_o),
            (ox_o, oy_o - l_o / 2),
        ]

        inner_pts = [
            (ox_i, oy_i + l_i / 2),
            (ox_i - w_i / 2 + r_i, oy_i + l_i / 2 - r_i),
            (ox_i - w_i / 2, oy_i),
            (ox_i - w_i / 2 + r_i, oy_i - l_i / 2 + r_i),
            (ox_i, oy_i - l_i / 2),
        ]

        distances = []
        for i, (o, iv) in enumerate(zip(outer_pts, inner_pts)):
            ox, oy = o
            ix, iy = iv
            if i == 0 or i == 4:
                distances.append(abs(oy - iy))
            elif i == 2:
                distances.append(abs(ox - ix))
            else:
                distances.append(float(np.linalg.norm(np.array(o) - np.array(iv))))

        return np.array(distances)


class SplineSpline(Pipe):
    model_config = ConfigDict(
        frozen=True,
        strict=True,
        extra="forbid",
    )

    @property
    def thickness(self) -> np.ndarray:
        outer_verts = self.outer.vertices[:5]
        inner_verts = self.inner.vertices[:5]
        distances = []
        for i, (ov, iv) in enumerate(zip(outer_verts, inner_verts)):
            ox, oy = ov
            ix, iy = iv
            if i == 0 or i == 4:
                distances.append(abs(oy - iy))
            elif i == 2:
                distances.append(abs(ox - ix))
            else:
                distances.append(float(np.linalg.norm(np.array(ov) - np.array(iv))))
        return np.array(distances)
