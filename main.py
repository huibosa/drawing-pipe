from typing import List

import matplotlib.patches as patches
import matplotlib.path as mpath
import matplotlib.pyplot as plt
import numpy as np


# --- 1. Shape Classes ---
class Shape:
    origin: tuple[float, float]

    @property
    def area(self) -> float: ...


class Circle(Shape):
    def __init__(self, origin: tuple[float, float], diameter: float) -> None:
        self.origin = origin
        self.diameter = diameter

    @property
    def area(self) -> float:
        return (self.diameter / 2) ** 2 * np.pi


class Square(Shape):
    def __init__(
        self,
        origin: tuple[float, float],
        side_length: float,
        fillet_radius: float = 2.5,
    ) -> None:
        self.origin = origin
        self.side_length = side_length
        self.fillet_radius = fillet_radius

    @property
    def area(self) -> float:
        r = self.fillet_radius
        base_area = self.side_length**2
        corner_correction = (4 * r**2) - (np.pi * r**2)
        return base_area - corner_correction


class Rect(Shape):
    def __init__(
        self,
        origin: tuple[float, float],
        length: float,
        width: float,
        fillet_radius: float = 2.5,
    ) -> None:
        self.origin = origin
        self.length = length
        self.width = width
        self.fillet_radius = fillet_radius

    @property
    def area(self) -> float:
        r = self.fillet_radius
        base_area = self.length * self.width
        corner_correction = (4 * r**2) - (np.pi * r**2)
        return base_area - corner_correction


# --- 2. Pipe Classes ---
class Pipe:
    def __init__(self, outer: Shape, inner: Shape) -> None:
        self.outer = outer
        self.inner = inner

    @property
    def area(self) -> float:
        return self.outer.area - self.inner.area

    @property
    def eccentricity(self) -> float:
        orgin1 = np.array(self.outer.origin)
        orgin2 = np.array(self.inner.origin)
        return float(np.linalg.norm(orgin1 - orgin2))


class CircleCircle(Pipe):
    def __init__(self, outer: Circle, inner: Circle) -> None:
        super().__init__(outer, inner)


class CircleSquare(Pipe):
    def __init__(self, outer: Circle, inner: Square) -> None:
        super().__init__(outer, inner)


class RectSquare(Pipe):
    def __init__(self, outer: Rect, inner: Square) -> None:
        super().__init__(outer, inner)


# --- 3. Analysis Class ---
class ProcessPipeline:
    def __init__(self, *shapes: Pipe) -> None:
        self.shapes = shapes

    @property
    def area_reductions(self) -> list[float]:
        shapes = self.shapes
        ret: list[float] = []
        for initial, final in zip(shapes[:-1], shapes[1:]):
            reduction = (initial.area - final.area) / initial.area
            ret.append(reduction)
        return ret

    @property
    def eccentricity_diffs(self) -> list[float]:
        shapes = self.shapes
        ret: list[float] = []
        for initial, final in zip(shapes[:-1], shapes[1:]):
            ret.append(initial.eccentricity - final.eccentricity)
        return ret


# --- 4. Plotting Logic ---
def generate_rounded_rect_verts(
    center: tuple[float, float], width: float, height: float, radius: float
) -> np.ndarray:
    cx, cy = center
    hw, hh = width / 2, height / 2
    max_r = min(hw, hh)
    r = min(radius, max_r)
    arc_points = 15
    theta = np.linspace(0, np.pi / 2, arc_points)
    tr_x = (cx + hw - r) + r * np.cos(theta)
    tr_y = (cy + hh - r) + r * np.sin(theta)
    tl_x = (cx - hw + r) + r * np.cos(theta + np.pi / 2)
    tl_y = (cy + hh - r) + r * np.sin(theta + np.pi / 2)
    bl_x = (cx - hw + r) + r * np.cos(theta + np.pi)
    bl_y = (cy - hh + r) + r * np.sin(theta + np.pi)
    br_x = (cx + hw - r) + r * np.cos(theta + 3 * np.pi / 2)
    br_y = (cy - hh + r) + r * np.sin(theta + 3 * np.pi / 2)
    x = np.concatenate([tr_x, tl_x, bl_x, br_x])
    y = np.concatenate([tr_y, tl_y, bl_y, br_y])
    return np.column_stack([x, y])


