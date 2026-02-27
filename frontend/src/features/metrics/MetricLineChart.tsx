import { useState } from "react"

type Series = {
  name: string
  values: number[]
  color: string
}

type MetricLineChartProps = {
  title: string
  series: Series[]
  valueFormatter?: (value: number) => string
  onHoverIndexChange?: (index: number | null) => void
  onHoverPointChange?:
    | ((point: { pointIndex: number; seriesIndex: number; seriesName: string } | null) => void)
    | undefined
  externalHoverPoint?: { pointIndex: number; seriesIndex: number } | null
  emptyText?: string
}

const WIDTH = 460
const HEIGHT = 280
const PAD_LEFT = 64
const PAD_RIGHT = 12
const PAD_TOP = 12
const PAD_BOTTOM = 26
const MARKER_RADIUS = 2.8
const MARKER_HOVER_RADIUS = 5.2
const HOVER_THRESHOLD = 10

type HoverPoint = {
  x: number
  y: number
  label: string
  color: string
  transitionIndex: number
  pointKey: string
  seriesIndex: number
  seriesName: string
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

export function MetricLineChart({
  title,
  series,
  valueFormatter,
  onHoverIndexChange,
  onHoverPointChange,
  externalHoverPoint = null,
  emptyText = "Not enough data",
}: MetricLineChartProps): JSX.Element {
  const [hovered, setHovered] = useState<HoverPoint | null>(null)
  const hoveredPointKey = hovered?.pointKey ?? null
  const nonEmpty = series.filter((s) => s.values.length > 0)
  const maxPoints = nonEmpty.reduce((acc, s) => Math.max(acc, s.values.length), 0)

  if (nonEmpty.length === 0 || maxPoints === 0) {
    return (
      <section className="metric-card">
        <h3>{title}</h3>
        <p className="metric-empty">{emptyText}</p>
      </section>
    )
  }

  const allValues = nonEmpty.flatMap((s) => s.values)
  const rawMin = Math.min(...allValues)
  const rawMax = Math.max(...allValues)
  const minVal = rawMin === rawMax ? rawMin - 0.5 : rawMin
  const maxVal = rawMin === rawMax ? rawMax + 0.5 : rawMax
  const xSpan = Math.max(maxPoints - 1, 1)
  const ySpan = Math.max(maxVal - minVal, 1e-9)

  const x = (index: number): number => PAD_LEFT + (index / xSpan) * (WIDTH - PAD_LEFT - PAD_RIGHT)
  const y = (value: number): number =>
    PAD_TOP + ((maxVal - value) / ySpan) * (HEIGHT - PAD_TOP - PAD_BOTTOM)
  const yTicks = [maxVal, (maxVal + minVal) / 2, minVal]
  const formatValue = (value: number): string =>
    (valueFormatter ? valueFormatter(value) : value.toFixed(4))

  const tooltipText = hovered?.label ?? ""
  const tooltipWidth = Math.max(88, tooltipText.length * 8 + 12)
  const tooltipHeight = 24
  const tooltipX = hovered
    ? Math.min(Math.max(hovered.x + 10, PAD_LEFT), WIDTH - tooltipWidth - PAD_RIGHT)
    : 0
  const tooltipY = hovered
    ? Math.min(Math.max(hovered.y - 30, PAD_TOP), HEIGHT - tooltipHeight - PAD_BOTTOM)
    : 0

  const plotPoints = nonEmpty.flatMap((s, seriesIndex) =>
    s.values.map((value, index) => {
      const px = x(index)
      const py = y(value)
      return {
        key: `${s.name}-${index}`,
        x: px,
        y: py,
        label: formatValue(value),
        color: s.color,
        transitionIndex: index,
        seriesIndex,
        seriesName: s.name,
      }
    })
  )

  const externalHover =
    hovered === null && externalHoverPoint
      ? (() => {
          const matchedPoint = plotPoints.find(
            (point) =>
              point.transitionIndex === externalHoverPoint.pointIndex &&
              point.seriesIndex === externalHoverPoint.seriesIndex
          )
          if (!matchedPoint) {
            return null
          }
          return {
            x: matchedPoint.x,
            y: matchedPoint.y,
            label: matchedPoint.label,
            color: matchedPoint.color,
            transitionIndex: matchedPoint.transitionIndex,
            pointKey: matchedPoint.key,
            seriesIndex: matchedPoint.seriesIndex,
            seriesName: matchedPoint.seriesName,
          }
        })()
      : null
  const activeHover = hovered ?? externalHover
  const activeHoveredPointKey = activeHover?.pointKey ?? null

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
        onHoverPointChange?.(null)
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
      hovered.transitionIndex === selected.transitionIndex &&
      hovered.seriesIndex === selected.seriesIndex
    ) {
      return
    }

    setHovered({
      x: selected.x,
      y: selected.y,
      label: selected.label,
      color: selected.color,
      transitionIndex: selected.transitionIndex,
      pointKey: selected.key,
      seriesIndex: selected.seriesIndex,
      seriesName: selected.seriesName,
    })
    onHoverIndexChange?.(selected.transitionIndex)
    onHoverPointChange?.({
      pointIndex: selected.transitionIndex,
      seriesIndex: selected.seriesIndex,
      seriesName: selected.seriesName,
    })
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
          onHoverPointChange?.(null)
        }}
      >
        <line
          x1={PAD_LEFT}
          y1={HEIGHT - PAD_BOTTOM}
          x2={WIDTH - PAD_RIGHT}
          y2={HEIGHT - PAD_BOTTOM}
          stroke="#c8d3e0"
          strokeWidth={1}
        />
        <line
          x1={PAD_LEFT}
          y1={PAD_TOP}
          x2={PAD_LEFT}
          y2={HEIGHT - PAD_BOTTOM}
          stroke="#c8d3e0"
          strokeWidth={1}
        />

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

        {activeHover ? (
          <line
            x1={x(activeHover.transitionIndex)}
            y1={PAD_TOP}
            x2={x(activeHover.transitionIndex)}
            y2={HEIGHT - PAD_BOTTOM}
            stroke={activeHover.color}
            strokeWidth={1}
            strokeDasharray="4 3"
            strokeOpacity={0.45}
          />
        ) : null}

        {yTicks.map((tickValue) => {
          const py = y(tickValue)
          return (
            <g key={`ytick-${tickValue.toFixed(6)}`}>
              <line
                x1={PAD_LEFT - 5}
                y1={py}
                x2={PAD_LEFT}
                y2={py}
                stroke="#94a3b8"
                strokeWidth={1}
              />
              <text
                x={PAD_LEFT - 8}
                y={py + 4}
                textAnchor="end"
                fontSize="14"
                fill="#475569"
              >
                {formatValue(tickValue)}
              </text>
            </g>
          )
        })}

        {nonEmpty.map((s) => {
          const points = s.values.map((v, i) => [x(i), y(v)] as [number, number])
          return (
            <g key={s.name}>
              <path d={pathFromPoints(points)} fill="none" stroke={s.color} strokeWidth={2} />
              {points.map(([px, py], index) => (
                <g key={`${s.name}-${index}`}>
                  <circle
                    cx={px}
                    cy={py}
                    r={activeHoveredPointKey === `${s.name}-${index}` ? MARKER_HOVER_RADIUS : MARKER_RADIUS}
                    fill="#ffffff"
                    stroke={s.color}
                    strokeWidth={activeHoveredPointKey === `${s.name}-${index}` ? 1.8 : 1}
                    style={{ transition: "r 120ms ease, stroke-width 120ms ease" }}
                  />
                </g>
              ))}
            </g>
          )
        })}

        {hovered ? (
          <g pointerEvents="none">
            <rect
              x={tooltipX}
              y={tooltipY}
              width={tooltipWidth}
              height={tooltipHeight}
              rx={6}
              fill="#0f172a"
              fillOpacity={0.92}
              stroke={hovered.color}
              strokeWidth={1}
            />
            <text x={tooltipX + 8} y={tooltipY + 16} fontSize="14" fill="#f8fafc">
              {tooltipText}
            </text>
          </g>
        ) : null}
      </svg>

      <div className="metric-legend">
        {nonEmpty.map((s) => (
          <span key={s.name}>
            <i style={{ backgroundColor: s.color }} />
            {s.name}
          </span>
        ))}
      </div>
    </section>
  )
}
