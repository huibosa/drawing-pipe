from abc import ABC, abstractmethod
from dataclasses import dataclass, field

import numpy as np


class Shape(ABC):
    origin: tuple[float, float]

    @property
    @abstractmethod
    def area(self) -> float: ...


@dataclass(frozen=True)
class Circle(Shape):
    origin: tuple[float, float]
    diameter: float

    @property
    def area(self) -> float:
        return (self.diameter / 2) ** 2 * np.pi


@dataclass(frozen=True)
class Square(Shape):
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


@dataclass(frozen=True)
class Ellipse(Shape):
    origin: tuple[float, float]
    major_axis: float
    minor_axis: float

    @property
    def area(self) -> float:
        return np.pi * self.major_axis * self.minor_axis / 4
