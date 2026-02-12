import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react"
import { vertices } from "../../shared/lib/geometry"
import type { Bounds, Pipe } from "../../shared/types/domain"

type TransitionCardProps = {
  leftPipe: Pipe
  rightPipe: Pipe
  onLeftPipeChange: (pipe: Pipe) => void
  onRightPipeChange: (pipe: Pipe) => void
  title: string
  bounds: Bounds
  showMarkers: boolean
  markersDraggable: boolean
  canDragMarker?: (marker: {
    side: "left" | "right"
    kind: "shape" | "center"
    shapeKey: "outer" | "inner"
    markerIndex: number
  }) => boolean
  markerDragAxes?: (marker: {
    side: "left" | "right"
    kind: "shape" | "center"
    shapeKey: "outer" | "inner"
    markerIndex: number
  }) => { allowX: boolean; allowY: boolean }
  centerDragAxes?: (side: "left" | "right") => {
    outer: { allowX: boolean; allowY: boolean }
    inner: { allowX: boolean; allowY: boolean }
  }
  markerSize: number
  plotLineWidth: number
  areaReduction: number | null
  eccentricityDiff: number | null
  thicknessReduction: number[] | null
  highlighted?: boolean
  emphasizedSide?: "left" | "right" | null
  hoveredInputTarget?: {
    side: "left" | "right"
    shapeKey: "outer" | "inner"
    pointKey: "origin" | "v1" | "v2" | "v3"
  } | null
  hoveredThicknessMarkerIndex?: number | null
  onCardMouseEnter?: () => void
  onCardMouseLeave?: () => void
}

const SIZE = 260
const PROXIMITY_HOVER_PX = 10
const EMPHASIS_SHADOW =
  "drop-shadow(0 0 7px rgba(37, 99, 235, 0.35)) drop-shadow(0 0 3px rgba(56, 189, 248, 0.3))"
const EMPHASIS_FILL = "rgba(59, 130, 246, 0.14)"

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

