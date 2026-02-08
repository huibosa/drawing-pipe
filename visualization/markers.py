from __future__ import annotations

from pipes import CircleCircle, Pipe, RectRect, SplineSpline

import numpy as np

from shapes import Circle, Rect
from visualization import constants
from visualization.point_generators import get_circle_points, get_rect_points


def plot_pipe_markers(ax, pipe: Pipe) -> None:
    """Plot marker dots for SplineSpline, CircleCircle, and RectRect pipes."""
    if isinstance(pipe, SplineSpline):
        outer_verts = np.array(pipe.outer.vertices[:5])
        inner_verts = np.array(pipe.inner.vertices[:5])
        ax.scatter(
            outer_verts[:, 0],
            outer_verts[:, 1],
            c=constants.OUTER_MARKER_COLOR,
            s=constants.MARKER_SIZE,
            marker=constants.MARKER_STYLE,
            zorder=constants.MARKER_ZORDER,
            label="_nolegend_",
        )
        ax.scatter(
            inner_verts[:, 0],
            inner_verts[:, 1],
            c=constants.INNER_MARKER_COLOR,
            s=constants.MARKER_SIZE,
            marker=constants.MARKER_STYLE,
            zorder=constants.MARKER_ZORDER,
            label="_nolegend_",
        )

    if isinstance(pipe, CircleCircle):
        if isinstance(pipe.outer, Circle) and isinstance(pipe.inner, Circle):
            outer_x, outer_y = get_circle_points(pipe.outer)
            inner_x, inner_y = get_circle_points(pipe.inner)
            ax.scatter(
                outer_x,
                outer_y,
                c=constants.OUTER_MARKER_COLOR,
                s=constants.MARKER_SIZE,
                marker=constants.MARKER_STYLE,
                zorder=constants.MARKER_ZORDER,
                label="_nolegend_",
            )
            ax.scatter(
                inner_x,
                inner_y,
                c=constants.INNER_MARKER_COLOR,
                s=constants.MARKER_SIZE,
                marker=constants.MARKER_STYLE,
                zorder=constants.MARKER_ZORDER,
                label="_nolegend_",
            )

    if isinstance(pipe, RectRect):
        if isinstance(pipe.outer, Rect) and isinstance(pipe.inner, Rect):
            outer_x, outer_y = get_rect_points(pipe.outer)
            inner_x, inner_y = get_rect_points(pipe.inner)
            ax.scatter(
                outer_x,
                outer_y,
                c=constants.OUTER_MARKER_COLOR,
                s=constants.MARKER_SIZE,
                marker=constants.MARKER_STYLE,
                zorder=constants.MARKER_ZORDER,
                label="_nolegend_",
            )
            ax.scatter(
                inner_x,
                inner_y,
                c=constants.INNER_MARKER_COLOR,
                s=constants.MARKER_SIZE,
                marker=constants.MARKER_STYLE,
                zorder=constants.MARKER_ZORDER,
                label="_nolegend_",
            )
