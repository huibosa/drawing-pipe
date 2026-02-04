from typing import TYPE_CHECKING

import matplotlib.patches as patches
import matplotlib.path as mpath
import matplotlib.pyplot as plt
import numpy as np

from fixtures import PROCESS
from process import ProcessAnalysis
from vertex_generators import get_vertices

if TYPE_CHECKING:
    from pipes import Pipe


def create_pipe_patch(
    pipe: "Pipe",
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
    return patches.PathPatch(
        path,
        facecolor=color if fill else "none",
        edgecolor="black",
        linewidth=2.0 if not fill else 1.5,
        linestyle=linestyle,
        alpha=alpha if fill else 1.0,
        fill=fill,
        label=label,
    )


def _get_common_limits(pipes: list["Pipe"], padding: float = 0.1) -> tuple:
    """Calculate common x/y limits for all pipes to ensure uniform aspect ratio."""
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


def plot_process(pipes: list["Pipe"]) -> None:
    """
    Plot pipes.
    - If 1 item: Single plot, filled.
    - If >= 2 items: pairwise comparisons (Pipe 1 vs 2, Pipe 2 vs 3).
      The SECOND pipe is DASHED and HOLLOW.
      Metrics (Area Reduction, Eccentricity Diff) are shown in the xlabel.
    """

    n_items = len(pipes)
    labels = [f"Pipe {i + 1}" for i in range(n_items)]
    base_colors = ["#B0C4DE", "#B0C4DE", "#B0C4DE", "#B0C4DE", "#B0C4DE"]
    base_alphas = [0.4, 0.5, 0.6, 0.7, 0.8]

    process = ProcessAnalysis(pipes)
    reductions = process.area_reductions
    ecc_diffs = process.eccentricity_diffs

    common_limits = _get_common_limits(pipes, padding=0.1)

    def _draw_on_axis(
        ax,
        pipe_subset,
        label_subset,
        colors,
        alphas,
        custom_styles=None,
        metrics_str="",
        limits: tuple | None = None,
    ):
        for i, (pipe, label, color, alpha) in enumerate(
            zip(pipe_subset, label_subset, colors, alphas)
        ):
            style = {"fill": True, "linestyle": "solid"}
            if custom_styles and i < len(custom_styles) and custom_styles[i]:
                style.update(custom_styles[i])
            patch = create_pipe_patch(pipe, color, alpha, label, **style)
            ax.add_patch(patch)
            ax.plot(pipe.inner.origin[0], pipe.inner.origin[1], "k+", alpha=0.3)
        ax.set_aspect("equal")
        if limits is not None:
            ax.set_xlim(limits[0], limits[1])
            ax.set_ylim(limits[2], limits[3])
        else:
            ax.autoscale_view()
        ax.grid(True, linestyle="--", alpha=0.5)

        if metrics_str:
            ax.set_xlabel(metrics_str, fontsize=10, fontweight="bold", color="darkblue")
        else:
            ax.set_xlabel("X Axis")

        ax.set_ylabel("Y Axis")
        ax.legend(loc="upper right")

    comparison_styles = [{}, {"fill": False, "linestyle": "--"}]

    if n_items <= 2:
        fig, ax = plt.subplots(figsize=(8, 8))
        current_styles = []
        metrics_info = ""

        if n_items == 2:
            current_styles = comparison_styles
            if reductions:
                metrics_info = f"Area Red: {reductions[0] * 100:.1f}% | Ecc Diff: {ecc_diffs[0]:.2f}"

        _draw_on_axis(
            ax,
            pipes,
            labels,
            base_colors[:n_items],
            base_alphas[:n_items],
            custom_styles=current_styles,
            metrics_str=metrics_info,
            limits=common_limits,
        )
        title = "Pipe Comparison" if n_items == 2 else "Pipe Visualization"
        ax.set_title(title, fontsize=14)

    else:
        n_subplots = n_items - 1
        fig, axes = plt.subplots(1, n_subplots, figsize=(6 * n_subplots, 6))
        if n_subplots == 1:
            axes = [axes]

        for i in range(n_subplots):
            ax = axes[i]
            idx1, idx2 = i, i + 1
            p_sub = [pipes[idx1], pipes[idx2]]
            l_sub = [labels[idx1], labels[idx2]]
            c_sub = [base_colors[idx1 % 5], base_colors[idx2 % 5]]
            a_sub = [base_alphas[idx1 % 5], base_alphas[idx2 % 5]]

            info = (
                f"Area Red: {reductions[i] * 100:.1f}% | Ecc Diff: {ecc_diffs[i]:.2f}"
            )

            _draw_on_axis(
                ax,
                p_sub,
                l_sub,
                c_sub,
                a_sub,
                custom_styles=comparison_styles,
                metrics_str=info,
                limits=common_limits,
            )
            ax.set_title(f"Transition: {l_sub[0]} → {l_sub[1]}", fontsize=11)

    plt.tight_layout()
    plt.show()


if __name__ == "__main__":
    plot_process(PROCESS)
