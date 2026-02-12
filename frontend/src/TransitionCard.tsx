import { useRef, useState } from "react"
import { vertices } from "./geometry"
import type { Bounds, Pipe } from "./types"

type TransitionCardProps = {
  leftPipe: Pipe
  rightPipe: Pipe
  onLeftPipeChange: (pipe: Pipe) => void
  onRightPipeChange: (pipe: Pipe) => void
  title: string
  bounds: Bounds
  showMarkers: boolean
  markerSize: number
  plotLineWidth: number
  areaReduction: number | null
  eccentricityDiff: number | null
  thicknessReduction: number[] | null
}

const SIZE = 260

function snapStep(value: number, step = 0.05): number {
  return Number((Math.round(value / step) * step).toFixed(6))
}

type MarkerMeta = {
  key: string
  side: "left" | "right"
  kind: "shape" | "center"
  shapeKey: "outer" | "inner"
  markerIndex: number
  point: [number, number]
}

type ActiveMarker = {
  side: "left" | "right"
  kind: "shape" | "center"
  shapeKey: "outer" | "inner"
  markerIndex: number
}

type Viewport = {
  scale: number
  offsetX: number
  offsetY: number
}

function viewportFromBounds(bounds: Bounds): Viewport {
  const width = Math.max(bounds.maxX - bounds.minX, 1)
  const height = Math.max(bounds.maxY - bounds.minY, 1)
  const span = Math.max(width, height)
  const scale = SIZE / span
  const centerX = (bounds.minX + bounds.maxX) / 2
  const centerY = (bounds.minY + bounds.maxY) / 2
  const offsetX = SIZE / 2 - centerX * scale
  const offsetY = SIZE / 2 + centerY * scale
  return { scale, offsetX, offsetY }
}

function project(point: [number, number], viewport: Viewport): [number, number] {
  const [x, y] = point
  return [x * viewport.scale + viewport.offsetX, -y * viewport.scale + viewport.offsetY]
}

function toPath(points: [number, number][]): string {
  if (points.length === 0) {
    return ""
  }
  const [start, ...rest] = points
  const startText = `M ${start[0].toFixed(2)} ${start[1].toFixed(2)}`
  const segmentText = rest.map(([x, y]) => `L ${x.toFixed(2)} ${y.toFixed(2)}`).join(" ")
  return `${startText} ${segmentText} Z`
}

function shapePath(pipe: Pipe, key: "outer" | "inner", viewport: Viewport): string {
  const points = vertices(pipe[key]).map((point) => project(point, viewport))
  return toPath(points)
}

function markerPoints(pipe: Pipe, key: "outer" | "inner"): [number, number][] {
  const shape = pipe[key]
  if (shape.shape_type === "Circle") {
    const [ox, oy] = shape.origin
    const radius = shape.diameter / 2
    const diag = Math.SQRT1_2 * radius
    return [
      [ox, oy + radius],
      [ox + diag, oy + diag],
      [ox + radius, oy],
      [ox + diag, oy - diag],
      [ox, oy - radius],
    ]
  }

  if (shape.shape_type === "Rect") {
    const [ox, oy] = shape.origin
    return [
      [ox, oy + shape.length / 2],
      [ox + shape.width / 2 - shape.fillet_radius, oy + shape.length / 2 - shape.fillet_radius],
      [ox + shape.width / 2, oy],
      [ox + shape.width / 2 - shape.fillet_radius, oy - shape.length / 2 + shape.fillet_radius],
      [ox, oy - shape.length / 2],
    ]
  }

  const [ox, oy] = shape.origin
  return [
    [shape.v1[0] + ox, shape.v1[1] + oy],
    [shape.v2[0] + ox, shape.v2[1] + oy],
    [shape.v3[0] + ox, shape.v3[1] + oy],
    [shape.v2[0] + ox, -shape.v2[1] + oy],
    [ox, -shape.v1[1] + oy],
  ]
}

