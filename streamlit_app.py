from __future__ import annotations

import time
from typing import cast

import matplotlib.pyplot as plt
import streamlit as st
from pydantic import ValidationError

import fixtures
from pipes import CircleCircle, Pipe, RectRect, SplineSpline
from process import ProcessAnalysis
from shapes import Circle, CubicSplineShape, Ellipse, Rect
from visualization import constants
from visualization.layout import get_common_limits
from visualization.plotting import plot_pipe, plot_single_process

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


def _format_point(point: tuple[float, float]) -> str:
    return f"({point[0]:.2f}, {point[1]:.2f})"


def _shape_lines(
    prefix: str,
    shape: Circle | Rect | Ellipse | CubicSplineShape,
) -> list[str]:
    lines = [f"{prefix} shape: {type(shape).__name__}"]
    lines.append(f"{prefix} origin: {_format_point(shape.origin)}")

    if isinstance(shape, Circle):
        lines.append(f"{prefix} diameter: {shape.diameter:.2f}")
    elif isinstance(shape, Rect):
        lines.append(f"{prefix} length: {shape.length:.2f}")
        lines.append(f"{prefix} width: {shape.width:.2f}")
        lines.append(f"{prefix} fillet_radius: {shape.fillet_radius:.2f}")
    elif isinstance(shape, Ellipse):
        lines.append(f"{prefix} major_axis: {shape.major_axis:.2f}")
        lines.append(f"{prefix} minor_axis: {shape.minor_axis:.2f}")
    elif isinstance(shape, CubicSplineShape):
        lines.append(f"{prefix} v1: {_format_point(shape.v1)}")
        lines.append(f"{prefix} v2: {_format_point(shape.v2)}")
        lines.append(f"{prefix} v3: {_format_point(shape.v3)}")

    return lines


def _pipe_lines(pipe: Pipe, idx: int) -> list[str]:
    lines = [f"Pipe {idx + 1}: {type(pipe).__name__}"]
    lines.extend(_shape_lines("Outer", pipe.outer))
    lines.extend(_shape_lines("Inner", pipe.inner))
    return lines


def _init_editable_pipes(template_options: dict[str, list[Pipe]]) -> None:
    if "editable_pipes" not in st.session_state:
        default_name = _default_template_name(template_options)
        st.session_state["editable_pipes"] = list(template_options[default_name])
    _init_debounce_state()


def _init_debounce_state() -> None:
    if "transition_edit_seq" not in st.session_state:
        st.session_state["transition_edit_seq"] = {}
    if "transition_last_change_at" not in st.session_state:
        st.session_state["transition_last_change_at"] = {}
    if "transition_applied_seq" not in st.session_state:
        st.session_state["transition_applied_seq"] = {}


def _reset_debounce_state() -> None:
    st.session_state["transition_edit_seq"] = {}
    st.session_state["transition_last_change_at"] = {}
    st.session_state["transition_applied_seq"] = {}
    st.session_state["pending_pipe_updates"] = {}


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


def _render_add_pipe_form() -> None:
    editable_pipes = st.session_state["editable_pipes"]
    st.subheader("Add or Insert Pipe")

    with st.form("add_pipe_form"):
        pipe_type = st.selectbox("Pipe type", PIPE_TYPE_OPTIONS)
        placement_mode = st.radio(
            "Placement",
            ["Append to end", "Insert before Pipe N"],
        )

        insert_idx = None
        if placement_mode == "Insert before Pipe N":
            if editable_pipes:
                insert_idx = int(
                    st.number_input(
                        "Insert before pipe number",
                        min_value=1,
                        max_value=len(editable_pipes),
                        value=1,
                        step=1,
                    )
                )
            else:
                st.caption("Process is empty, so this will append to end.")

        st.markdown("**Outer parameters**")
        if pipe_type == "CircleCircle":
            outer = _circle_inputs("Outer", "add_outer")
            inner = _circle_inputs("Inner", "add_inner")
        elif pipe_type == "RectRect":
            outer = _rect_inputs("Outer", "add_outer")
            inner = _rect_inputs("Inner", "add_inner")
        else:
            outer = _spline_inputs("Outer", "add_outer")
            inner = _spline_inputs("Inner", "add_inner")

        submitted = st.form_submit_button("Apply")

    if not submitted:
        return

    try:
        new_pipe = _build_pipe_from_shapes(pipe_type, outer, inner)
    except ValidationError as exc:
        st.error(f"Invalid pipe definition: {exc}")
        return

    if placement_mode == "Insert before Pipe N" and insert_idx is not None:
        st.session_state["editable_pipes"].insert(insert_idx - 1, new_pipe)
    else:
        st.session_state["editable_pipes"].append(new_pipe)
    _reset_debounce_state()
    st.rerun()


