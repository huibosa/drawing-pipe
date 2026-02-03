"""Example usage of the drawing pipe library."""

from pipes import CircleCircle, CircleSquare, RectSquare

from shapes import Circle, Rect, Square
from visualization import plot_overlapping_pipes


def main():
    # Define pipe stages
    rough = CircleCircle(
        outer=Circle(origin=(0.0, 0.0), diameter=105.0),
        inner=Circle(origin=(0.0, 0.0), diameter=68.0),
    )

    intermediate1 = CircleSquare(
        outer=Circle(origin=(0.0, 2.0), diameter=93.0),
        inner=Square(origin=(0.0, 0.0), side_length=50.0),
    )

    # intermediate2 = EllipseSquare(
    #     outer=Ellipse(origin=(0.0, 2.0), major_axis=95.0, minor_axis=88.0),
    #     inner=Square(origin=(0.0, 0.0), side_length=50.0),
    # )

    finish_thickness_8 = RectSquare(
        outer=Rect(origin=(0.0, 2.5), length=64.0, width=58.0),
        inner=Square(origin=(0.0, 0.0), side_length=44.0),
    )

    # Plot the sequence
    plot_overlapping_pipes([rough, intermediate1, finish_thickness_8])


if __name__ == "__main__":
    main()