def get_vertices(shape: Shape, clockwise: bool = False) -> np.ndarray:
    cx, cy = shape.origin
    if isinstance(shape, Circle):
        theta = np.linspace(0, 2 * np.pi, 100)
        radius = shape.diameter / 2
        x = cx + radius * np.cos(theta)
        y = cy + radius * np.sin(theta)
        verts = np.column_stack([x, y])
    elif isinstance(shape, Square):
        verts = generate_rounded_rect_verts(
            shape.origin, shape.side_length, shape.side_length, shape.fillet_radius
        )
    elif isinstance(shape, Rect):
        verts = generate_rounded_rect_verts(
            shape.origin, shape.width, shape.length, shape.fillet_radius
        )
    else:
        return np.array([])
    if clockwise:
        verts = verts[::-1]
    return verts


def create_pipe_patch(
    pipe: Pipe,
    color: str,
    alpha: float,
    label: str,
    fill: bool = True,
    linestyle: str = "solid",
):
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


def plot_overlapping_pipes(pipes: List[Pipe]):
    """
    Plots pipes.
    - If 1 item: Single plot, filled.
    - If >= 2 items: pairwise comparisons (Pipe 1 vs 2, Pipe 2 vs 3).
      The SECOND pipe is DASHED and HOLLOW.
      Metrics (Area Reduction, Eccentricity Diff) are shown in the xlabel.
    """
    n_items = len(pipes)
    labels = [f"Pipe {i + 1}" for i in range(n_items)]
    # base_colors = ["#B0C4DE", "#F4A460", "#90EE90", "#FFB6C1", "#87CEFA"]
    base_colors = ["#B0C4DE", "#B0C4DE", "#B0C4DE", "#B0C4DE", "#B0C4DE"]
    base_alphas = [0.4, 0.5, 0.6, 0.7, 0.8]

    # --- Metrics Calculation ---
    pipeline = ProcessPipeline(*pipes)
    reductions = pipeline.area_reductions
    ecc_diffs = pipeline.eccentricity_diffs

    def _draw_on_axis(
        ax,
        pipe_subset,
        label_subset,
        colors,
        alphas,
        custom_styles=None,
        metrics_str="",
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
        ax.autoscale_view()
        ax.grid(True, linestyle="--", alpha=0.5)

        # Set the metrics info as the xlabel
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
            # Get metrics for the single transition (0 -> 1)
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

            # Get metrics for this specific transition
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
            )
            ax.set_title(f"Transition: {l_sub[0]} → {l_sub[1]}", fontsize=11)

    plt.tight_layout()
    plt.show()


# --- Execution ---
if __name__ == "__main__":
    rough = CircleCircle(
        Circle(origin=(0.0, 0.0), diameter=105.0),
        Circle(origin=(0.0, 0.0), diameter=68.0),
    )

    intermidiate1 = CircleSquare(
        Circle(origin=(0.0, 2.0), diameter=93.0),
        Square(origin=(0.0, 0.0), side_length=50.0),
    )

    # finish_thickness_3 = RectSquare(
    #     Rect(origin=(0.0, 5.0), length=60.0, width=50.0),
    #     Square(origin=(0.0, 0.0), side_length=44.0),
    # )

    # finish_thickness_6 = RectSquare(
    #     Rect(origin=(0.0, 3.5), length=63.0, width=56.0),
    #     Square(origin=(0.0, 0.0), side_length=44.0),
    # )

    finish_thickness_8 = RectSquare(
        Rect(origin=(0.0, 2.5), length=64.0, width=58.0),
        Square(origin=(0.0, 0.0), side_length=44.0),
    )

    # Plot sequence
    plot_overlapping_pipes([rough, intermidiate1, finish_thickness_8])
