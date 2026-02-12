type Series = {
  name: string
  values: number[]
  color: string
}

type MetricLineChartProps = {
  title: string
  series: Series[]
}

const WIDTH = 360
const HEIGHT = 180
const PAD_LEFT = 32
const PAD_RIGHT = 12
const PAD_TOP = 12
const PAD_BOTTOM = 26

function pathFromPoints(points: [number, number][]): string {
  if (points.length === 0) {
    return ""
  }
  const [start, ...rest] = points
  return `M ${start[0].toFixed(2)} ${start[1].toFixed(2)} ${rest
    .map(([x, y]) => `L ${x.toFixed(2)} ${y.toFixed(2)}`)
    .join(" ")}`
}

export function MetricLineChart({ title, series }: MetricLineChartProps): JSX.Element {
  const nonEmpty = series.filter((s) => s.values.length > 0)
  const maxPoints = nonEmpty.reduce((acc, s) => Math.max(acc, s.values.length), 0)

  if (nonEmpty.length === 0 || maxPoints === 0) {
    return (
      <section className="metric-card">
        <h3>{title}</h3>
        <p className="metric-empty">Not enough data</p>
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

  return (
    <section className="metric-card">
      <h3>{title}</h3>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="metric-svg" role="img" aria-label={title}>
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

        {nonEmpty.map((s) => {
          const points = s.values.map((v, i) => [x(i), y(v)] as [number, number])
          return (
            <g key={s.name}>
              <path d={pathFromPoints(points)} fill="none" stroke={s.color} strokeWidth={2} />
              {points.map(([px, py], index) => (
                <circle
                  key={`${s.name}-${index}`}
                  cx={px}
                  cy={py}
                  r={2.8}
                  fill="#ffffff"
                  stroke={s.color}
                  style={{ cursor: "pointer" }}
                >
                  <title>{`${s.name} t${index + 1}: ${s.values[index].toFixed(4)}`}</title>
                </circle>
              ))}
            </g>
          )
        })}
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
