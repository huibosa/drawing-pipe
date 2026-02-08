from pipes import CircleCircle, RectSquare, SplineSpline

from shapes import Circle, CubicSplineShape, Rect

FINISH_3 = RectSquare(
    outer=Rect(origin=(0.0, 5.0), length=60.0, width=50.0),
    inner=Rect(origin=(0.0, 0.0), length=44.0, width=44.0),
)

FINISH_6 = RectSquare(
    outer=Rect(origin=(0.0, 3.5), length=63.0, width=56.0),
    inner=Rect(origin=(0.0, 0.0), length=44.0, width=44.0),
)

FINISH_8 = RectSquare(
    outer=Rect(origin=(0.0, 2.5), length=65.0, width=60.0),
    inner=Rect(origin=(0.0, 0.0), length=44.0, width=44.0),
)

PROCESS = [
    CircleCircle(
        outer=Circle(origin=(0.0, 0.0), diameter=85.0),
        inner=Circle(origin=(0.0, 0.0), diameter=53.0),
    ),
    SplineSpline(
        outer=CubicSplineShape(
            origin=(0.0, 0.9), v1=(0.0, 38.55), v2=(30.1, 30.2), v3=(37.4, 0.0)
        ),
        inner=CubicSplineShape(
            origin=(0.0, 0.0), v1=(0.0, 25.8), v2=(19.4, 19.4), v3=(25.8, 0.0)
        ),
    ),
    SplineSpline(
        outer=CubicSplineShape(
            origin=(0.0, 1.7), v1=(0.0, 36.4), v2=(29.3, 30.2), v3=(33.6, 0.0)
        ),
        inner=CubicSplineShape(
            origin=(0.0, 0.0), v1=(0.0, 24.5), v2=(19.7, 19.7), v3=(23.5, 0.0)
        ),
    ),
    SplineSpline(
        outer=CubicSplineShape(
            origin=(0.0, 2.15), v1=(0.0, 34.7), v2=(28.2, 30.2), v3=(32.5, 0.0)
        ),
        inner=CubicSplineShape(
            origin=(0.0, 0.0), v1=(0.0, 23.7), v2=(19.6, 19.6), v3=(24.0, 0.0)
        ),
    ),
    RectSquare(
        outer=Rect(origin=(0.0, 2.5), length=65.0, width=60.0),
        inner=Rect(origin=(0.0, 0.0), length=44.0, width=44.0),
    ),
]
