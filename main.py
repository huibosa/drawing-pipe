"""Example usage of the drawing pipe library."""

from fixtures import ELLIPSE_SQUARE_1, ELLIPSE_SQUARE_2, FINISH_3, ROUGH
from visualization import plot_overlapping_pipes


def main():
    # Plot the sequence
    plot_overlapping_pipes([ROUGH, ELLIPSE_SQUARE_1, ELLIPSE_SQUARE_2, FINISH_3])


if __name__ == "__main__":
    main()
