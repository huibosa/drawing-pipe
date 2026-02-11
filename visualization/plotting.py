from __future__ import annotations

from pipes import Pipe

import matplotlib.pyplot as plt

from process import ProcessAnalysis
from visualization import constants
from visualization.layout import get_common_limits
from visualization.markers import plot_pipe_markers
from visualization.patch_factory import create_pipe_patch

VERTEX_NAMES = ("Tp", "TpRt", "Rt", "BtRt", "Bt")


def _draw_on_axis(
    ax,
    pipe_subset,
    label_subset,
    colors,
    alphas,
    custom_styles=None,
    metrics: tuple[float, float, float, float, float] | None = None,
    limits: tuple | None = None,
    area_reduction: float | None = None,
    ecc_diff: float | None = None,
    show_markers: bool = True,
):
    for i, (pipe, label, color, alpha) in enumerate(
        zip(pipe_subset, label_subset, colors, alphas)
    ):
        style = {"fill": True, "linestyle": "solid"}
        if custom_styles and i < len(custom_styles) and custom_styles[i]:
            style.update(custom_styles[i])
        patch = create_pipe_patch(pipe, color, alpha, "_nolegend_", **style)
        ax.add_patch(patch)
        ax.plot(pipe.inner.origin[0], pipe.inner.origin[1], "k+", alpha=0.3)

        if show_markers:
            plot_pipe_markers(ax, pipe)

    ax.set_aspect("equal")
    if limits is not None:
        ax.set_xlim(limits[0], limits[1])
        ax.set_ylim(limits[2], limits[3])
    else:
        ax.autoscale_view()
    ax.grid(True, linestyle=constants.GRID_LINESTYLE, alpha=constants.GRID_ALPHA)

    if metrics is not None:
        metrics_text = "\n".join(
            f"{name}: {value * 100:.1f}%" for name, value in zip(VERTEX_NAMES, metrics)
        )
        ax.text(
            constants.METRICS_TEXT_LEFT_X,
            constants.METRICS_TEXT_Y,
            metrics_text,
            transform=ax.transAxes,
            fontsize=constants.METRICS_FONTSIZE,
            color="black",
            verticalalignment="top",
            horizontalalignment="right",
            bbox=dict(
                boxstyle=constants.METRICS_BOX_STYLE,
                facecolor=constants.METRICS_BOX_FACECOLOR,
                alpha=constants.METRICS_BOX_ALPHA,
            ),
        )

    if area_reduction is not None or ecc_diff is not None:
        metrics_text = ""
        if area_reduction is not None:
            metrics_text += f"Area: {area_reduction * 100:.1f}%\n"
        if ecc_diff is not None:
            metrics_text += f"Ecc: {ecc_diff:.2f}"
        ax.text(
            constants.METRICS_TEXT_X,
            constants.METRICS_TEXT_Y,
            metrics_text.strip(),
            transform=ax.transAxes,
            fontsize=constants.METRICS_FONTSIZE,
            verticalalignment="top",
            horizontalalignment="right",
            bbox=dict(
                boxstyle=constants.METRICS_BOX_STYLE,
                facecolor=constants.METRICS_BOX_FACECOLOR,
                alpha=constants.METRICS_BOX_ALPHA,
            ),
        )


def plot_single_process(
    ax,
    pipe1: Pipe,
    pipe2: Pipe,
    title: str = "Pipe Comparison",
    metrics: tuple[float, float, float, float, float] | None = None,
    area_reduction: float | None = None,
    ecc_diff: float | None = None,
    limits: tuple | None = None,
    show_markers: bool = True,
) -> None:
    """Draw pipe1 vs pipe2 comparison on given axis."""
    pipes = [pipe1, pipe2]
    labels = ["Pipe 1", "Pipe 2"]
    colors = [constants.BASE_COLORS[0], constants.BASE_COLORS[1]]
    alphas = [constants.BASE_ALPHAS[0], constants.BASE_ALPHAS[1]]
    custom_styles = [{}, {"fill": False, "linestyle": "--"}]

    _draw_on_axis(
        ax,
        pipes,
        labels,
        colors,
        alphas,
        custom_styles=custom_styles,
        metrics=metrics,
        limits=limits,
        area_reduction=area_reduction,
        ecc_diff=ecc_diff,
        show_markers=show_markers,
    )
    ax.set_title(title, fontsize=constants.TITLE_FONTSIZE)


def plot_pipe(
    pipe: Pipe,
    *,
    title: str = "Pipe Visualization",
    show: bool = True,
    show_markers: bool = True,
    limits: tuple | None = None,
):
    """Plot a single pipe in a standalone figure."""
    fig, ax = plt.subplots(figsize=constants.SINGLE_FIGURE_SIZE)
    _draw_on_axis(
        ax,
        [pipe],
        ["Pipe 1"],
        [constants.BASE_COLORS[0]],
        [constants.BASE_ALPHAS[0]],
        limits=limits,
        show_markers=show_markers,
    )
    ax.set_title(title, fontsize=constants.TITLE_FONTSIZE)
    plt.tight_layout()
    if show:
        plt.show()
    return fig


def plot_process(
    pipes: list[Pipe],
    *,
    show: bool = True,
    show_markers: bool = True,
    padding: float = constants.DEFAULT_PADDING,
):
    """
    Plot pipes.
    - If 1 item: Single plot, filled.
    - If >= 2 items: pairwise comparisons (Pipe 1 vs 2, Pipe 2 vs 3).
      The SECOND pipe is DASHED and HOLLOW.
      Metrics (Area Reduction, Eccentricity Diff) are shown in the xlabel.
    """

    n_items = len(pipes)
    labels = [f"Pipe {i + 1}" for i in range(n_items)]

    process = ProcessAnalysis(pipes)
    reductions = process.area_reductions
    ecc_diffs = process.eccentricity_diffs
    thickness_reductions = process.thickness_reductions

    common_limits = get_common_limits(pipes, padding=padding)

    if n_items <= 2:
        fig, ax = plt.subplots(figsize=constants.SINGLE_FIGURE_SIZE)

        if n_items == 2:
            plot_single_process(
                ax,
                pipes[0],
                pipes[1],
                title="Pipe Comparison",
                metrics=tuple(thickness_reductions[0])
                if len(thickness_reductions) > 0
                else None,
                area_reduction=reductions[0] if reductions else None,
                ecc_diff=ecc_diffs[0] if ecc_diffs else None,
                limits=common_limits,
                show_markers=show_markers,
            )
        else:
            _draw_on_axis(
                ax,
                pipes,
                labels,
                constants.BASE_COLORS[:n_items],
                constants.BASE_ALPHAS[:n_items],
                limits=common_limits,
                show_markers=show_markers,
            )
            ax.set_title("Pipe Visualization", fontsize=constants.TITLE_FONTSIZE)

    else:
        n_subplots = n_items - 1
        fig, axes = plt.subplots(
            1,
            n_subplots,
            figsize=(constants.SUBPLOT_WIDTH * n_subplots, constants.SUBPLOT_WIDTH),
        )
        if n_subplots == 1:
            axes = [axes]

        for i in range(n_subplots):
            plot_single_process(
                axes[i],
                pipes[i],
                pipes[i + 1],
                title=f"Transition: Pipe {i + 1} → Pipe {i + 2}",
                metrics=tuple(thickness_reductions[i])
                if len(thickness_reductions) > 0
                else None,
                area_reduction=reductions[i] if reductions else None,
                ecc_diff=ecc_diffs[i] if ecc_diffs else None,
                limits=common_limits,
                show_markers=show_markers,
            )

    plt.tight_layout()
    if show:
        plt.show()
    return fig
