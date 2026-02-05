from __future__ import annotations

import matplotlib.patches as patches
import matplotlib.path as mpath
import numpy as np

from pipes import Pipe
from vertex_generators import get_vertices
from visualization import constants


def create_pipe_patch(
    pipe: Pipe,
    color: str,
    alpha: float,
    label: str,
    fill: bool = True,
    linestyle: str = "solid",
):
    """Create a matplotlib PathPatch for a pipe."""
    outer_verts = get_vertices(pipe.outer, clockwise=False)
    inner_verts = get_vertices(pipe.inner, clockwise=True)
    codes = (
        [mpath.Path.MOVETO]
        + [mpath.Path.LINETO] * (len(outer_verts) - 2)
        + [mpath.Path.CLOSEPOLY]
        + [mpath.Path.MOVETO]
        + [mpath.Path.LINETO] * (len(inner_verts) - 2)
        + [mpath.Path.CLOSEPOLY]
    )
    all_verts = np.concatenate([outer_verts, inner_verts])
    path = mpath.Path(all_verts, codes)
    linewidth = constants.HOLLOW_LINEWIDTH if not fill else constants.FILLED_LINEWIDTH
    return patches.PathPatch(
        path,
        facecolor=color if fill else "none",
        edgecolor="black",
        linewidth=linewidth,
        linestyle=linestyle,
        alpha=alpha if fill else 1.0,
        fill=fill,
        label=label,
    )
