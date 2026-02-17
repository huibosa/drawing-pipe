from __future__ import annotations

from typing import cast

from drawing_pipe.api import template_repository
from drawing_pipe.api.schemas import (
    CirclePayload,
    PipePayload,
    RectPayload,
    SplinePayload,
)
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


def load_templates() -> dict[str, list[PipePayload]]:
    templates = template_repository.load_template_payloads()
    return {
        name: [pipe.model_copy(deep=True) for pipe in pipes]
        for name, pipes in templates.items()
    }
