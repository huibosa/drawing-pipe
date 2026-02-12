import { useEffect, useState } from "react"
import { analyzeProfile, fetchTemplates } from "./api"
import { getPipeBounds, mergeBounds } from "./geometry"
import { MetricLineChart } from "./MetricLineChart"
import { convertPipeType, duplicatePipe, pipeTypeName } from "./pipeUtils"
import { TransitionCard } from "./TransitionCard"
import type { AnalyzeResponse, Bounds, Pipe, PipeType, Shape } from "./types"
import "./styles.css"

const PIPE_TYPE_OPTIONS: PipeType[] = ["CircleCircle", "RectRect", "SplineSpline"]
const DEFAULT_BOUNDS: Bounds = { minX: -50, maxX: 50, minY: -50, maxY: 50 }

type ShapeKey = "outer" | "inner"
type PointKey = "origin" | "v1" | "v2" | "v3"

type HoveredPointInput = {
  pipeIndex: number
  shapeKey: ShapeKey
  pointKey: PointKey
}

function snapStep(value: number, step = 0.05): number {
  return Number((Math.round(value / step) * step).toFixed(6))
}

function lockShapeCenterX(shape: Shape): Shape {
  return { ...shape, origin: [0, shape.origin[1]] }
}

function lockPipeCenterX(pipe: Pipe): Pipe {
  return {
    ...pipe,
    outer: lockShapeCenterX(pipe.outer),
    inner: lockShapeCenterX(pipe.inner),
  }
}

function computeBounds(pipes: Pipe[], padding: number): Bounds {
  if (pipes.length === 0) {
    return DEFAULT_BOUNDS
  }
  const all = pipes.map((pipe) => getPipeBounds([pipe.outer, pipe.inner], padding))
  return mergeBounds(all)
}

function percent1(value: number): string {
  return `${(value * 100).toFixed(1)}%`
}

function decimal2(value: number): string {
  return value.toFixed(2)
}

function thicknessSeries(metrics: AnalyzeResponse | null): { name: string; values: number[]; color: string }[] {
  if (!metrics || metrics.thickness_reductions.length === 0) {
    return []
  }

  const colors = ["#174a95", "#0c8a61", "#d95f02", "#9442a3", "#b45309"]
  const count = metrics.thickness_reductions[0]?.length ?? 0
  return Array.from({ length: count }, (_, idx) => ({
    name: `p${idx + 1}`,
    values: metrics.thickness_reductions.map((row) => row[idx] ?? 0),
    color: colors[idx % colors.length],
  }))
}

function updateShapeField(shape: Shape, field: string, value: number): Shape {
  if (shape.shape_type === "Circle") {
    if (field === "ox") {
      return { ...shape, origin: [0, shape.origin[1]] }
    }
    if (field === "oy") {
      return { ...shape, origin: [0, value] }
    }
    if (field === "diameter") {
      return { ...shape, diameter: Math.max(value, 0.01) }
    }
    return shape
  }

  if (shape.shape_type === "Rect") {
    if (field === "ox") {
      return { ...shape, origin: [0, shape.origin[1]] }
    }
    if (field === "oy") {
      return { ...shape, origin: [0, value] }
    }
    if (field === "length") {
      return { ...shape, length: Math.max(value, 0.01) }
    }
    if (field === "width") {
      return { ...shape, width: Math.max(value, 0.01) }
    }
    if (field === "fillet_radius") {
      return { ...shape, fillet_radius: Math.max(value, 0.01) }
    }
    return shape
  }

  if (field === "ox") {
    return { ...shape, origin: [0, shape.origin[1]] }
  }
  if (field === "oy") {
    return { ...shape, origin: [0, value] }
  }
  if (field === "v1x") {
    return { ...shape, v1: [value, shape.v1[1]] }
  }
  if (field === "v1y") {
    return { ...shape, v1: [shape.v1[0], value] }
  }
  if (field === "v2x") {
    return { ...shape, v2: [value, shape.v2[1]] }
  }
  if (field === "v2y") {
    return { ...shape, v2: [shape.v2[0], value] }
  }
  if (field === "v3x") {
    return { ...shape, v3: [value, shape.v3[1]] }
  }
  if (field === "v3y") {
    return { ...shape, v3: [shape.v3[0], value] }
  }
  return shape
}