function updateShapeByMarker(
  shape: Pipe["outer"],
  markerIndex: number,
  nextPoint: [number, number]
): Pipe["outer"] {
  const snapped: [number, number] = [snapStep(nextPoint[0]), snapStep(nextPoint[1])]

  if (shape.shape_type === "Circle") {
    const [ox, oy] = shape.origin
    const diameter = Math.max(0.01, 2 * Math.hypot(snapped[0] - ox, snapped[1] - oy))
    return { ...shape, diameter }
  }

  if (shape.shape_type === "Rect") {
    const [ox, oy] = shape.origin
    if (markerIndex === 0 || markerIndex === 4) {
      const nextLength = Math.max(0.01, 2 * Math.abs(snapped[1] - oy))
      return { ...shape, length: nextLength }
    }
    const nextWidth = Math.max(0.01, 2 * Math.abs(snapped[0] - ox))
    if (markerIndex === 2) {
      return { ...shape, width: nextWidth }
    }

    const nextLength = Math.max(0.01, 2 * Math.abs(snapped[1] - oy))
    return {
      ...shape,
      width: nextWidth,
      length: nextLength,
    }
  }

  const [ox, oy] = shape.origin
  if (markerIndex === 0) {
    return {
      ...shape,
      v1: [snapStep(snapped[0] - ox), snapStep(snapped[1] - oy)],
    }
  }
  if (markerIndex === 1 || markerIndex === 3) {
    return {
      ...shape,
      v2: [snapStep(snapped[0] - ox), snapStep(Math.abs(snapped[1] - oy))],
    }
  }
  if (markerIndex === 2) {
    return {
      ...shape,
      v3: [snapStep(snapped[0] - ox), snapStep(snapped[1] - oy)],
    }
  }
  return {
    ...shape,
    v1: [snapStep(snapped[0] - ox), snapStep(Math.abs(snapped[1] - oy))],
  }
}

function updatePipeByMarker(
  pipe: Pipe,
  shapeKey: "outer" | "inner",
  markerIndex: number,
  nextPoint: [number, number]
): Pipe {
  const shape = pipe[shapeKey]
  const updated = updateShapeByMarker(shape, markerIndex, nextPoint)
  return { ...pipe, [shapeKey]: updated }
}

function movePipeCenter(pipe: Pipe, nextCenter: [number, number]): Pipe {
  const [, cy] = pipe.outer.origin
  const targetY = snapStep(nextCenter[1])
  const dy = targetY - cy

  const moveShape = (shape: Pipe["outer"]): Pipe["outer"] => {
    const [, oy] = shape.origin
    return {
      ...shape,
      origin: [0, snapStep(oy + dy)],
    }
  }

  return {
    ...pipe,
    outer: moveShape(pipe.outer),
    inner: moveShape(pipe.inner),
  }
}

function toWorld(point: [number, number], viewport: Viewport): [number, number] {
  const x = (point[0] - viewport.offsetX) / viewport.scale
  const y = (viewport.offsetY - point[1]) / viewport.scale
  return [snapStep(x), snapStep(y)]
}

function metricText(value: number | null, suffix = ""): string {
  if (value === null || Number.isNaN(value)) {
    return "n/a"
  }
  return `${value.toFixed(4)}${suffix}`
}

