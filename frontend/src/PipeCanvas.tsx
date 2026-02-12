import { Circle, Layer, Line, Stage } from "react-konva"
import { clamp, vertices } from "./geometry"
import type { Bounds, HandleTarget, Pipe, Shape } from "./types"

type PipeCanvasProps = {
  pipe: Pipe
  bounds: Bounds
  showMarkers: boolean
  size?: number
  onChange: (pipe: Pipe) => void
}

type Handle = {
  key: string
  x: number
  y: number
  target: HandleTarget
  kind: "origin" | "radius" | "corner" | "v1" | "v2" | "v3"
}

const DEFAULT_SIZE = 320

function project(point: [number, number], bounds: Bounds, size: number): [number, number] {
  const [x, y] = point
  const width = Math.max(bounds.maxX - bounds.minX, 1)
  const height = Math.max(bounds.maxY - bounds.minY, 1)
  const px = ((x - bounds.minX) / width) * size
  const py = ((bounds.maxY - y) / height) * size
  return [px, py]
}

function unproject(point: [number, number], bounds: Bounds, size: number): [number, number] {
  const [px, py] = point
  const width = Math.max(bounds.maxX - bounds.minX, 1)
  const height = Math.max(bounds.maxY - bounds.minY, 1)
  const x = bounds.minX + (px / size) * width
  const y = bounds.maxY - (py / size) * height
  return [x, y]
}

function shapeLine(shape: Shape, bounds: Bounds, size: number): number[] {
  return vertices(shape).flatMap((point) => project(point, bounds, size))
}

function handlesForShape(shape: Shape, target: HandleTarget): Handle[] {
  if (shape.shape_type === "Circle") {
    return [
      {
        key: `${target}_origin`,
        x: shape.origin[0],
        y: shape.origin[1],
        target,
        kind: "origin",
      },
      {
        key: `${target}_radius`,
        x: shape.origin[0] + shape.diameter / 2,
        y: shape.origin[1],
        target,
        kind: "radius",
      },
    ]
  }

  if (shape.shape_type === "Rect") {
    return [
      {
        key: `${target}_origin`,
        x: shape.origin[0],
        y: shape.origin[1],
        target,
        kind: "origin",
      },
      {
        key: `${target}_corner`,
        x: shape.origin[0] + shape.width / 2,
        y: shape.origin[1] + shape.length / 2,
        target,
        kind: "corner",
      },
    ]
  }

  return [
    {
      key: `${target}_origin`,
      x: shape.origin[0],
      y: shape.origin[1],
      target,
      kind: "origin",
    },
    {
      key: `${target}_v1`,
      x: shape.origin[0] + shape.v1[0],
      y: shape.origin[1] + shape.v1[1],
      target,
      kind: "v1",
    },
    {
      key: `${target}_v2`,
      x: shape.origin[0] + shape.v2[0],
      y: shape.origin[1] + shape.v2[1],
      target,
      kind: "v2",
    },
    {
      key: `${target}_v3`,
      x: shape.origin[0] + shape.v3[0],
      y: shape.origin[1] + shape.v3[1],
      target,
      kind: "v3",
    },
  ]
}

function updateShapeFromHandle(shape: Shape, kind: Handle["kind"], next: [number, number]): Shape {
  if (shape.shape_type === "Circle") {
    if (kind === "origin") {
      return { ...shape, origin: next }
    }
    const dx = next[0] - shape.origin[0]
    const dy = next[1] - shape.origin[1]
    const diameter = clamp(2 * Math.hypot(dx, dy), 0.01)
    return { ...shape, diameter }
  }

  if (shape.shape_type === "Rect") {
    if (kind === "origin") {
      return { ...shape, origin: next }
    }
    const width = clamp(2 * Math.abs(next[0] - shape.origin[0]), 0.01)
    const length = clamp(2 * Math.abs(next[1] - shape.origin[1]), 0.01)
    return { ...shape, width, length }
  }

  if (kind === "origin") {
    return { ...shape, origin: next }
  }
  if (kind === "v1") {
    return {
      ...shape,
      v1: [next[0] - shape.origin[0], next[1] - shape.origin[1]],
    }
  }
  if (kind === "v2") {
    return {
      ...shape,
      v2: [next[0] - shape.origin[0], next[1] - shape.origin[1]],
    }
  }
  if (kind === "v3") {
    return {
      ...shape,
      v3: [next[0] - shape.origin[0], next[1] - shape.origin[1]],
    }
  }
  return shape
}

export function PipeCanvas({
  pipe,
  bounds,
  showMarkers,
  size = DEFAULT_SIZE,
  onChange,
}: PipeCanvasProps): JSX.Element {
  const handles = [
    ...handlesForShape(pipe.outer, "outer"),
    ...handlesForShape(pipe.inner, "inner"),
  ]

  return (
    <Stage width={size} height={size} className="pipe-stage">
      <Layer>
        <Line points={shapeLine(pipe.outer, bounds, size)} stroke="#174a95" strokeWidth={2.5} closed />
        <Line points={shapeLine(pipe.inner, bounds, size)} stroke="#0c8a61" strokeWidth={2} closed />

        {showMarkers
          ? handles.map((handle) => {
              const [x, y] = project([handle.x, handle.y], bounds, size)
              const fill = handle.target === "outer" ? "#174a95" : "#0c8a61"
              return (
                <Circle
                  key={handle.key}
                  x={x}
                  y={y}
                  radius={5}
                  fill={fill}
                  draggable
                  onDragMove={(event) => {
                    const world = unproject([event.target.x(), event.target.y()], bounds, size)
                    const updatedShape =
                      handle.target === "outer"
                        ? updateShapeFromHandle(pipe.outer, handle.kind, world)
                        : updateShapeFromHandle(pipe.inner, handle.kind, world)
                    if (handle.target === "outer") {
                      onChange({ ...pipe, outer: updatedShape })
                    } else {
                      onChange({ ...pipe, inner: updatedShape })
                    }
                  }}
                />
              )
            })
          : null}
      </Layer>
    </Stage>
  )
}