function PointFieldRow({
  label,
  x,
  y,
  onXChange,
  onYChange,
  onHoverStart,
  onHoverEnd,
  step = 0.1,
  disabledX = false,
}: {
  label: string
  x: number
  y: number
  onXChange: (value: number) => void
  onYChange: (value: number) => void
  onHoverStart?: () => void
  onHoverEnd?: () => void
  step?: number
  disabledX?: boolean
}): JSX.Element {
  return (
    <div className="point-row">
      <span className="point-label">{label}</span>
      <input
        className="field-input"
        type="number"
        value={Number.isFinite(x) ? x : 0}
        step={step}
        disabled={disabledX}
        aria-label={`${label} x`}
        onChange={(event) => onXChange(Number(event.target.value))}
        onMouseEnter={onHoverStart}
        onMouseLeave={onHoverEnd}
      />
      <input
        className="field-input"
        type="number"
        value={Number.isFinite(y) ? y : 0}
        step={step}
        aria-label={`${label} y`}
        onChange={(event) => onYChange(Number(event.target.value))}
        onMouseEnter={onHoverStart}
        onMouseLeave={onHoverEnd}
      />
    </div>
  )
}

function ScalarFieldRow({
  label,
  value,
  onChange,
  step = 0.1,
  min,
}: {
  label: string
  value: number
  onChange: (value: number) => void
  step?: number
  min?: number
}): JSX.Element {
  return (
    <div className="point-row">
      <span className="point-label">{label}</span>
      <input
        className="field-input"
        type="number"
        value={Number.isFinite(value) ? value : 0}
        step={step}
        min={min}
        aria-label={label}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <span />
    </div>
  )
}

function ShapeEditor({
  title,
  shapeKey,
  pipeIndex,
  shape,
  onUpdate,
  onPointHoverStart,
  onPointHoverEnd,
}: {
  title: string
  shapeKey: ShapeKey
  pipeIndex: number
  shape: Shape
  onUpdate: (nextShape: Shape) => void
  onPointHoverStart: (target: HoveredPointInput) => void
  onPointHoverEnd: () => void
}): JSX.Element {
  return (
    <section className="shape-editor">
      <h4>{title}</h4>
      <PointFieldRow
        label="origin"
        x={0}
        y={shape.origin[1]}
        disabledX
        onHoverStart={() => onPointHoverStart({ pipeIndex, shapeKey, pointKey: "origin" })}
        onHoverEnd={onPointHoverEnd}
        onXChange={(value) => onUpdate(updateShapeField(shape, "ox", value))}
        onYChange={(value) => onUpdate(updateShapeField(shape, "oy", value))}
      />

      {shape.shape_type === "Circle" ? (
        <ScalarFieldRow
          label={title === "Outer" ? "D" : "d"}
          value={shape.diameter}
          min={0.01}
          onChange={(value) => onUpdate(updateShapeField(shape, "diameter", value))}
        />
      ) : null}

      {shape.shape_type === "Rect" ? (
        <>
          <ScalarFieldRow
            label="length"
            value={shape.length}
            min={0.01}
            onChange={(value) => onUpdate(updateShapeField(shape, "length", value))}
          />
          <ScalarFieldRow
            label="width"
            value={shape.width}
            min={0.01}
            onChange={(value) => onUpdate(updateShapeField(shape, "width", value))}
          />
          <ScalarFieldRow
            label="fillet radius"
            value={shape.fillet_radius}
            min={0.01}
            onChange={(value) => onUpdate(updateShapeField(shape, "fillet_radius", value))}
          />
        </>
      ) : null}

      {shape.shape_type === "CubicSplineShape" ? (
        <>
          <PointFieldRow
            label="v1"
            x={shape.v1[0]}
            y={shape.v1[1]}
            onHoverStart={() => onPointHoverStart({ pipeIndex, shapeKey, pointKey: "v1" })}
            onHoverEnd={onPointHoverEnd}
            onXChange={(value) => onUpdate(updateShapeField(shape, "v1x", value))}
            onYChange={(value) => onUpdate(updateShapeField(shape, "v1y", value))}
          />
          <PointFieldRow
            label="v2"
            x={shape.v2[0]}
            y={shape.v2[1]}
            onHoverStart={() => onPointHoverStart({ pipeIndex, shapeKey, pointKey: "v2" })}
            onHoverEnd={onPointHoverEnd}
            onXChange={(value) => onUpdate(updateShapeField(shape, "v2x", value))}
            onYChange={(value) => onUpdate(updateShapeField(shape, "v2y", value))}
          />
          <PointFieldRow
            label="v3"
            x={shape.v3[0]}
            y={shape.v3[1]}
            onHoverStart={() => onPointHoverStart({ pipeIndex, shapeKey, pointKey: "v3" })}
            onHoverEnd={onPointHoverEnd}
            onXChange={(value) => onUpdate(updateShapeField(shape, "v3x", value))}
            onYChange={(value) => onUpdate(updateShapeField(shape, "v3y", value))}
          />
        </>
      ) : null}
    </section>
  )
}

