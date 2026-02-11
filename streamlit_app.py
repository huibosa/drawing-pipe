from __future__ import annotations

import time
from typing import cast

import matplotlib.pyplot as plt
import streamlit as st

import fixtures
from pipes import CircleCircle, Pipe, RectRect, SplineSpline
from process import ProcessAnalysis
from shapes import Circle, CubicSplineShape, Rect
from visualization import constants
from visualization.layout import get_common_limits
from visualization.plotting import plot_single_process

PIPE_TYPE_OPTIONS = ("CircleCircle", "RectRect", "SplineSpline")
TRANSITION_FIGURE_SIZE = (4.6, 4.6)


def _load_template_options() -> dict[str, list[Pipe]]:
    templates: dict[str, list[Pipe]] = {}
    for name, value in sorted(vars(fixtures).items()):
        if name.startswith("_"):
            continue
        if isinstance(value, Pipe):
            templates[name] = [value]
            continue
        if (
            isinstance(value, list)
            and value
            and all(isinstance(item, Pipe) for item in value)
        ):
            templates[name] = list(value)
    return templates


def _default_template_name(template_options: dict[str, list[Pipe]]) -> str:
    if "PROCESS" in template_options:
        return "PROCESS"
    return next(iter(template_options))


def _init_editable_pipes(template_options: dict[str, list[Pipe]]) -> None:
    if "editable_pipes" not in st.session_state:
        default_name = _default_template_name(template_options)
        st.session_state["editable_pipes"] = list(template_options[default_name])
        st.session_state["current_template"] = default_name
    _init_debounce_state()


def _init_debounce_state() -> None:
    if "pipe_edit_seq" not in st.session_state:
        st.session_state["pipe_edit_seq"] = {}
    if "pipe_last_change_at" not in st.session_state:
        st.session_state["pipe_last_change_at"] = {}
    if "pipe_applied_seq" not in st.session_state:
        st.session_state["pipe_applied_seq"] = {}


def _clear_edit_widget_keys() -> None:
    stale_keys = [
        k for k in st.session_state if isinstance(k, str) and k.startswith("pipe_")
    ]
    for k in stale_keys:
        del st.session_state[k]


def _reset_debounce_state() -> None:
    st.session_state["pipe_edit_seq"] = {}
    st.session_state["pipe_last_change_at"] = {}
    st.session_state["pipe_applied_seq"] = {}
    st.session_state["pending_pipe_updates"] = {}
    _clear_edit_widget_keys()


def _circle_inputs(
    label_prefix: str,
    key_prefix: str,
    defaults: Circle | None = None,
    on_change=None,
    on_change_args: tuple = (),
) -> Circle:
    default_origin = defaults.origin if defaults else (0.0, 0.0)
    default_diameter = defaults.diameter if defaults else 60.0

    ox = st.number_input(
        f"{label_prefix} origin x",
        key=f"{key_prefix}_ox",
        value=float(default_origin[0]),
        step=0.1,
        on_change=on_change,
        args=on_change_args,
    )
    oy = st.number_input(
        f"{label_prefix} origin y",
        key=f"{key_prefix}_oy",
        value=float(default_origin[1]),
        step=0.1,
        on_change=on_change,
        args=on_change_args,
    )
    diameter = st.number_input(
        f"{label_prefix} diameter",
        key=f"{key_prefix}_diameter",
        min_value=0.01,
        value=float(default_diameter),
        step=0.1,
        on_change=on_change,
        args=on_change_args,
    )
    return Circle(origin=(ox, oy), diameter=diameter)


