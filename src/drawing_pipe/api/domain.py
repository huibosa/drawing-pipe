from __future__ import annotations

from typing import cast

from drawing_pipe.api.schemas import (
    CirclePayload,
    PipePayload,
    RectPayload,
    SplinePayload,
)
from drawing_pipe.core import fixtures
from drawing_pipe.core.pipes import CircleCircle, Pipe, RectRect, SplineSpline
from drawing_pipe.core.shapes import Circle, CubicSplineShape, Rect


def shape_from_payload(
    payload: CirclePayload | RectPayload | SplinePayload,
) -> Circle | Rect | CubicSplineShape:
    if isinstance(payload, CirclePayload):
        return Circle(origin=payload.origin, diameter=payload.diameter)
    if isinstance(payload, RectPayload):
        return Rect(
            origin=payload.origin,
            length=payload.length,
            width=payload.width,
            fillet_radius=payload.fillet_radius,
        )
    return CubicSplineShape(
        origin=payload.origin,
        v1=payload.v1,
        v2=payload.v2,
        v3=payload.v3,
    )


def shape_to_payload(
    shape: Circle | Rect | CubicSplineShape,
) -> CirclePayload | RectPayload | SplinePayload:
    if isinstance(shape, Circle):
        return CirclePayload(
            shape_type="Circle",
            origin=shape.origin,
            diameter=shape.diameter,
        )
    if isinstance(shape, Rect):
        return RectPayload(
            shape_type="Rect",
            origin=shape.origin,
            length=shape.length,
            width=shape.width,
            fillet_radius=shape.fillet_radius,
        )
    return SplinePayload(
        shape_type="CubicSplineShape",
        origin=shape.origin,
        v1=shape.v1,
        v2=shape.v2,
        v3=shape.v3,
    )


def pipe_from_payload(payload: PipePayload) -> Pipe:
    outer = shape_from_payload(payload.outer)
    inner = shape_from_payload(payload.inner)

    if payload.pipe_type == "CircleCircle":
        return CircleCircle(outer=cast(Circle, outer), inner=cast(Circle, inner))
    if payload.pipe_type == "RectRect":
        return RectRect(outer=cast(Rect, outer), inner=cast(Rect, inner))
    return SplineSpline(
        outer=cast(CubicSplineShape, outer),
        inner=cast(CubicSplineShape, inner),
    )


def pipe_to_payload(pipe: Pipe) -> PipePayload:
    if isinstance(pipe, CircleCircle):
        pipe_type = "CircleCircle"
    elif isinstance(pipe, RectRect):
        pipe_type = "RectRect"
    else:
        pipe_type = "SplineSpline"

    return PipePayload(
        pipe_type=pipe_type,
        outer=shape_to_payload(cast(Circle | Rect | CubicSplineShape, pipe.outer)),
        inner=shape_to_payload(cast(Circle | Rect | CubicSplineShape, pipe.inner)),
    )


def load_templates() -> dict[str, list[PipePayload]]:
    templates: dict[str, list[PipePayload]] = {}
    for name, value in sorted(vars(fixtures).items()):
        if name.startswith("_"):
            continue
        if isinstance(value, Pipe):
            templates[name] = [pipe_to_payload(value)]
            continue
        if (
            isinstance(value, list)
            and value
            and all(isinstance(item, Pipe) for item in value)
        ):
            templates[name] = [pipe_to_payload(pipe) for pipe in value]
    return templates