def _edit_pipe_inputs(pipe: Pipe, key_prefix: str) -> Pipe:
    st.caption(f"Type: {type(pipe).__name__} (immutable)")
    inner_col, outer_col = st.columns(2)

    if isinstance(pipe, CircleCircle):
        inner_defaults = cast(Circle, pipe.inner)
        outer_defaults = cast(Circle, pipe.outer)
        with inner_col:
            st.markdown("**Inner**")
            inner = _circle_inputs("Inner", f"{key_prefix}_inner", inner_defaults)
        with outer_col:
            st.markdown("**Outer**")
            outer = _circle_inputs("Outer", f"{key_prefix}_outer", outer_defaults)
        return CircleCircle(outer=outer, inner=inner)

    if isinstance(pipe, RectRect):
        inner_defaults = cast(Rect, pipe.inner)
        outer_defaults = cast(Rect, pipe.outer)
        with inner_col:
            st.markdown("**Inner**")
            inner = _rect_inputs("Inner", f"{key_prefix}_inner", inner_defaults)
        with outer_col:
            st.markdown("**Outer**")
            outer = _rect_inputs("Outer", f"{key_prefix}_outer", outer_defaults)
        return RectRect(outer=outer, inner=inner)

    inner_defaults = cast(CubicSplineShape, pipe.inner)
    outer_defaults = cast(CubicSplineShape, pipe.outer)
    with inner_col:
        st.markdown("**Inner**")
        inner = _spline_inputs("Inner", f"{key_prefix}_inner", inner_defaults)
    with outer_col:
        st.markdown("**Outer**")
        outer = _spline_inputs("Outer", f"{key_prefix}_outer", outer_defaults)
    return SplineSpline(outer=outer, inner=inner)


def _mark_transition_dirty(transition_idx: int) -> None:
    edit_seq = st.session_state.setdefault("transition_edit_seq", {})
    last_change_at = st.session_state.setdefault("transition_last_change_at", {})
    current_seq = int(edit_seq.get(transition_idx, 0)) + 1
    edit_seq[transition_idx] = current_seq
    last_change_at[transition_idx] = time.monotonic()


def _edit_pipe_inputs_live(pipe: Pipe, key_prefix: str, transition_idx: int) -> Pipe:
    st.caption(f"Type: {type(pipe).__name__} (immutable)")
    inner_col, outer_col = st.columns(2)

    on_change_args = (transition_idx,)
    if isinstance(pipe, CircleCircle):
        inner_defaults = cast(Circle, pipe.inner)
        outer_defaults = cast(Circle, pipe.outer)
        with inner_col:
            st.markdown("**Inner**")
            inner = _circle_inputs(
                "Inner",
                f"{key_prefix}_inner",
                inner_defaults,
                on_change=_mark_transition_dirty,
                on_change_args=on_change_args,
            )
        with outer_col:
            st.markdown("**Outer**")
            outer = _circle_inputs(
                "Outer",
                f"{key_prefix}_outer",
                outer_defaults,
                on_change=_mark_transition_dirty,
                on_change_args=on_change_args,
            )
        return CircleCircle(outer=outer, inner=inner)

    if isinstance(pipe, RectRect):
        inner_defaults = cast(Rect, pipe.inner)
        outer_defaults = cast(Rect, pipe.outer)
        with inner_col:
            st.markdown("**Inner**")
            inner = _rect_inputs(
                "Inner",
                f"{key_prefix}_inner",
                inner_defaults,
                on_change=_mark_transition_dirty,
                on_change_args=on_change_args,
            )
        with outer_col:
            st.markdown("**Outer**")
            outer = _rect_inputs(
                "Outer",
                f"{key_prefix}_outer",
                outer_defaults,
                on_change=_mark_transition_dirty,
                on_change_args=on_change_args,
            )
        return RectRect(outer=outer, inner=inner)

    inner_defaults = cast(CubicSplineShape, pipe.inner)
    outer_defaults = cast(CubicSplineShape, pipe.outer)
    with inner_col:
        st.markdown("**Inner**")
        inner = _spline_inputs(
            "Inner",
            f"{key_prefix}_inner",
            inner_defaults,
            on_change=_mark_transition_dirty,
            on_change_args=on_change_args,
        )
    with outer_col:
        st.markdown("**Outer**")
        outer = _spline_inputs(
            "Outer",
            f"{key_prefix}_outer",
            outer_defaults,
            on_change=_mark_transition_dirty,
            on_change_args=on_change_args,
        )
    return SplineSpline(outer=outer, inner=inner)