def _rect_inputs(
    label_prefix: str,
    key_prefix: str,
    defaults: Rect | None = None,
    on_change=None,
    on_change_args: tuple = (),
) -> Rect:
    default_origin = defaults.origin if defaults else (0.0, 0.0)
    default_length = defaults.length if defaults else 60.0
    default_width = defaults.width if defaults else 50.0
    default_fillet_radius = defaults.fillet_radius if defaults else 2.5

    ox = st.number_input(
        f"{label_prefix} origin x",
        key=f"{key_prefix}_ox",
        value=float(default_origin[0]),
        step=0.1,
        on_change=on_change,
        args=on_change_args,
    )
    oy = st.number_input(
        f"{label_prefix} origin y",
        key=f"{key_prefix}_oy",
        value=float(default_origin[1]),
        step=0.1,
        on_change=on_change,
        args=on_change_args,
    )
    length = st.number_input(
        f"{label_prefix} length",
        key=f"{key_prefix}_length",
        min_value=0.01,
        value=float(default_length),
        step=0.1,
        on_change=on_change,
        args=on_change_args,
    )
    width = st.number_input(
        f"{label_prefix} width",
        key=f"{key_prefix}_width",
        min_value=0.01,
        value=float(default_width),
        step=0.1,
        on_change=on_change,
        args=on_change_args,
    )
    fillet_radius = st.number_input(
        f"{label_prefix} fillet radius",
        key=f"{key_prefix}_fillet_radius",
        min_value=0.01,
        value=float(default_fillet_radius),
        step=0.1,
        on_change=on_change,
        args=on_change_args,
    )
    return Rect(
        origin=(ox, oy),
        length=length,
        width=width,
        fillet_radius=fillet_radius,
    )


def _spline_inputs(
    label_prefix: str,
    key_prefix: str,
    defaults: CubicSplineShape | None = None,
    on_change=None,
    on_change_args: tuple = (),
) -> CubicSplineShape:
    default_origin = defaults.origin if defaults else (0.0, 0.0)
    default_v1 = defaults.v1 if defaults else (0.0, 30.0)
    default_v2 = defaults.v2 if defaults else (20.0, 20.0)
    default_v3 = defaults.v3 if defaults else (30.0, 0.0)

    ox = st.number_input(
        f"{label_prefix} origin x",
        key=f"{key_prefix}_ox",
        value=float(default_origin[0]),
        step=0.1,
        on_change=on_change,
        args=on_change_args,
    )
    oy = st.number_input(
        f"{label_prefix} origin y",
        key=f"{key_prefix}_oy",
        value=float(default_origin[1]),
        step=0.1,
        on_change=on_change,
        args=on_change_args,
    )

    v1x = st.number_input(
        f"{label_prefix} v1 x",
        key=f"{key_prefix}_v1x",
        value=float(default_v1[0]),
        step=0.1,
        on_change=on_change,
        args=on_change_args,
    )
    v1y = st.number_input(
        f"{label_prefix} v1 y",
        key=f"{key_prefix}_v1y",
        value=float(default_v1[1]),
        step=0.1,
        on_change=on_change,
        args=on_change_args,
    )
    v2x = st.number_input(
        f"{label_prefix} v2 x",
        key=f"{key_prefix}_v2x",
        value=float(default_v2[0]),
        step=0.1,
        on_change=on_change,
        args=on_change_args,
    )
    v2y = st.number_input(
        f"{label_prefix} v2 y",
        key=f"{key_prefix}_v2y",
        value=float(default_v2[1]),
        step=0.1,
        on_change=on_change,
        args=on_change_args,
    )
    v3x = st.number_input(
        f"{label_prefix} v3 x",
        key=f"{key_prefix}_v3x",
        value=float(default_v3[0]),
        step=0.1,
        on_change=on_change,
        args=on_change_args,
    )
    v3y = st.number_input(
        f"{label_prefix} v3 y",
        key=f"{key_prefix}_v3y",
        value=float(default_v3[1]),
        step=0.1,
        on_change=on_change,
        args=on_change_args,
    )

    return CubicSplineShape(
        origin=(ox, oy),
        v1=(v1x, v1y),
        v2=(v2x, v2y),
        v3=(v3x, v3y),
    )


def _build_pipe_from_shapes(
    pipe_type: str,
    outer: Circle | Rect | CubicSplineShape,
    inner: Circle | Rect | CubicSplineShape,
) -> Pipe:
    if pipe_type == "CircleCircle":
        return CircleCircle(outer=outer, inner=inner)
    if pipe_type == "RectRect":
        return RectRect(outer=outer, inner=inner)
    return SplineSpline(outer=outer, inner=inner)


def _mark_pipe_dirty(pipe_idx: int) -> None:
    edit_seq = st.session_state.setdefault("pipe_edit_seq", {})
    last_change_at = st.session_state.setdefault("pipe_last_change_at", {})
    current_seq = int(edit_seq.get(pipe_idx, 0)) + 1
    edit_seq[pipe_idx] = current_seq
    last_change_at[pipe_idx] = time.monotonic()


