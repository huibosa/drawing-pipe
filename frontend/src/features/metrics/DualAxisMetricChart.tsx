import { useState } from "react"

type DualAxisMetricChartProps = {
  title: string
  leftLabel: string
  rightLabel: string
  leftValues: number[]
  rightValues: number[]
  leftColor?: string
  rightColor?: string
  leftFormatter?: (value: number) => string
  rightFormatter?: (value: number) => string
  onHoverIndexChange?: (index: number | null) => void
  emptyText?: string
}

const WIDTH = 460
const HEIGHT = 280
const PAD_LEFT = 64
const PAD_RIGHT = 64
const PAD_TOP = 12
const PAD_BOTTOM = 26
const MARKER_RADIUS = 2.8
const MARKER_HOVER_RADIUS = 5.2
const HOVER_THRESHOLD = 10

type HoverPoint = {
  index: number
  x: number
  y: number
  series: "left" | "right"
  pointKey: string
}

function pathFromPoints(points: [number, number][]): string {
  if (points.length === 0) {
    return ""
  }
  const [start, ...rest] = points
  return `M ${start[0].toFixed(2)} ${start[1].toFixed(2)} ${rest
    .map(([x, y]) => `L ${x.toFixed(2)} ${y.toFixed(2)}`)
    .join(" ")}`
}

function range(values: number[]): [number, number] {
  const min = Math.min(...values)
  const max = Math.max(...values)
  if (min === max) {
    return [min - 0.5, max + 0.5]
  }
  return [min, max]
}

