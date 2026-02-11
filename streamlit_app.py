from __future__ import annotations

import matplotlib.pyplot as plt
import streamlit as st

from fixtures import FINISH_3, FINISH_6, FINISH_8, PROCESS
from process import ProcessAnalysis
from visualization import constants
from visualization.plotting import plot_process

VERTEX_NAMES = ("Tp", "TpRt", "Rt", "BtRt", "Bt")


def _format_transition_metrics(analysis: ProcessAnalysis, idx: int) -> dict[str, float]:
    metrics: dict[str, float] = {
        "area_reduction_pct": analysis.area_reductions[idx] * 100,
        "eccentricity_diff": analysis.eccentricity_diffs[idx],
    }
    for vertex_name, value in zip(VERTEX_NAMES, analysis.thickness_reductions[idx]):
        metrics[f"thickness_{vertex_name}_pct"] = value * 100
    return metrics


def _render_process_metrics(pipes: list) -> None:
    if len(pipes) < 2:
        st.info("Metrics are available when at least two pipes are selected.")
        return

    analysis = ProcessAnalysis(pipes)
    transition_count = len(pipes) - 1

    st.subheader("Transition Metrics")
    for idx in range(transition_count):
        transition_label = f"Pipe {idx + 1} -> Pipe {idx + 2}"
        metrics = _format_transition_metrics(analysis, idx)

        st.markdown(f"**{transition_label}**")
        c1, c2 = st.columns(2)
        c1.metric("Area Reduction", f"{metrics['area_reduction_pct']:.2f}%")
        c2.metric("Eccentricity Diff", f"{metrics['eccentricity_diff']:.2f}")

        thickness_parts = [
            f"{name}: {metrics[f'thickness_{name}_pct']:.2f}%" for name in VERTEX_NAMES
        ]
        st.caption("Thickness Reduction - " + " | ".join(thickness_parts))


def main() -> None:
    st.set_page_config(page_title="Drawing Pipe", layout="wide")
    st.title("Drawing Pipe Process Explorer")

    process_options = {
        "Default Process": PROCESS,
        "Finish 3": [FINISH_3],
        "Finish 6": [FINISH_6],
        "Finish 8": [FINISH_8],
    }

    with st.sidebar:
        st.header("Controls")
        selected_name = st.selectbox("Process", list(process_options.keys()))
        selected_process = process_options[selected_name]
        show_markers = st.checkbox("Show markers", value=True)
        padding = st.slider(
            "Padding",
            min_value=0.00,
            max_value=0.50,
            value=constants.DEFAULT_PADDING,
            step=0.01,
        )

        if len(selected_process) > 1:
            view_mode = st.radio("View", ["Full process", "Single transition"], index=0)
        else:
            view_mode = "Full process"

    if view_mode == "Single transition" and len(selected_process) > 1:
        transition_idx = st.slider(
            "Transition",
            min_value=1,
            max_value=len(selected_process) - 1,
            value=1,
            step=1,
        )
        pipes_to_plot = [
            selected_process[transition_idx - 1],
            selected_process[transition_idx],
        ]
    else:
        pipes_to_plot = selected_process

    figure = plot_process(
        pipes_to_plot,
        show=False,
        show_markers=show_markers,
        padding=padding,
    )
    st.pyplot(figure, clear_figure=True, width="stretch")
    plt.close(figure)

    _render_process_metrics(pipes_to_plot)


if __name__ == "__main__":
    main()