def _render_single_pipe_editor_rows(show_markers: bool, padding: float) -> None:
    editable_pipes = st.session_state["editable_pipes"]
    common_limits = get_common_limits(editable_pipes, padding=padding)

    for idx, pipe in enumerate(editable_pipes):
        figure_col, editor_col = st.columns([2, 3])

        with figure_col:
            figure = plot_pipe(
                pipe,
                title=f"Pipe {idx + 1}",
                show=False,
                show_markers=show_markers,
                limits=common_limits,
            )
            st.pyplot(figure, clear_figure=True, width="stretch")
            plt.close(figure)

        with editor_col:
            st.markdown(f"**Pipe {idx + 1}**")
            st.text("\n".join(_pipe_lines(pipe, idx)))
            with st.form(f"single_pipe_edit_{idx}"):
                updated_pipe = _edit_pipe_inputs(pipe, key_prefix=f"single_edit_{idx}")
                submitted = st.form_submit_button("Save changes")

            if submitted:
                st.session_state["editable_pipes"][idx] = updated_pipe
                st.rerun()

            if st.button(f"Delete Pipe {idx + 1}", key=f"single_delete_{idx}"):
                st.session_state["editable_pipes"].pop(idx)
                _reset_debounce_state()
                st.rerun()

        st.divider()


