from __future__ import annotations

import numpy as np
from pydantic import BaseModel, ConfigDict, Field
from scipy.interpolate import CubicSpline


class Shape(BaseModel):
    model_config = ConfigDict(
        frozen=True,
        arbitrary_types_allowed=True,
    )
    origin: tuple[float, float]


class Circle(BaseModel):
    model_config = ConfigDict(
        frozen=True,
        strict=True,
        extra="forbid",
    )
    origin: tuple[float, float]
    diameter: float

    @property
    def area(self) -> float:
        return (self.diameter / 2) ** 2 * np.pi


class Rect(BaseModel):
    model_config = ConfigDict(
        frozen=True,
        strict=True,
        extra="forbid",
    )
    origin: tuple[float, float]
    length: float
    width: float
    fillet_radius: float = Field(default=2.5)

    @property
    def area(self) -> float:
        r = self.fillet_radius
        base_area = self.length * self.width
        corner_correction = (4 * r**2) - (np.pi * r**2)
        return base_area - corner_correction


class Ellipse(BaseModel):
    model_config = ConfigDict(
        frozen=True,
        strict=True,
        extra="forbid",
    )
    origin: tuple[float, float]
    major_axis: float
    minor_axis: float

    @property
    def area(self) -> float:
        return np.pi * self.major_axis * self.minor_axis / 4


class CubicSplineShape(BaseModel):
    model_config = ConfigDict(
        frozen=True,
        strict=True,
        extra="forbid",
    )
    """Shape defined by cubic spline, symmetric about X and Y axes."""

    origin: tuple[float, float]
    v1: tuple[float, float]
    v2: tuple[float, float]
    v3: tuple[float, float]

    @property
    def vertices(
        self,
    ) -> tuple[
        tuple[float, float],
        tuple[float, float],
        tuple[float, float],
        tuple[float, float],
        tuple[float, float],
        tuple[float, float],
        tuple[float, float],
        tuple[float, float],
    ]:
        ox, oy = self.origin
        return (
            (self.v1[0] + ox, self.v1[1] + oy),
            (self.v2[0] + ox, self.v2[1] + oy),
            (self.v3[0] + ox, self.v3[1] + oy),
            (self.v2[0] + ox, -self.v2[1] + oy),
            (ox, -self.v1[1] + oy),
            (-self.v2[0] + ox, -self.v2[1] + oy),
            (-self.v3[0] + ox, oy),
            (-self.v2[0] + ox, self.v2[1] + oy),
        )

    @property
    def area(self) -> float:
        x_fine, y_fine = self.get_spline_points(1000)
        area = 0.5 * np.abs(np.sum(x_fine[:-1] * y_fine[1:] - x_fine[1:] * y_fine[:-1]))
        return float(area)

    def get_spline_points(self, num_points: int = 100) -> tuple[np.ndarray, np.ndarray]:
        verts = self.vertices
        n = len(verts)

        t = np.arange(n + 1)
        x = np.array([v[0] for v in verts] + [verts[0][0]])
        y = np.array([v[1] for v in verts] + [verts[0][1]])

        cs_x = CubicSpline(t, x, bc_type="periodic")
        cs_y = CubicSpline(t, y, bc_type="periodic")

        t_fine = np.linspace(0, n, num_points)
        return cs_x(t_fine), cs_y(t_fine)