def _pipe_type_name(pipe: Pipe) -> str:
    if isinstance(pipe, CircleCircle):
        return "CircleCircle"
    if isinstance(pipe, RectRect):
        return "RectRect"
    return "SplineSpline"


def _circle_defaults_from_shape(shape: Circle | Rect | CubicSplineShape) -> Circle:
    if isinstance(shape, Circle):
        return shape
    if isinstance(shape, Rect):
        diameter = min(shape.length, shape.width)
        return Circle(origin=shape.origin, diameter=max(0.01, float(diameter)))

    diameter = 2.0 * max(
        abs(shape.v1[1]),
        abs(shape.v2[0]),
        abs(shape.v2[1]),
        abs(shape.v3[0]),
    )
    return Circle(origin=shape.origin, diameter=max(0.01, float(diameter)))


def _rect_defaults_from_shape(shape: Circle | Rect | CubicSplineShape) -> Rect:
    if isinstance(shape, Rect):
        return shape
    if isinstance(shape, Circle):
        side = max(0.01, float(shape.diameter))
        return Rect(origin=shape.origin, length=side, width=side, fillet_radius=2.5)

    length = max(0.01, float(2.0 * max(abs(shape.v1[1]), abs(shape.v2[1]))))
    width = max(0.01, float(2.0 * max(abs(shape.v2[0]), abs(shape.v3[0]))))
    fillet_radius = min(2.5, length / 4.0, width / 4.0)
    return Rect(
        origin=shape.origin,
        length=length,
        width=width,
        fillet_radius=max(0.01, float(fillet_radius)),
    )


def _spline_defaults_from_shape(
    shape: Circle | Rect | CubicSplineShape,
) -> CubicSplineShape:
    if isinstance(shape, CubicSplineShape):
        return shape

    if isinstance(shape, Circle):
        half_width = shape.diameter / 2.0
        half_height = shape.diameter / 2.0
    else:
        half_width = shape.width / 2.0
        half_height = shape.length / 2.0

    return CubicSplineShape(
        origin=shape.origin,
        v1=(0.0, float(max(0.01, half_height))),
        v2=(
            float(max(0.01, half_width / 1.5)),
            float(max(0.01, half_height / 1.5)),
        ),
        v3=(float(max(0.01, half_width)), 0.0),
    )


def _defaults_for_pipe_type(
    pipe_type: str,
    pipe: Pipe,
) -> tuple[Circle | Rect | CubicSplineShape, Circle | Rect | CubicSplineShape]:
    if pipe_type == "CircleCircle":
        inner = _circle_defaults_from_shape(
            cast(Circle | Rect | CubicSplineShape, pipe.inner)
        )
        outer = _circle_defaults_from_shape(
            cast(Circle | Rect | CubicSplineShape, pipe.outer)
        )
        return inner, outer
    if pipe_type == "RectRect":
        inner = _rect_defaults_from_shape(
            cast(Circle | Rect | CubicSplineShape, pipe.inner)
        )
        outer = _rect_defaults_from_shape(
            cast(Circle | Rect | CubicSplineShape, pipe.outer)
        )
        return inner, outer

    inner = _spline_defaults_from_shape(
        cast(Circle | Rect | CubicSplineShape, pipe.inner)
    )
    outer = _spline_defaults_from_shape(
        cast(Circle | Rect | CubicSplineShape, pipe.outer)
    )
    return inner, outer


def _make_insert_pipe(reference_pipe: Pipe) -> Pipe:
    return reference_pipe.model_copy(deep=True)