export function TransitionCard({
  leftPipe,
  rightPipe,
  onLeftPipeChange,
  onRightPipeChange,
  title,
  bounds,
  showMarkers,
  markerSize,
  plotLineWidth,
  areaReduction,
  eccentricityDiff,
  thicknessReduction,
}: TransitionCardProps): JSX.Element {
  const svgRef = useRef<SVGSVGElement | null>(null)
  const draggingPointerId = useRef<number | null>(null)
  const [activeMarker, setActiveMarker] = useState<ActiveMarker | null>(null)
  const viewport = viewportFromBounds(bounds)

  const allMarkers: MarkerMeta[] = [
    ...markerPoints(leftPipe, "outer").map((point, markerIndex) => ({
      key: `left_outer_${markerIndex}`,
      side: "left" as const,
      kind: "shape" as const,
      shapeKey: "outer" as const,
      markerIndex,
      point,
    })),
    ...markerPoints(leftPipe, "inner").map((point, markerIndex) => ({
      key: `left_inner_${markerIndex}`,
      side: "left" as const,
      kind: "shape" as const,
      shapeKey: "inner" as const,
      markerIndex,
      point,
    })),
    {
      key: "left_center",
      side: "left" as const,
      kind: "center" as const,
      shapeKey: "outer" as const,
      markerIndex: -1,
      point: leftPipe.outer.origin,
    },
    ...markerPoints(rightPipe, "outer").map((point, markerIndex) => ({
      key: `right_outer_${markerIndex}`,
      side: "right" as const,
      kind: "shape" as const,
      shapeKey: "outer" as const,
      markerIndex,
      point,
    })),
    ...markerPoints(rightPipe, "inner").map((point, markerIndex) => ({
      key: `right_inner_${markerIndex}`,
      side: "right" as const,
      kind: "shape" as const,
      shapeKey: "inner" as const,
      markerIndex,
      point,
    })),
    {
      key: "right_center",
      side: "right" as const,
      kind: "center" as const,
      shapeKey: "outer" as const,
      markerIndex: -1,
      point: rightPipe.outer.origin,
    },
  ]

  const updateFromPointer = (clientX: number, clientY: number) => {
    if (!activeMarker || !svgRef.current) {
      return
    }
    const rect = svgRef.current.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) {
      return
    }
    const localX = ((clientX - rect.left) / rect.width) * SIZE
    const localY = ((clientY - rect.top) / rect.height) * SIZE
    const world = toWorld([localX, localY], viewport)

    if (activeMarker.side === "left") {
      if (activeMarker.kind === "center") {
        onLeftPipeChange(movePipeCenter(leftPipe, world))
      } else {
        onLeftPipeChange(
          updatePipeByMarker(leftPipe, activeMarker.shapeKey, activeMarker.markerIndex, world)
        )
      }
      return
    }
    if (activeMarker.kind === "center") {
      onRightPipeChange(movePipeCenter(rightPipe, world))
    } else {
      onRightPipeChange(
        updatePipeByMarker(rightPipe, activeMarker.shapeKey, activeMarker.markerIndex, world)
      )
    }
  }

  return (
    <section className="transition-card">
      <h3>{title}</h3>
      <svg
        ref={svgRef}
        width={SIZE}
        height={SIZE}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="transition-svg"
        onPointerMove={(event) => updateFromPointer(event.clientX, event.clientY)}
        onPointerUp={() => {
          if (draggingPointerId.current !== null) {
            svgRef.current?.releasePointerCapture(draggingPointerId.current)
            draggingPointerId.current = null
          }
          setActiveMarker(null)
        }}
        onPointerCancel={() => {
          if (draggingPointerId.current !== null) {
            svgRef.current?.releasePointerCapture(draggingPointerId.current)
            draggingPointerId.current = null
          }
          setActiveMarker(null)
        }}
      >
        <path
          d={shapePath(leftPipe, "outer", viewport)}
          stroke="#174a95"
          strokeWidth={plotLineWidth}
          fill="none"
        />
        <path
          d={shapePath(leftPipe, "inner", viewport)}
          stroke="#0c8a61"
          strokeWidth={plotLineWidth * 0.9}
          fill="none"
        />
        <path
          d={shapePath(rightPipe, "outer", viewport)}
          stroke="#d95f02"
          strokeWidth={plotLineWidth}
          fill="none"
          strokeDasharray="6 4"
        />
        <path
          d={shapePath(rightPipe, "inner", viewport)}
          stroke="#9442a3"
          strokeWidth={plotLineWidth * 0.9}
          fill="none"
          strokeDasharray="6 4"
        />
        {showMarkers
          ? allMarkers.map((marker) => {
              const [x, y] = project(marker.point, viewport)
              return (
                <circle
                  key={marker.key}
                  cx={x}
                  cy={y}
                  r={markerSize}
                  fill={marker.kind === "center" ? "#fef08a" : "#ffffff"}
                  stroke={marker.kind === "center" ? "#a16207" : "#2b3340"}
                  strokeWidth={1}
                  style={{ cursor: "grab" }}
                  onPointerDown={(event) => {
                    event.preventDefault()
                    draggingPointerId.current = event.pointerId
                    svgRef.current?.setPointerCapture(event.pointerId)
                    setActiveMarker({
                      side: marker.side,
                      kind: marker.kind,
                      shapeKey: marker.shapeKey,
                      markerIndex: marker.markerIndex,
                    })
                  }}
                />
              )
            })
          : null}
      </svg>
      <div className="transition-metrics">
        <span>Area: {metricText(areaReduction, "")}</span>
        <span>Ecc: {metricText(eccentricityDiff, "")}</span>
        <span>
          Thick: {thicknessReduction ? thicknessReduction.map((v) => v.toFixed(3)).join(", ") : "n/a"}
        </span>
      </div>
    </section>
  )
}
