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


def plot_process(pipes: list[Pipe]) -> None:
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

    common_limits = get_common_limits(pipes, padding=constants.DEFAULT_PADDING)

    comparison_styles = [{}, {"fill": False, "linestyle": "--"}]

    if n_items <= 2:
        fig, ax = plt.subplots(figsize=constants.SINGLE_FIGURE_SIZE)
        current_styles = []

        if n_items == 2:
            current_styles = comparison_styles

        _draw_on_axis(
            ax,
            pipes,
            labels,
            constants.BASE_COLORS[:n_items],
            constants.BASE_ALPHAS[:n_items],
            custom_styles=current_styles,
            metrics=tuple(thickness_reductions[0])
            if len(thickness_reductions) > 0
            else None,
            limits=common_limits,
            area_reduction=reductions[0] if reductions else None,
            ecc_diff=ecc_diffs[0] if ecc_diffs else None,
        )

        _draw_on_axis(
            ax,
            pipes,
            labels,
            constants.BASE_COLORS[:n_items],
            constants.BASE_ALPHAS[:n_items],
            custom_styles=current_styles,
            limits=common_limits,
        )
        title = "Pipe Comparison" if n_items == 2 else "Pipe Visualization"
        ax.set_title(title, fontsize=constants.TITLE_FONTSIZE)

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
            ax = axes[i]
            idx1, idx2 = i, i + 1
            p_sub = [pipes[idx1], pipes[idx2]]
            l_sub = [labels[idx1], labels[idx2]]
            c_sub = [constants.BASE_COLORS[idx1 % 5], constants.BASE_COLORS[idx2 % 5]]
            a_sub = [constants.BASE_ALPHAS[idx1 % 5], constants.BASE_ALPHAS[idx2 % 5]]

            _draw_on_axis(
                ax,
                p_sub,
                l_sub,
                c_sub,
                a_sub,
                custom_styles=comparison_styles,
                metrics=tuple(thickness_reductions[i])
                if len(thickness_reductions) > 0
                else None,
                limits=common_limits,
                area_reduction=reductions[i] if reductions else None,
                ecc_diff=ecc_diffs[i] if ecc_diffs else None,
            )
            ax.set_title(
                f"Transition: {l_sub[0]} → {l_sub[1]}",
                fontsize=constants.SUBTITLE_FONTSIZE,
            )

    plt.tight_layout()
    plt.show()
