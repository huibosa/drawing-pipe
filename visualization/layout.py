from __future__ import annotations

import numpy as np

from pipes import Pipe
from vertex_generators import get_vertices
from visualization import constants


def get_common_limits(pipes: list[Pipe], padding: float | None = None) -> tuple:
    """Calculate common x/y limits for all pipes to ensure uniform aspect ratio."""
    if padding is None:
        padding = constants.DEFAULT_PADDING
    all_verts = []
    for pipe in pipes:
        all_verts.append(get_vertices(pipe.outer))
        all_verts.append(get_vertices(pipe.inner))

    all_verts = np.vstack(all_verts)
    xmin, xmax = all_verts[:, 0].min(), all_verts[:, 0].max()
    ymin, ymax = all_verts[:, 1].min(), all_verts[:, 1].max()

    width = xmax - xmin
    height = ymax - ymin
    max_dim = max(width, height)

    cx = (xmin + xmax) / 2
    cy = (ymin + ymax) / 2

    padding_abs = max_dim * padding
    return (
        cx - max_dim / 2 - padding_abs,
        cx + max_dim / 2 + padding_abs,
        cy - max_dim / 2 - padding_abs,
        cy + max_dim / 2 + padding_abs,
    )