def _edit_pipe_inputs_live(pipe: Pipe, key_prefix: str, pipe_idx: int) -> Pipe:
    current_type = _pipe_type_name(pipe)
    selected_type = st.selectbox(
        "Pipe type",
        PIPE_TYPE_OPTIONS,
        index=PIPE_TYPE_OPTIONS.index(current_type),
        key=f"{key_prefix}_type",
        on_change=_mark_pipe_dirty,
        args=(pipe_idx,),
    )

    inner_col, outer_col = st.columns(2)
    on_change_args = (pipe_idx,)
    inner_defaults, outer_defaults = _defaults_for_pipe_type(selected_type, pipe)

    if selected_type == "CircleCircle":
        inner_defaults_circle = cast(Circle, inner_defaults)
        outer_defaults_circle = cast(Circle, outer_defaults)
        with inner_col:
            st.markdown("**Inner**")
            inner = _circle_inputs(
                "Inner",
                f"{key_prefix}_inner",
                inner_defaults_circle,
                on_change=_mark_pipe_dirty,
                on_change_args=on_change_args,
            )
        with outer_col:
            st.markdown("**Outer**")
            outer = _circle_inputs(
                "Outer",
                f"{key_prefix}_outer",
                outer_defaults_circle,
                on_change=_mark_pipe_dirty,
                on_change_args=on_change_args,
            )
        return _build_pipe_from_shapes(selected_type, outer=outer, inner=inner)

    if selected_type == "RectRect":
        inner_defaults_rect = cast(Rect, inner_defaults)
        outer_defaults_rect = cast(Rect, outer_defaults)
        with inner_col:
            st.markdown("**Inner**")
            inner = _rect_inputs(
                "Inner",
                f"{key_prefix}_inner",
                inner_defaults_rect,
                on_change=_mark_pipe_dirty,
                on_change_args=on_change_args,
            )
        with outer_col:
            st.markdown("**Outer**")
            outer = _rect_inputs(
                "Outer",
                f"{key_prefix}_outer",
                outer_defaults_rect,
                on_change=_mark_pipe_dirty,
                on_change_args=on_change_args,
            )
        return _build_pipe_from_shapes(selected_type, outer=outer, inner=inner)

    inner_defaults_spline = cast(CubicSplineShape, inner_defaults)
    outer_defaults_spline = cast(CubicSplineShape, outer_defaults)
    with inner_col:
        st.markdown("**Inner**")
        inner = _spline_inputs(
            "Inner",
            f"{key_prefix}_inner",
            inner_defaults_spline,
            on_change=_mark_pipe_dirty,
            on_change_args=on_change_args,
        )
    with outer_col:
        st.markdown("**Outer**")
        outer = _spline_inputs(
            "Outer",
            f"{key_prefix}_outer",
            outer_defaults_spline,
            on_change=_mark_pipe_dirty,
            on_change_args=on_change_args,
        )
    return _build_pipe_from_shapes(selected_type, outer=outer, inner=inner)


@st.fragment
def _render_transition_rows(
    show_markers: bool,
    padding: float,
    debounce_seconds: float,
) -> None:
    editable_pipes = st.session_state["editable_pipes"]
    common_limits = get_common_limits(editable_pipes, padding=padding)
    pending_updates: dict[int, Pipe] = {}

    if len(editable_pipes) >= 2:
        analysis = ProcessAnalysis(editable_pipes)
        reductions = analysis.area_reductions
        ecc_diffs = analysis.eccentricity_diffs
        thickness_reductions = analysis.thickness_reductions
        transition_cols = st.columns(len(editable_pipes) - 1)

        for idx, transition_col in enumerate(transition_cols):
            left_pipe = editable_pipes[idx]
            right_pipe = editable_pipes[idx + 1]

            with transition_col:
                fig, ax = plt.subplots(figsize=TRANSITION_FIGURE_SIZE)
                plot_single_process(
                    ax,
                    left_pipe,
                    right_pipe,
                    title=f"Transition: Pipe {idx + 1} -> Pipe {idx + 2}",
                    metrics=tuple(thickness_reductions[idx])
                    if len(thickness_reductions) > idx
                    else None,
                    area_reduction=reductions[idx] if len(reductions) > idx else None,
                    ecc_diff=ecc_diffs[idx] if len(ecc_diffs) > idx else None,
                    limits=common_limits,
                    show_markers=show_markers,
                )
                fig.tight_layout()
                st.pyplot(fig, clear_figure=True, width="stretch")
                plt.close(fig)

    pipe_cols = st.columns(len(editable_pipes))
    edit_seq = st.session_state.get("pipe_edit_seq", {})
    applied_seq = st.session_state.get("pipe_applied_seq", {})
    last_change_at = st.session_state.get("pipe_last_change_at", {})

    for idx, pipe_col in enumerate(pipe_cols):
        pipe = editable_pipes[idx]
        with pipe_col:
            st.markdown(f"**Pipe {idx + 1}**")
            updated_pipe = _edit_pipe_inputs_live(
                pipe,
                key_prefix=f"pipe_{idx}",
                pipe_idx=idx,
            )
            pending_updates[idx] = updated_pipe

            current_seq = int(edit_seq.get(idx, 0))
            current_applied_seq = int(applied_seq.get(idx, 0))
            changed_at = last_change_at.get(idx)

            if current_seq > current_applied_seq and isinstance(changed_at, float):
                elapsed = time.monotonic() - changed_at
                remaining = debounce_seconds - elapsed
                if remaining > 0:
                    st.caption(f"Editing... auto-apply in {remaining:.1f}s")
                else:
                    st.caption("Applying changes...")
            else:
                st.caption("Updated")

            action_cols = st.columns(2)
            if action_cols[0].button(
                "x",
                key=f"pipe_delete_{idx}",
                help=f"Delete Pipe {idx + 1}",
            ):
                st.session_state["editable_pipes"].pop(idx)
                _reset_debounce_state()
                st.rerun()

            if action_cols[1].button(
                "+",
                key=f"pipe_insert_after_{idx}",
                help=f"Insert Pipe after {idx + 1}",
            ):
                st.session_state["editable_pipes"].insert(
                    idx + 1,
                    _make_insert_pipe(updated_pipe),
                )
                _reset_debounce_state()
                st.rerun()

    st.session_state["pending_pipe_updates"] = pending_updates


