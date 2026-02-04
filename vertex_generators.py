"""Vertex generation for geometric shapes."""

from typing import Any, Callable, Type

import numpy as np

from shapes import Circle, CubicSplineShape, Ellipse, Rect, Shape, Square

_vertex_generators: dict[Type, Callable[[Any], np.ndarray]] = {}


def register_vertices(shape_class: Type):
    """Decorator to register a vertex generator for a shape class."""

    def decorator(func: Callable[[Any], np.ndarray]):
        _vertex_generators[shape_class] = func
        return func

    return decorator


def get_vertices(shape: Shape, clockwise: bool = False) -> np.ndarray:
    """Get vertices for any registered shape type."""
    shape_type = type(shape)

    if shape_type not in _vertex_generators:
        raise NotImplementedError(
            f"No vertex generator registered for {shape_type.__name__}"
        )

    generator = _vertex_generators[shape_type]
    verts = generator(shape)

    if clockwise:
        verts = verts[::-1]
    return verts


def generate_rounded_rect_verts(
    center: tuple[float, float], width: float, height: float, radius: float
) -> np.ndarray:
    """Generate vertices for a rounded rectangle."""
    cx, cy = center
    hw, hh = width / 2, height / 2
    max_r = min(hw, hh)
    r = min(radius, max_r)
    arc_points = 15
    theta = np.linspace(0, np.pi / 2, arc_points)
    tr_x = (cx + hw - r) + r * np.cos(theta)
    tr_y = (cy + hh - r) + r * np.sin(theta)
    tl_x = (cx - hw + r) + r * np.cos(theta + np.pi / 2)
    tl_y = (cy + hh - r) + r * np.sin(theta + np.pi / 2)
    bl_x = (cx - hw + r) + r * np.cos(theta + np.pi)
    bl_y = (cy - hh + r) + r * np.sin(theta + np.pi)
    br_x = (cx + hw - r) + r * np.cos(theta + 3 * np.pi / 2)
    br_y = (cy - hh + r) + r * np.sin(theta + 3 * np.pi / 2)
    x = np.concatenate([tr_x, tl_x, bl_x, br_x])
    y = np.concatenate([tr_y, tl_y, bl_y, br_y])
    return np.column_stack([x, y])


@register_vertices(Circle)
def _circle_vertices(shape: Circle) -> np.ndarray:
    """Generate vertices for a circle."""
    cx, cy = shape.origin
    theta = np.linspace(0, 2 * np.pi, 100)
    radius = shape.diameter / 2
    x = cx + radius * np.cos(theta)
    y = cy + radius * np.sin(theta)
    return np.column_stack([x, y])


@register_vertices(Square)
def _square_vertices(shape: Square) -> np.ndarray:
    """Generate vertices for a square with optional corner fillets."""
    return generate_rounded_rect_verts(
        shape.origin, shape.side_length, shape.side_length, shape.fillet_radius
    )


@register_vertices(Rect)
def _rect_vertices(shape: Rect) -> np.ndarray:
    """Generate vertices for a rectangle with optional corner fillets."""
    return generate_rounded_rect_verts(
        shape.origin, shape.width, shape.length, shape.fillet_radius
    )


@register_vertices(Ellipse)
def _ellipse_vertices(shape: Ellipse) -> np.ndarray:
    """Generate vertices for an ellipse."""
    cx, cy = shape.origin
    theta = np.linspace(0, 2 * np.pi, 100)
    a = shape.minor_axis / 2
    b = shape.major_axis / 2
    x = cx + a * np.cos(theta)
    y = cy + b * np.sin(theta)
    return np.column_stack([x, y])


@register_vertices(CubicSplineShape)
def _cubic_spline_vertices(shape: CubicSplineShape) -> np.ndarray:
    """Generate vertices for a cubic spline shape."""
    x_fine, y_fine = shape.get_spline_points(100)
    return np.column_stack([x_fine, y_fine])
