from typing import Tuple

import numpy as np


class Shape:
    """Abstract base class for geometric shapes."""

    origin: Tuple[float, float]

    @property
    def area(self) -> float:
        """Calculate the area of the shape."""
        raise NotImplementedError


class Circle(Shape):
    """Circle shape defined by origin and diameter."""

    def __init__(self, origin: Tuple[float, float], diameter: float) -> None:
        self.origin = origin
        self.diameter = diameter

    @property
    def area(self) -> float:
        return (self.diameter / 2) ** 2 * np.pi


class Square(Shape):
    """Square shape with optional corner fillets."""

    def __init__(
        self,
        origin: Tuple[float, float],
        side_length: float,
        fillet_radius: float = 2.5,
    ) -> None:
        self.origin = origin
        self.side_length = side_length
        self.fillet_radius = fillet_radius

    @property
    def area(self) -> float:
        r = self.fillet_radius
        base_area = self.side_length**2
        corner_correction = (4 * r**2) - (np.pi * r**2)
        return base_area - corner_correction


class Rect(Shape):
    """Rectangle shape with optional corner fillets."""

    def __init__(
        self,
        origin: Tuple[float, float],
        length: float,
        width: float,
        fillet_radius: float = 2.5,
    ) -> None:
        self.origin = origin
        self.length = length
        self.width = width
        self.fillet_radius = fillet_radius

    @property
    def area(self) -> float:
        r = self.fillet_radius
        base_area = self.length * self.width
        corner_correction = (4 * r**2) - (np.pi * r**2)
        return base_area - corner_correction
