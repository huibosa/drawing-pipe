from __future__ import annotations

import numpy as np

from shapes import Circle, Rect


def get_circle_points(circle: Circle) -> tuple[np.ndarray, np.ndarray]:
    """Get 5 points on circle at angles: 90°, 45°, 0°, -45°, -90°."""
    ox, oy = circle.origin
    radius = circle.diameter / 2
    angles = np.array([90, 45, 0, -45, -90]) * np.pi / 180
    x_coords = ox + radius * np.cos(angles)
    y_coords = oy + radius * np.sin(angles)
    return x_coords, y_coords


def get_rect_points(shape: Rect) -> tuple[np.ndarray, np.ndarray]:
    """Get 5 key points: top-center, top-right-fillet-arc-center, right-center, bottom-right-fillet-arc-center, bottom-center."""
    ox, oy = shape.origin
    length = shape.length
    width = shape.width
    r = shape.fillet_radius
    arc_offset = r / np.sqrt(2)
    x_coords = np.array(
        [
            ox,
            ox + width / 2 - r + arc_offset,
            ox + width / 2,
            ox + width / 2 - r + arc_offset,
            ox,
        ]
    )
    y_coords = np.array(
        [
            oy + length / 2,
            oy + length / 2 - r + arc_offset,
            oy,
            oy - length / 2 + r - arc_offset,
            oy - length / 2,
        ]
    )
    return x_coords, y_coords
