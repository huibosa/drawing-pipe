from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class CirclePayload(BaseModel):
    model_config = ConfigDict(extra="forbid")

    shape_type: Literal["Circle"]
    origin: tuple[float, float]
    diameter: float = Field(gt=0)


class RectPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")

    shape_type: Literal["Rect"]
    origin: tuple[float, float]
    length: float = Field(gt=0)
    width: float = Field(gt=0)
    fillet_radius: float = Field(gt=0)


class SplinePayload(BaseModel):
    model_config = ConfigDict(extra="forbid")

    shape_type: Literal["CubicSplineShape"]
    origin: tuple[float, float]
    v1: tuple[float, float]
    v2: tuple[float, float]
    v3: tuple[float, float]


ShapePayload = CirclePayload | RectPayload | SplinePayload


class PipePayload(BaseModel):
    model_config = ConfigDict(extra="forbid")

    pipe_type: Literal["CircleCircle", "RectRect", "SplineSpline"]
    outer: ShapePayload
    inner: ShapePayload


class ProfilePayload(BaseModel):
    model_config = ConfigDict(extra="forbid")

    version: int = 1
    pipes: list[PipePayload]


class AnalyzeResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    area_reductions: list[float]
    eccentricity_diffs: list[float]
    thickness_reductions: list[list[float]]


class TemplatesResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    templates: dict[str, list[PipePayload]]
