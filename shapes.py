from abc import ABC, abstractmethod
from dataclasses import dataclass, field

import numpy as np


class Shape(ABC):
    """Abstract base class for geometric shapes."""

    origin: tuple[float, float]

    @property
    @abstractmethod
    def area(self) -> float:
        """Calculate the area of the shape."""
        ...


@dataclass(frozen=True)
class Circle(Shape):
    """Circle shape defined by origin and diameter."""

    origin: tuple[float, float]
    diameter: float

    @property
    def area(self) -> float:
        return (self.diameter / 2) ** 2 * np.pi


@dataclass(frozen=True)
class Square(Shape):
    """Square shape with optional corner fillets."""

    origin: tuple[float, float]
    side_length: float
    fillet_radius: float = field(default=2.5)

    @property
    def area(self) -> float:
        r = self.fillet_radius
        base_area = self.side_length**2
        corner_correction = (4 * r**2) - (np.pi * r**2)
        return base_area - corner_correction


@dataclass(frozen=True)
class Rect(Shape):
    """Rectangle shape with optional corner fillets."""

    origin: tuple[float, float]
    length: float
    width: float
    fillet_radius: float = field(default=2.5)

    @property
    def area(self) -> float:
        r = self.fillet_radius
        base_area = self.length * self.width
        corner_correction = (4 * r**2) - (np.pi * r**2)
        return base_area - corner_correction
