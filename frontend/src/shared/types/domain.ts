export type PipeType = "CircleCircle" | "RectRect" | "SplineSpline"

export type CircleShape = {
  shape_type: "Circle"
  origin: [number, number]
  diameter: number
}

export type RectShape = {
  shape_type: "Rect"
  origin: [number, number]
  length: number
  width: number
  fillet_radius: number
}

export type SplineShape = {
  shape_type: "CubicSplineShape"
  origin: [number, number]
  v1: [number, number]
  v2: [number, number]
  v3: [number, number]
}

export type Shape = CircleShape | RectShape | SplineShape

export type Pipe = {
  pipe_type: PipeType
  outer: Shape
  inner: Shape
}

export type Profile = {
  version: number
  pipes: Pipe[]
}

export type AnalyzeResponse = {
  area_reductions: number[]
  eccentricity_diffs: number[]
  thickness_reductions: number[][]
}

export type Bounds = {
  minX: number
  maxX: number
  minY: number
  maxY: number
}

export type HandleTarget = "outer" | "inner"

export type CircleHandleKind = "origin" | "radius"
export type RectHandleKind = "origin" | "corner"
export type SplineHandleKind = "origin" | "v1" | "v2" | "v3"
