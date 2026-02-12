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
  areaReduction: number | null
  eccentricityDiff: number | null
  thicknessReduction: number[] | null
}

const SIZE = 260

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

function project(point: [number, number], bounds: Bounds): [number, number] {
  const width = Math.max(bounds.maxX - bounds.minX, 1)
  const height = Math.max(bounds.maxY - bounds.minY, 1)
  const x = ((point[0] - bounds.minX) / width) * SIZE
  const y = ((bounds.maxY - point[1]) / height) * SIZE
  return [x, y]
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

function shapePath(pipe: Pipe, key: "outer" | "inner", bounds: Bounds): string {
  const points = vertices(pipe[key]).map((point) => project(point, bounds))
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
  if (shape.shape_type === "Circle") {
    const [ox, oy] = shape.origin
    const diameter = Math.max(0.01, 2 * Math.hypot(nextPoint[0] - ox, nextPoint[1] - oy))
    return { ...shape, diameter }
  }

  if (shape.shape_type === "Rect") {
    const [ox, oy] = shape.origin
    if (markerIndex === 0 || markerIndex === 4) {
      const nextLength = Math.max(0.01, 2 * Math.abs(nextPoint[1] - oy))
      return { ...shape, length: nextLength }
    }
    const nextWidth = Math.max(0.01, 2 * Math.abs(nextPoint[0] - ox))
    if (markerIndex === 2) {
      return { ...shape, width: nextWidth }
    }

    const nextLength = Math.max(0.01, 2 * Math.abs(nextPoint[1] - oy))
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
      v1: [nextPoint[0] - ox, nextPoint[1] - oy],
    }
  }
  if (markerIndex === 1 || markerIndex === 3) {
    return {
      ...shape,
      v2: [nextPoint[0] - ox, Math.abs(nextPoint[1] - oy)],
    }
  }
  if (markerIndex === 2) {
    return {
      ...shape,
      v3: [nextPoint[0] - ox, nextPoint[1] - oy],
    }
  }
  return {
    ...shape,
    v1: [nextPoint[0] - ox, Math.abs(nextPoint[1] - oy)],
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
  const [cx, cy] = pipe.outer.origin
  const dx = nextCenter[0] - cx
  const dy = nextCenter[1] - cy

  const moveShape = (shape: Pipe["outer"]): Pipe["outer"] => {
    const [ox, oy] = shape.origin
    return {
      ...shape,
      origin: [ox + dx, oy + dy],
    }
  }

  return {
    ...pipe,
    outer: moveShape(pipe.outer),
    inner: moveShape(pipe.inner),
  }
}

function toWorld(point: [number, number], bounds: Bounds): [number, number] {
  const width = Math.max(bounds.maxX - bounds.minX, 1)
  const height = Math.max(bounds.maxY - bounds.minY, 1)
  const x = bounds.minX + (point[0] / SIZE) * width
  const y = bounds.maxY - (point[1] / SIZE) * height
  return [x, y]
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
  areaReduction,
  eccentricityDiff,
  thicknessReduction,
}: TransitionCardProps): JSX.Element {
  const svgRef = useRef<SVGSVGElement | null>(null)
  const [activeMarker, setActiveMarker] = useState<ActiveMarker | null>(null)

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
    const world = toWorld([localX, localY], bounds)

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
        onPointerUp={() => setActiveMarker(null)}
        onPointerLeave={() => setActiveMarker(null)}
      >
        <path d={shapePath(leftPipe, "outer", bounds)} stroke="#174a95" strokeWidth={2} fill="none" />
        <path d={shapePath(leftPipe, "inner", bounds)} stroke="#0c8a61" strokeWidth={1.8} fill="none" />
        <path
          d={shapePath(rightPipe, "outer", bounds)}
          stroke="#d95f02"
          strokeWidth={2}
          fill="none"
          strokeDasharray="6 4"
        />
        <path
          d={shapePath(rightPipe, "inner", bounds)}
          stroke="#9442a3"
          strokeWidth={1.8}
          fill="none"
          strokeDasharray="6 4"
        />
        {showMarkers
          ? allMarkers.map((marker) => {
              const [x, y] = project(marker.point, bounds)
              return (
                <circle
                  key={marker.key}
                  cx={x}
                  cy={y}
                  r={3}
                  fill={marker.kind === "center" ? "#fef08a" : "#ffffff"}
                  stroke={marker.kind === "center" ? "#a16207" : "#2b3340"}
                  strokeWidth={1}
                  style={{ cursor: "grab" }}
                  onPointerDown={(event) => {
                    event.preventDefault()
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
