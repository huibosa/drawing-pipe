import { clamp } from "./geometry"
import type { CircleShape, Pipe, PipeType, RectShape, Shape, SplineShape } from "../types/domain"

function inferCircle(shape: Shape): CircleShape {
  if (shape.shape_type === "Circle") {
    return shape
  }
  if (shape.shape_type === "Rect") {
    return {
      shape_type: "Circle",
      origin: shape.origin,
      diameter: clamp(Math.min(shape.length, shape.width), 0.01),
    }
  }

  const diameter = 2 * Math.max(Math.abs(shape.v1[1]), Math.abs(shape.v2[0]), Math.abs(shape.v3[0]))
  return {
    shape_type: "Circle",
    origin: shape.origin,
    diameter: clamp(diameter, 0.01),
  }
}

function inferRect(shape: Shape): RectShape {
  if (shape.shape_type === "Rect") {
    return shape
  }
  if (shape.shape_type === "Circle") {
    return {
      shape_type: "Rect",
      origin: shape.origin,
      length: clamp(shape.diameter, 0.01),
      width: clamp(shape.diameter, 0.01),
      fillet_radius: 2.5,
    }
  }

  const length = clamp(2 * Math.max(Math.abs(shape.v1[1]), Math.abs(shape.v2[1])), 0.01)
  const width = clamp(2 * Math.max(Math.abs(shape.v2[0]), Math.abs(shape.v3[0])), 0.01)
  return {
    shape_type: "Rect",
    origin: shape.origin,
    length,
    width,
    fillet_radius: clamp(Math.min(2.5, length / 4, width / 4), 0.01),
  }
}

function inferSpline(shape: Shape): SplineShape {
  if (shape.shape_type === "CubicSplineShape") {
    return shape
  }

  const halfWidth = shape.shape_type === "Circle" ? shape.diameter / 2 : shape.width / 2
  const halfHeight = shape.shape_type === "Circle" ? shape.diameter / 2 : shape.length / 2

  return {
    shape_type: "CubicSplineShape",
    origin: shape.origin,
    v1: [0, clamp(halfHeight, 0.01)],
    v2: [clamp(halfWidth / 1.5, 0.01), clamp(halfHeight / 1.5, 0.01)],
    v3: [clamp(halfWidth, 0.01), 0],
  }
}

export function pipeTypeName(pipe: Pipe): PipeType {
  return pipe.pipe_type
}

export function convertPipeType(pipe: Pipe, pipeType: PipeType): Pipe {
  if (pipe.pipe_type === pipeType) {
    return pipe
  }

  if (pipeType === "CircleCircle") {
    return {
      pipe_type: "CircleCircle",
      outer: inferCircle(pipe.outer),
      inner: inferCircle(pipe.inner),
    }
  }
  if (pipeType === "RectRect") {
    return {
      pipe_type: "RectRect",
      outer: inferRect(pipe.outer),
      inner: inferRect(pipe.inner),
    }
  }
  return {
    pipe_type: "SplineSpline",
    outer: inferSpline(pipe.outer),
    inner: inferSpline(pipe.inner),
  }
}

export function duplicatePipe(pipe: Pipe): Pipe {
  return structuredClone(pipe)
}