@st.fragment
def _render_transition_rows(
    show_markers: bool,
    padding: float,
    debounce_seconds: float,
) -> None:
    editable_pipes = st.session_state["editable_pipes"]
    if len(editable_pipes) < 2:
        st.info("At least two pipes are needed for transition plots.")
        _render_single_pipe_editor_rows(show_markers=show_markers, padding=padding)
        return

    common_limits = get_common_limits(editable_pipes, padding=padding)
    analysis = ProcessAnalysis(editable_pipes)
    reductions = analysis.area_reductions
    ecc_diffs = analysis.eccentricity_diffs
    thickness_reductions = analysis.thickness_reductions
    pending_updates: dict[int, tuple[Pipe, Pipe]] = {}

    for idx in range(len(editable_pipes) - 1):
        left_idx = idx
        right_idx = idx + 1
        left_pipe = editable_pipes[left_idx]
        right_pipe = editable_pipes[right_idx]

        figure_col, editor_col = st.columns([2, 3])

        with figure_col:
            fig, ax = plt.subplots(figsize=TRANSITION_FIGURE_SIZE)
            plot_single_process(
                ax,
                left_pipe,
                right_pipe,
                title=f"Transition: Pipe {left_idx + 1} -> Pipe {right_idx + 1}",
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

        with editor_col:
            st.markdown(f"**Edit Transition {left_idx + 1} -> {right_idx + 1}**")
            pipe_cols = st.columns(2)
            with pipe_cols[0]:
                st.markdown(f"**Pipe {left_idx + 1}**")
                updated_left_pipe = _edit_pipe_inputs_live(
                    left_pipe,
                    key_prefix=f"transition_{idx}_left",
                    transition_idx=idx,
                )
            with pipe_cols[1]:
                st.markdown(f"**Pipe {right_idx + 1}**")
                updated_right_pipe = _edit_pipe_inputs_live(
                    right_pipe,
                    key_prefix=f"transition_{idx}_right",
                    transition_idx=idx,
                )

            pending_updates[idx] = (updated_left_pipe, updated_right_pipe)

            edit_seq = st.session_state.get("transition_edit_seq", {})
            applied_seq = st.session_state.get("transition_applied_seq", {})
            last_change_at = st.session_state.get("transition_last_change_at", {})
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

            delete_cols = st.columns(2)
            if delete_cols[0].button(
                f"Delete Pipe {left_idx + 1}",
                key=f"transition_delete_left_{idx}",
            ):
                st.session_state["editable_pipes"].pop(left_idx)
                _reset_debounce_state()
                st.rerun()

            if delete_cols[1].button(
                f"Delete Pipe {right_idx + 1}",
                key=f"transition_delete_right_{idx}",
            ):
                st.session_state["editable_pipes"].pop(right_idx)
                _reset_debounce_state()
                st.rerun()

        st.divider()

    # Store pending updates for the debounce poller to apply when ready.
    st.session_state["pending_pipe_updates"] = pending_updates


@st.fragment(run_every=0.5)
def _debounce_poller(debounce_seconds: float) -> None:
    """Lightweight polling fragment that does zero rendering.

    Checks whether any dirty transitions have waited long enough past the
    debounce window.  If so, applies the pending pipe updates stored in
    session state and triggers a full app rerun so plots regenerate once.
    """
    edit_seq = st.session_state.get("transition_edit_seq", {})
    applied_seq = st.session_state.get("transition_applied_seq", {})
    last_change_at = st.session_state.get("transition_last_change_at", {})
    pending_updates = st.session_state.get("pending_pipe_updates", {})

    if not pending_updates:
        return

    any_applied = False
    for transition_idx, (updated_left, updated_right) in pending_updates.items():
        current_seq = int(edit_seq.get(transition_idx, 0))
        current_applied_seq = int(applied_seq.get(transition_idx, 0))
        changed_at = last_change_at.get(transition_idx)

        if current_seq <= current_applied_seq or not isinstance(changed_at, float):
            continue

        elapsed = time.monotonic() - changed_at
        if elapsed < debounce_seconds:
            continue

        st.session_state["editable_pipes"][transition_idx] = updated_left
        st.session_state["editable_pipes"][transition_idx + 1] = updated_right
        applied_seq[transition_idx] = current_seq
        any_applied = True

    if any_applied:
        st.session_state["pending_pipe_updates"] = {}
        st.rerun(scope="app")


def main() -> None:
    st.set_page_config(page_title="Drawing Pipe", layout="wide")
    st.title("Drawing Pipe Process Explorer")
    template_options = _load_template_options()
    if not template_options:
        st.error("No pipe templates found in fixtures.py")
        return

    _init_editable_pipes(template_options)
    default_template_name = _default_template_name(template_options)

    with st.sidebar:
        st.header("Controls")
        selected_name = st.selectbox(
            "Template",
            list(template_options.keys()),
            index=list(template_options.keys()).index(default_template_name),
        )
        if st.button("Load template"):
            st.session_state["editable_pipes"] = list(template_options[selected_name])
            _reset_debounce_state()
            st.rerun()

        show_markers = st.checkbox("Show markers", value=True)
        debounce_seconds = st.slider(
            "Edit debounce (seconds)",
            min_value=0.5,
            max_value=2.0,
            value=1.0,
            step=0.1,
        )
        padding = st.slider(
            "Padding",
            min_value=0.00,
            max_value=0.50,
            value=constants.DEFAULT_PADDING,
            step=0.01,
        )
        _render_add_pipe_form()

    editable_pipes = st.session_state["editable_pipes"]
    if not editable_pipes:
        st.info("No pipes in the process. Load a template or add a new pipe.")
        return

    st.subheader("Transition Figures")
    st.caption("Transition edits auto-apply after idle debounce.")
    _render_transition_rows(
        show_markers=show_markers,
        padding=padding,
        debounce_seconds=debounce_seconds,
    )
    _debounce_poller(debounce_seconds=debounce_seconds)


if __name__ == "__main__":
    main()