function markerMatchesHoveredInput(
  marker: MarkerMeta,
  hoveredInputTarget: TransitionCardProps["hoveredInputTarget"]
): boolean {
  if (!hoveredInputTarget || marker.side !== hoveredInputTarget.side) {
    return false
  }

  if (hoveredInputTarget.pointKey === "origin") {
    return marker.kind === "center"
  }

  if (marker.kind !== "shape" || marker.shapeKey !== hoveredInputTarget.shapeKey) {
    return false
  }

  if (hoveredInputTarget.pointKey === "v1") {
    return marker.markerIndex === 0 || marker.markerIndex === 4
  }
  if (hoveredInputTarget.pointKey === "v2") {
    return marker.markerIndex === 1 || marker.markerIndex === 3
  }
  return marker.markerIndex === 2
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

function ringPath(pipe: Pipe, viewport: Viewport): string {
  const outer = shapePath(pipe, "outer", viewport)
  const inner = shapePath(pipe, "inner", viewport)
  return `${outer} ${inner}`
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
    const halfW = shape.width / 2
    const halfL = shape.length / 2
    const r = Math.max(0.01, Math.min(shape.fillet_radius, halfW, halfL))
    const cornerFactor = 1 - Math.SQRT1_2
    return [
      [ox, oy + halfL],
      [ox + halfW - cornerFactor * r, oy + halfL - cornerFactor * r],
      [ox + halfW, oy],
      [ox + halfW - cornerFactor * r, oy - halfL + cornerFactor * r],
      [ox, oy - halfL],
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
    const halfW = shape.width / 2
    const halfL = shape.length / 2

    if (markerIndex === 0 || markerIndex === 4) {
      const nextLength = Math.max(0.01, 2 * Math.abs(snapped[1] - oy))
      return { ...shape, length: nextLength }
    }

    if (markerIndex === 1 || markerIndex === 3) {
      const cornerFactor = 1 - Math.SQRT1_2
      const deltaX = snapped[0] - ox
      const deltaY = snapped[1] - oy
      const radiusFromX = (halfW - deltaX) / cornerFactor
      const radiusFromY =
        markerIndex === 1 ? (halfL - deltaY) / cornerFactor : (halfL + deltaY) / cornerFactor
      const radiusRaw = (radiusFromX + radiusFromY) / 2
      const maxRadius = Math.max(0.01, Math.min(halfW, halfL))
      const filletRadius = Math.max(0.01, Math.min(radiusRaw, maxRadius))
      return { ...shape, fillet_radius: filletRadius }
    }

    const nextWidth = Math.max(0.01, 2 * Math.abs(snapped[0] - ox))
    return { ...shape, width: nextWidth }
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
  const [cx, cy] = pipe.outer.origin
  const targetX = snapStep(nextCenter[0])
  const targetY = snapStep(nextCenter[1])
  const dx = targetX - cx
  const dy = targetY - cy

  const moveShape = (shape: Pipe["outer"]): Pipe["outer"] => {
    const [ox, oy] = shape.origin
    return {
      ...shape,
      origin: [snapStep(ox + dx), snapStep(oy + dy)],
    }
  }

  return {
    ...pipe,
    outer: moveShape(pipe.outer),
    inner: moveShape(pipe.inner),
  }
}

function movePipeCenterWithAxes(
  pipe: Pipe,
  nextCenter: [number, number],
  axes: {
    outer: { allowX: boolean; allowY: boolean }
    inner: { allowX: boolean; allowY: boolean }
  }
): Pipe {
  const [cx, cy] = pipe.outer.origin
  const targetX = snapStep(nextCenter[0])
  const targetY = snapStep(nextCenter[1])
  const dx = targetX - cx
  const dy = targetY - cy

  const moveShape = (
    shape: Pipe["outer"],
    shapeAxes: { allowX: boolean; allowY: boolean }
  ): Pipe["outer"] => {
    const [ox, oy] = shape.origin
    return {
      ...shape,
      origin: [
        shapeAxes.allowX ? snapStep(ox + dx) : ox,
        shapeAxes.allowY ? snapStep(oy + dy) : oy,
      ],
    }
  }

  return {
    ...pipe,
    outer: moveShape(pipe.outer, axes.outer),
    inner: moveShape(pipe.inner, axes.inner),
  }
}

function toWorld(point: [number, number], viewport: Viewport): [number, number] {
  const x = (point[0] - viewport.offsetX) / viewport.scale
  const y = (viewport.offsetY - point[1]) / viewport.scale
  return [snapStep(x), snapStep(y)]
}

export function TransitionCard({
  leftPipe,
  rightPipe,
  onLeftPipeChange,
  onRightPipeChange,
  title,
  bounds,
  showMarkers,
  markersDraggable,
  canDragMarker,
  markerDragAxes,
  centerDragAxes,
  markerSize,
  plotLineWidth,
  areaReduction,
  eccentricityDiff,
  thicknessReduction,
  highlighted = false,
  emphasizedSide = null,
  hoveredInputTarget = null,
  hoveredThicknessMarkerIndex = null,
  onCardMouseEnter,
  onCardMouseLeave,
}: TransitionCardProps): JSX.Element {
  const svgRef = useRef<SVGSVGElement | null>(null)
  const draggingPointerId = useRef<number | null>(null)
  const [activeMarker, setActiveMarker] = useState<ActiveMarker | null>(null)
  const [pointerLocal, setPointerLocal] = useState<[number, number] | null>(null)
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

    const currentMarker = allMarkers.find(
      (marker) =>
        marker.side === activeMarker.side &&
        marker.kind === activeMarker.kind &&
        marker.shapeKey === activeMarker.shapeKey &&
        marker.markerIndex === activeMarker.markerIndex
    )
    if (!currentMarker) {
      return
    }

    const axes = markerDragAxes
      ? markerDragAxes(activeMarker)
      : {
          allowX: !canDragMarker || canDragMarker(activeMarker),
          allowY: !canDragMarker || canDragMarker(activeMarker),
        }
    const constrainedWorld: [number, number] = [
      axes.allowX ? world[0] : currentMarker.point[0],
      axes.allowY ? world[1] : currentMarker.point[1],
    ]

    if (activeMarker.side === "left") {
      if (activeMarker.kind === "center") {
        onLeftPipeChange(
          centerDragAxes
            ? movePipeCenterWithAxes(leftPipe, constrainedWorld, centerDragAxes("left"))
            : movePipeCenter(leftPipe, constrainedWorld)
        )
      } else {
        onLeftPipeChange(
          updatePipeByMarker(leftPipe, activeMarker.shapeKey, activeMarker.markerIndex, constrainedWorld)
        )
      }
      return
    }
    if (activeMarker.kind === "center") {
      onRightPipeChange(
        centerDragAxes
          ? movePipeCenterWithAxes(rightPipe, constrainedWorld, centerDragAxes("right"))
          : movePipeCenter(rightPipe, constrainedWorld)
      )
    } else {
      onRightPipeChange(
        updatePipeByMarker(rightPipe, activeMarker.shapeKey, activeMarker.markerIndex, constrainedWorld)
      )
    }
  }

  const hasSideEmphasis = emphasizedSide !== null
  const leftEmphasized = emphasizedSide === "left"
  const rightEmphasized = emphasizedSide === "right"
  const leftStrokeOpacity = hasSideEmphasis ? (leftEmphasized ? 1 : 0.34) : 1
  const rightStrokeOpacity = hasSideEmphasis ? (rightEmphasized ? 1 : 0.34) : 1

  const markerIsDraggable = (marker: MarkerMeta): boolean =>
    markersDraggable && (!canDragMarker || canDragMarker(marker))

  let nearestDraggableMarkerKey: string | null = null
  if (pointerLocal) {
    let bestDistanceSq = PROXIMITY_HOVER_PX * PROXIMITY_HOVER_PX
    for (const marker of allMarkers) {
      if (!markerIsDraggable(marker)) {
        continue
      }
      const [mx, my] = project(marker.point, viewport)
      const dx = pointerLocal[0] - mx
      const dy = pointerLocal[1] - my
      const distanceSq = dx * dx + dy * dy
      if (distanceSq <= bestDistanceSq) {
        bestDistanceSq = distanceSq
        nearestDraggableMarkerKey = marker.key
      }
    }
  }

  const beginMarkerDrag = (event: ReactPointerEvent<SVGElement>, marker: MarkerMeta) => {
    if (!markerIsDraggable(marker)) {
      return
    }
    event.preventDefault()
    draggingPointerId.current = event.pointerId
    svgRef.current?.setPointerCapture(event.pointerId)
    setActiveMarker({
      side: marker.side,
      kind: marker.kind,
      shapeKey: marker.shapeKey,
      markerIndex: marker.markerIndex,
    })
  }

  return (
    <section
      className={`transition-card${highlighted ? " highlighted" : ""}`}
      onMouseEnter={onCardMouseEnter}
      onMouseLeave={onCardMouseLeave}
    >
      <h3>{title}</h3>
      <svg
        ref={svgRef}
        width={SIZE}
        height={SIZE}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="transition-svg"
        onPointerMove={(event) => {
          updateFromPointer(event.clientX, event.clientY)
          const rect = svgRef.current?.getBoundingClientRect()
          if (!rect || rect.width <= 0 || rect.height <= 0) {
            return
          }
          const localX = ((event.clientX - rect.left) / rect.width) * SIZE
          const localY = ((event.clientY - rect.top) / rect.height) * SIZE
          setPointerLocal([localX, localY])
        }}
        onPointerLeave={() => setPointerLocal(null)}
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
        {leftEmphasized ? (
          <path
            d={ringPath(leftPipe, viewport)}
            fill={EMPHASIS_FILL}
            fillRule="evenodd"
            stroke="none"
            style={{ filter: EMPHASIS_SHADOW }}
          />
        ) : null}
        {rightEmphasized ? (
          <path
            d={ringPath(rightPipe, viewport)}
            fill={EMPHASIS_FILL}
            fillRule="evenodd"
            stroke="none"
            style={{ filter: EMPHASIS_SHADOW }}
          />
        ) : null}
        <path
          d={shapePath(leftPipe, "outer", viewport)}
          stroke="#174a95"
          strokeWidth={leftEmphasized ? plotLineWidth * 1.35 : hasSideEmphasis ? plotLineWidth * 0.85 : plotLineWidth}
          strokeOpacity={leftStrokeOpacity}
          fill="none"
        />
        <path
          d={shapePath(leftPipe, "inner", viewport)}
          stroke="#174a95"
          strokeWidth={
            leftEmphasized ? plotLineWidth * 1.2 : hasSideEmphasis ? plotLineWidth * 0.78 : plotLineWidth * 0.9
          }
          strokeOpacity={leftStrokeOpacity}
          fill="none"
        />
        <path
          d={shapePath(rightPipe, "outer", viewport)}
          stroke="#dc2626"
          strokeWidth={
            rightEmphasized ? plotLineWidth * 1.35 : hasSideEmphasis ? plotLineWidth * 0.85 : plotLineWidth
          }
          strokeOpacity={rightStrokeOpacity}
          fill="none"
          strokeDasharray="6 4"
        />
        <path
          d={shapePath(rightPipe, "inner", viewport)}
          stroke="#dc2626"
          strokeWidth={
            rightEmphasized
              ? plotLineWidth * 1.2
              : hasSideEmphasis
                ? plotLineWidth * 0.78
                : plotLineWidth * 0.9
          }
          strokeOpacity={rightStrokeOpacity}
          fill="none"
          strokeDasharray="6 4"
        />
        {showMarkers
          ? allMarkers.map((marker) => {
              const [x, y] = project(marker.point, viewport)
              const inputHovered = markerMatchesHoveredInput(marker, hoveredInputTarget)
              const thicknessHovered =
                marker.kind === "shape" &&
                hoveredThicknessMarkerIndex !== null &&
                marker.markerIndex === hoveredThicknessMarkerIndex
              const proximityHovered = marker.key === nearestDraggableMarkerKey
              const markerRadius = inputHovered
                ? markerSize * 2.1
                : thicknessHovered
                  ? markerSize * 1.7
                  : proximityHovered
                    ? markerSize * 1.6
                    : markerSize
              const crossHalfSize = markerRadius * 0.82
              const crossHovered = inputHovered || thicknessHovered
              return (
                <g key={marker.key} style={{ cursor: "default" }}>
                  {crossHovered ? (
                    <>
                      <line
                        x1={x - crossHalfSize}
                        y1={y - crossHalfSize}
                        x2={x + crossHalfSize}
                        y2={y + crossHalfSize}
                        stroke={marker.kind === "center" ? "#a16207" : "#dc2626"}
                        strokeWidth={2.2}
                        strokeLinecap="round"
                        onPointerDown={(event) => beginMarkerDrag(event, marker)}
                      />
                      <line
                        x1={x - crossHalfSize}
                        y1={y + crossHalfSize}
                        x2={x + crossHalfSize}
                        y2={y - crossHalfSize}
                        stroke={marker.kind === "center" ? "#a16207" : "#dc2626"}
                        strokeWidth={2.2}
                        strokeLinecap="round"
                        onPointerDown={(event) => beginMarkerDrag(event, marker)}
                      />
                      <circle
                        cx={x}
                        cy={y}
                        r={markerRadius}
                        fill="transparent"
                        onPointerDown={(event) => beginMarkerDrag(event, marker)}
                      />
                    </>
                  ) : (
                    <circle
                      cx={x}
                      cy={y}
                      r={markerRadius}
                      fill={marker.kind === "center" ? "#fef08a" : "#ffffff"}
                      stroke={marker.kind === "center" ? "#a16207" : "#2b3340"}
                      strokeWidth={1}
                      onPointerDown={(event) => beginMarkerDrag(event, marker)}
                    />
                  )}
                </g>
              )
            })
          : null}
      </svg>
    </section>
  )
}