@st.fragment(run_every=0.5)
def _debounce_poller(debounce_seconds: float) -> None:
    """Lightweight polling fragment that does zero rendering.

    Checks whether any dirty pipes have waited long enough past the
    debounce window. If so, applies the pending pipe updates stored in
    session state and triggers a full app rerun so plots regenerate once.
    """
    edit_seq = st.session_state.get("pipe_edit_seq", {})
    applied_seq = st.session_state.get("pipe_applied_seq", {})
    last_change_at = st.session_state.get("pipe_last_change_at", {})
    pending_updates = st.session_state.get("pending_pipe_updates", {})

    if not pending_updates:
        return

    any_applied = False
    for pipe_idx, updated_pipe in pending_updates.items():
        current_seq = int(edit_seq.get(pipe_idx, 0))
        current_applied_seq = int(applied_seq.get(pipe_idx, 0))
        changed_at = last_change_at.get(pipe_idx)

        if current_seq <= current_applied_seq or not isinstance(changed_at, float):
            continue

        elapsed = time.monotonic() - changed_at
        if elapsed < debounce_seconds:
            continue

        st.session_state["editable_pipes"][pipe_idx] = updated_pipe
        applied_seq[pipe_idx] = current_seq
        any_applied = True

    if any_applied:
        st.session_state["pending_pipe_updates"] = {}
        st.rerun(scope="app")


def main() -> None:
    st.set_page_config(layout="wide")
    template_options = _load_template_options()
    if not template_options:
        st.error("No pipe templates found in fixtures.py")
        return

    _init_editable_pipes(template_options)
    default_template_name = _default_template_name(template_options)
    debounce_seconds = 1.0

    with st.sidebar:
        st.header("Controls")
        selected_name = st.selectbox(
            "Template",
            list(template_options.keys()),
            index=list(template_options.keys()).index(default_template_name),
        )
        if selected_name != st.session_state.get("current_template"):
            st.session_state["editable_pipes"] = list(template_options[selected_name])
            st.session_state["current_template"] = selected_name
            _reset_debounce_state()
            st.rerun()

        show_markers = st.checkbox("Show markers", value=True)
        padding = st.slider(
            "Padding",
            min_value=0.00,
            max_value=0.50,
            value=constants.DEFAULT_PADDING,
            step=0.01,
        )

    editable_pipes = st.session_state["editable_pipes"]
    if not editable_pipes:
        st.info("No pipes in the process. Load a template or add a new pipe.")
        return

    _render_transition_rows(
        show_markers=show_markers,
        padding=padding,
        debounce_seconds=debounce_seconds,
    )
    _debounce_poller(debounce_seconds=debounce_seconds)


if __name__ == "__main__":
    main()