export function DualAxisMetricChart({
  title,
  leftLabel,
  rightLabel,
  leftValues,
  rightValues,
  leftColor = "#2563eb",
  rightColor = "#10b981",
  leftFormatter = (value) => value.toFixed(4),
  rightFormatter = (value) => value.toFixed(4),
  onHoverIndexChange,
  emptyText = "Not enough data",
}: DualAxisMetricChartProps): JSX.Element {
  const [hovered, setHovered] = useState<HoverPoint | null>(null)
  const hoveredPointKey = hovered?.pointKey ?? null

  const maxPoints = Math.max(leftValues.length, rightValues.length)
  if (maxPoints === 0) {
    return (
      <section className="metric-card">
        <h3>{title}</h3>
        <p className="metric-empty">{emptyText}</p>
      </section>
    )
  }

  const [leftMin, leftMax] = range(leftValues.length > 0 ? leftValues : [0])
  const [rightMin, rightMax] = range(rightValues.length > 0 ? rightValues : [0])

  const xSpan = Math.max(maxPoints - 1, 1)
  const leftSpan = Math.max(leftMax - leftMin, 1e-9)
  const rightSpan = Math.max(rightMax - rightMin, 1e-9)

  const x = (index: number): number => PAD_LEFT + (index / xSpan) * (WIDTH - PAD_LEFT - PAD_RIGHT)
  const yLeft = (value: number): number =>
    PAD_TOP + ((leftMax - value) / leftSpan) * (HEIGHT - PAD_TOP - PAD_BOTTOM)
  const yRight = (value: number): number =>
    PAD_TOP + ((rightMax - value) / rightSpan) * (HEIGHT - PAD_TOP - PAD_BOTTOM)

  const leftTicks = [leftMax, (leftMax + leftMin) / 2, leftMin]
  const rightTicks = [rightMax, (rightMax + rightMin) / 2, rightMin]

  const leftPoints = leftValues.map((v, i) => [x(i), yLeft(v)] as [number, number])
  const rightPoints = rightValues.map((v, i) => [x(i), yRight(v)] as [number, number])

  const hoveredValueText =
    hovered &&
    (hovered.series === "left"
      ? hovered.index < leftValues.length
        ? leftFormatter(leftValues[hovered.index])
        : "-"
      : hovered.index < rightValues.length
        ? rightFormatter(rightValues[hovered.index])
        : "-")
  const tooltipWidth = Math.max(76, (hoveredValueText?.length ?? 1) * 7 + 16)
  const tooltipHeight = 24
  const tooltipX = hovered
    ? Math.min(Math.max(hovered.x + 10, PAD_LEFT), WIDTH - tooltipWidth - PAD_RIGHT)
    : 0
  const tooltipY = hovered
    ? Math.min(Math.max(hovered.y - 48, PAD_TOP), HEIGHT - tooltipHeight - PAD_BOTTOM)
    : 0

  const plotPoints = [
    ...leftPoints.map(([px, py], index) => ({
      key: `left-${index}`,
      index,
      x: px,
      y: py,
      series: "left" as const,
    })),
    ...rightPoints.map(([px, py], index) => ({
      key: `right-${index}`,
      index,
      x: px,
      y: py,
      series: "right" as const,
    })),
  ]

  const updateHoverFromPointer = (clientX: number, clientY: number, element: SVGSVGElement) => {
    const rect = element.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) {
      return
    }
    const localX = ((clientX - rect.left) / rect.width) * WIDTH
    const localY = ((clientY - rect.top) / rect.height) * HEIGHT

    const thresholdSq = HOVER_THRESHOLD * HOVER_THRESHOLD
    let nearest = -1
    let nearestDistSq = Number.POSITIVE_INFINITY
    let currentDistSq = Number.POSITIVE_INFINITY

    for (let i = 0; i < plotPoints.length; i += 1) {
      const point = plotPoints[i]
      const dx = localX - point.x
      const dy = localY - point.y
      const distSq = dx * dx + dy * dy
      if (point.key === hoveredPointKey) {
        currentDistSq = distSq
      }
      if (distSq < nearestDistSq) {
        nearestDistSq = distSq
        nearest = i
      }
    }

    if (nearest < 0 || nearestDistSq > thresholdSq) {
      if (hovered !== null) {
        setHovered(null)
        onHoverIndexChange?.(null)
      }
      return
    }

    let selected = plotPoints[nearest]
    if (hoveredPointKey !== null && currentDistSq <= thresholdSq && currentDistSq <= nearestDistSq * 1.25) {
      const current = plotPoints.find((point) => point.key === hoveredPointKey)
      if (current) {
        selected = current
      }
    }

    if (
      hovered &&
      hovered.pointKey === selected.key &&
      hovered.index === selected.index &&
      hovered.series === selected.series
    ) {
      return
    }

    setHovered({
      index: selected.index,
      x: selected.x,
      y: selected.y,
      series: selected.series,
      pointKey: selected.key,
    })
    onHoverIndexChange?.(selected.index)
  }

  return (
    <section className="metric-card">
      <h3>{title}</h3>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="metric-svg"
        role="img"
        aria-label={title}
        onMouseMove={(event) => updateHoverFromPointer(event.clientX, event.clientY, event.currentTarget)}
        onMouseLeave={() => {
          setHovered(null)
          onHoverIndexChange?.(null)
        }}
      >
        <line x1={PAD_LEFT} y1={HEIGHT - PAD_BOTTOM} x2={WIDTH - PAD_RIGHT} y2={HEIGHT - PAD_BOTTOM} stroke="#c8d3e0" strokeWidth={1} />
        <line x1={PAD_LEFT} y1={PAD_TOP} x2={PAD_LEFT} y2={HEIGHT - PAD_BOTTOM} stroke="#c8d3e0" strokeWidth={1} />
        <line x1={WIDTH - PAD_RIGHT} y1={PAD_TOP} x2={WIDTH - PAD_RIGHT} y2={HEIGHT - PAD_BOTTOM} stroke="#c8d3e0" strokeWidth={1} />

        {[0, 0.5, 1].map((ratio) => {
          const yLine = PAD_TOP + ratio * (HEIGHT - PAD_TOP - PAD_BOTTOM)
          return (
            <line
              key={`grid-${ratio}`}
              x1={PAD_LEFT}
              y1={yLine}
              x2={WIDTH - PAD_RIGHT}
              y2={yLine}
              stroke="#eef2f7"
              strokeWidth={1}
            />
          )
        })}

        {hovered ? (
          <line
            x1={x(hovered.index)}
            y1={PAD_TOP}
            x2={x(hovered.index)}
            y2={HEIGHT - PAD_BOTTOM}
            stroke={hovered.series === "left" ? leftColor : rightColor}
            strokeWidth={1}
            strokeDasharray="4 3"
            strokeOpacity={0.45}
          />
        ) : null}

        {leftTicks.map((tickValue) => {
          const py = yLeft(tickValue)
          return (
            <g key={`left-tick-${tickValue.toFixed(6)}`}>
              <line x1={PAD_LEFT - 5} y1={py} x2={PAD_LEFT} y2={py} stroke="#94a3b8" strokeWidth={1} />
              <text x={PAD_LEFT - 8} y={py + 4} textAnchor="end" fontSize="14" fill="#475569">
                {leftFormatter(tickValue)}
              </text>
            </g>
          )
        })}

        {rightTicks.map((tickValue) => {
          const py = yRight(tickValue)
          return (
            <g key={`right-tick-${tickValue.toFixed(6)}`}>
              <line x1={WIDTH - PAD_RIGHT} y1={py} x2={WIDTH - PAD_RIGHT + 5} y2={py} stroke="#94a3b8" strokeWidth={1} />
              <text x={WIDTH - PAD_RIGHT + 8} y={py + 4} textAnchor="start" fontSize="14" fill="#475569">
                {rightFormatter(tickValue)}
              </text>
            </g>
          )
        })}

        {leftPoints.length > 0 ? <path d={pathFromPoints(leftPoints)} fill="none" stroke={leftColor} strokeWidth={2} /> : null}
        {rightPoints.length > 0 ? <path d={pathFromPoints(rightPoints)} fill="none" stroke={rightColor} strokeWidth={2} /> : null}

        {leftPoints.map(([px, py], index) => {
          const key = `left-${index}`
          return (
            <g key={key}>
              <circle
                cx={px}
                cy={py}
                r={hoveredPointKey === key ? MARKER_HOVER_RADIUS : MARKER_RADIUS}
                fill="#ffffff"
                stroke={leftColor}
                strokeWidth={hoveredPointKey === key ? 1.8 : 1}
                style={{ transition: "r 120ms ease, stroke-width 120ms ease" }}
              />
            </g>
          )
        })}

        {rightPoints.map(([px, py], index) => {
          const key = `right-${index}`
          return (
            <g key={key}>
              <circle
                cx={px}
                cy={py}
                r={hoveredPointKey === key ? MARKER_HOVER_RADIUS : MARKER_RADIUS}
                fill="#ffffff"
                stroke={rightColor}
                strokeWidth={hoveredPointKey === key ? 1.8 : 1}
                style={{ transition: "r 120ms ease, stroke-width 120ms ease" }}
              />
            </g>
          )
        })}

        {hovered ? (
          <g pointerEvents="none">
            <rect x={tooltipX} y={tooltipY} width={tooltipWidth} height={tooltipHeight} rx={6} fill="#0f172a" fillOpacity={0.92} />
            <text x={tooltipX + 8} y={tooltipY + 16} fontSize="14" fill="#f8fafc">
              {hoveredValueText}
            </text>
          </g>
        ) : null}
      </svg>

      <div className="metric-legend">
        <span>
          <i style={{ backgroundColor: leftColor }} />
          {leftLabel}
        </span>
        <span>
          <i style={{ backgroundColor: rightColor }} />
          {rightLabel}
        </span>
      </div>
    </section>
  )
}