function App(): JSX.Element {
  const [templates, setTemplates] = useState<Record<string, Pipe[]>>({})
  const [templateName, setTemplateName] = useState<string>("")
  const [pipes, setPipes] = useState<Pipe[]>([])
  const [metrics, setMetrics] = useState<AnalyzeResponse | null>(null)
  const [error, setError] = useState<string>("")
  const [showMarkers, setShowMarkers] = useState(true)
  const [enableTransitionMarkerDrag, setEnableTransitionMarkerDrag] = useState(false)
  const [padding, setPadding] = useState(0.01)
  const [markerSize, setMarkerSize] = useState(2)
  const [plotLineWidth, setPlotLineWidth] = useState(1.5)
  const [viewBounds, setViewBounds] = useState<Bounds>(DEFAULT_BOUNDS)
  const [hoveredTransitionIndex, setHoveredTransitionIndex] = useState<number | null>(null)
  const [hoveredPipeIndex, setHoveredPipeIndex] = useState<number | null>(null)
  const [hoveredTransitionCardIndex, setHoveredTransitionCardIndex] = useState<number | null>(null)
  const [hoveredPointInput, setHoveredPointInput] = useState<HoveredPointInput | null>(null)

  const loadTemplate = (name: string) => {
    const nextPipes = (templates[name] ?? []).map(duplicatePipe).map(lockPipeCenterX)
    setPipes(nextPipes)
    setViewBounds(computeBounds(nextPipes, padding))
  }

  useEffect(() => {
    fetchTemplates()
      .then((data) => {
        setTemplates(data)
        const firstName = Object.keys(data)[0] ?? ""
        setTemplateName(firstName)
        const initialPipes = firstName ? data[firstName].map(duplicatePipe).map(lockPipeCenterX) : []
        setPipes(initialPipes)
        setViewBounds(computeBounds(initialPipes, padding))
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : String(err))
      })
  }, [])

  useEffect(() => {
    if (pipes.length === 0) {
      setMetrics(null)
      return
    }

    analyzeProfile({ version: 1, pipes })
      .then((result) => {
        setMetrics(result)
        setError("")
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : String(err))
      })
  }, [pipes])

  useEffect(() => {
    setViewBounds(computeBounds(pipes, padding))
  }, [padding])

  const updatePipe = (pipeIdx: number, nextPipe: Pipe) => {
    setPipes((prev) => {
      const updated = [...prev]
      const snappedPipe: Pipe = {
        ...nextPipe,
        outer: {
          ...nextPipe.outer,
          origin: [0, snapStep(nextPipe.outer.origin[1])],
        },
        inner: {
          ...nextPipe.inner,
          origin: [0, snapStep(nextPipe.inner.origin[1])],
        },
      }
      updated[pipeIdx] = lockPipeCenterX(snappedPipe)
      return updated
    })
  }

  const updatePipeShape = (pipeIdx: number, key: ShapeKey, nextShape: Shape) => {
    setPipes((prev) => {
      const updated = [...prev]
      const snappedShape: Shape = {
        ...nextShape,
        origin: [0, snapStep(nextShape.origin[1])],
      }
      updated[pipeIdx] = lockPipeCenterX({ ...updated[pipeIdx], [key]: snappedShape })
      return updated
    })
  }

  const areaSeries = metrics
    ? [{ name: "area", values: metrics.area_reductions, color: "#174a95" }]
    : []
  const eccSeries = metrics
    ? [{ name: "ecc", values: metrics.eccentricity_diffs, color: "#0c8a61" }]
    : []
  const thickSeries = thicknessSeries(metrics)

  return (
    <div className="app-shell">
      <aside className="side-panel">
        <h1>Drawing Pipe Web</h1>

        <section className="metrics-sidebar">
          <MetricLineChart
            title="Area Reduction Rate"
            series={areaSeries}
            valueFormatter={percent1}
            onHoverIndexChange={setHoveredTransitionIndex}
          />
          <MetricLineChart
            title="Eccentricity Difference"
            series={eccSeries}
            valueFormatter={decimal2}
            onHoverIndexChange={setHoveredTransitionIndex}
          />
          <MetricLineChart
            title="Thickness Reduction Rate"
            series={thickSeries}
            valueFormatter={percent1}
            onHoverIndexChange={setHoveredTransitionIndex}
          />
        </section>

        <label className="field-label" htmlFor="template-select">
          Template
        </label>
        <div className="template-row">
          <select
            id="template-select"
            className="field-input"
            value={templateName}
            onChange={(event) => {
              const value = event.target.value
              setTemplateName(value)
              loadTemplate(value)
            }}
          >
            {Object.keys(templates).map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="template-refresh"
            onClick={() => loadTemplate(templateName)}
            disabled={!templateName}
            aria-label="Reload selected template"
            title="Reload template"
          >
            Reload
          </button>
        </div>

        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={showMarkers}
            onChange={(event) => setShowMarkers(event.target.checked)}
          />
          <span>Show markers</span>
        </label>

        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={enableTransitionMarkerDrag}
            onChange={(event) => setEnableTransitionMarkerDrag(event.target.checked)}
          />
          <span>Enable transition marker drag</span>
        </label>

        <label className="field-label compact" htmlFor="padding-range">
          <span>Padding: {padding.toFixed(2)}</span>
          <input
            id="padding-range"
            className="range-input"
            type="range"
            min={0}
            max={0.5}
            step={0.01}
            value={padding}
            onChange={(event) => setPadding(Number(event.target.value))}
          />
        </label>

        <label className="field-label compact" htmlFor="marker-size-range">
          <span>Marker size: {markerSize.toFixed(1)}</span>
          <input
            id="marker-size-range"
            className="range-input"
            type="range"
            min={1}
            max={10}
            step={0.5}
            value={markerSize}
            onChange={(event) => setMarkerSize(Number(event.target.value))}
          />
        </label>

        <label className="field-label compact" htmlFor="line-width-range">
          <span>Plot line width: {plotLineWidth.toFixed(1)}</span>
          <input
            id="line-width-range"
            className="range-input"
            type="range"
            min={0.5}
            max={6}
            step={0.1}
            value={plotLineWidth}
            onChange={(event) => setPlotLineWidth(Number(event.target.value))}
          />
        </label>

        <button
          type="button"
          className="sidebar-button"
          onClick={() => setViewBounds(computeBounds(pipes, padding))}
        >
          Fit View
        </button>

        {error ? <p className="error">{error}</p> : null}
      </aside>

      <main className="main-area">
        {pipes.length > 1 ? (
          <section className="transition-row">
            {pipes.slice(0, -1).map((leftPipe, index) => (
              <TransitionCard
                key={`transition-${index}`}
                leftPipe={leftPipe}
                rightPipe={pipes[index + 1]}
                onLeftPipeChange={(nextPipe) => updatePipe(index, nextPipe)}
                onRightPipeChange={(nextPipe) => updatePipe(index + 1, nextPipe)}
                bounds={viewBounds}
                showMarkers={showMarkers}
                markersDraggable={enableTransitionMarkerDrag}
                markerSize={markerSize}
                plotLineWidth={plotLineWidth}
                title={`Transition: Pipe ${index + 1} -> Pipe ${index + 2}`}
                areaReduction={metrics?.area_reductions[index] ?? null}
                eccentricityDiff={metrics?.eccentricity_diffs[index] ?? null}
                thicknessReduction={metrics?.thickness_reductions[index] ?? null}
                highlighted={
                  hoveredTransitionIndex === index ||
                  hoveredTransitionCardIndex === index ||
                  hoveredPipeIndex === index ||
                  hoveredPipeIndex === index + 1
                }
                emphasizedSide={
                  hoveredPipeIndex === index
                    ? "left"
                    : hoveredPipeIndex === index + 1
                      ? "right"
                      : null
                }
                hoveredInputTarget={
                  hoveredPointInput &&
                  (hoveredPointInput.pipeIndex === index || hoveredPointInput.pipeIndex === index + 1)
                    ? {
                        side: hoveredPointInput.pipeIndex === index ? "left" : "right",
                        shapeKey: hoveredPointInput.shapeKey,
                        pointKey: hoveredPointInput.pointKey,
                      }
                    : null
                }
                onCardMouseEnter={() => setHoveredTransitionCardIndex(index)}
                onCardMouseLeave={() => setHoveredTransitionCardIndex(null)}
              />
            ))}
          </section>
        ) : null}

        <section className="pipe-row">
          {pipes.map((pipe, index) => {
            const linkedToHoveredTransition =
              hoveredTransitionCardIndex === index || hoveredTransitionCardIndex === index - 1
            const highlightedByHover = hoveredPipeIndex === index || linkedToHoveredTransition

            return (
              <article
                key={`pipe-${index}`}
                className={`pipe-card${highlightedByHover ? " hovered" : ""}`}
                onMouseEnter={() => setHoveredPipeIndex(index)}
                onMouseLeave={() => setHoveredPipeIndex(null)}
              >
              <h2>Pipe {index + 1}</h2>

              <label className="field-label compact" htmlFor={`pipe-type-${index}`}>
                <span>Pipe type</span>
                <select
                  id={`pipe-type-${index}`}
                  className="field-input"
                  value={pipeTypeName(pipe)}
                  onChange={(event) =>
                    (() => {
                      const nextPipe = lockPipeCenterX(
                        convertPipeType(pipe, event.target.value as PipeType)
                      )
                      updatePipe(index, nextPipe)
                      setViewBounds(
                        computeBounds(
                          pipes.map((currentPipe, pipeIdx) =>
                            pipeIdx === index ? nextPipe : currentPipe
                          ),
                          padding
                        )
                      )
                    })()
                  }
                >
                  {PIPE_TYPE_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>

              <ShapeEditor
                title="Outer"
                shapeKey="outer"
                pipeIndex={index}
                shape={pipe.outer}
                onUpdate={(nextShape) => updatePipeShape(index, "outer", nextShape)}
                onPointHoverStart={setHoveredPointInput}
                onPointHoverEnd={() => setHoveredPointInput(null)}
              />
              <ShapeEditor
                title="Inner"
                shapeKey="inner"
                pipeIndex={index}
                shape={pipe.inner}
                onUpdate={(nextShape) => updatePipeShape(index, "inner", nextShape)}
                onPointHoverStart={setHoveredPointInput}
                onPointHoverEnd={() => setHoveredPointInput(null)}
              />

              <div className="pipe-actions">
                <button
                  className="danger"
                  type="button"
                  onClick={() => {
                    setPipes((prev) => {
                      const next = prev.filter((_, pipeIdx) => pipeIdx !== index)
                      setViewBounds(computeBounds(next, padding))
                      return next
                    })
                  }}
                >
                  x
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPipes((prev) => {
                      const next = [...prev]
                      next.splice(index + 1, 0, lockPipeCenterX(duplicatePipe(pipe)))
                      setViewBounds(computeBounds(next, padding))
                      return next
                    })
                  }}
                >
                  +
                </button>
              </div>
            </article>
            )
          })}
        </section>
      </main>
    </div>
  )
}

export default App
