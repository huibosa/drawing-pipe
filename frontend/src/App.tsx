import { useEffect, useMemo, useState } from "react"
import { analyzeProfile, fetchTemplates } from "./api"
import { getPipeBounds, mergeBounds } from "./geometry"
import { convertPipeType, duplicatePipe, pipeTypeName } from "./pipeUtils"
import { TransitionCard } from "./TransitionCard"
import type { AnalyzeResponse, Pipe, PipeType, Shape } from "./types"
import "./styles.css"

const PIPE_TYPE_OPTIONS: PipeType[] = ["CircleCircle", "RectRect", "SplineSpline"]
const DEBOUNCE_SECONDS = 1

type ShapeKey = "outer" | "inner"

function updateShapeField(shape: Shape, field: string, value: number): Shape {
  if (shape.shape_type === "Circle") {
    if (field === "ox") {
      return { ...shape, origin: [value, shape.origin[1]] }
    }
    if (field === "oy") {
      return { ...shape, origin: [shape.origin[0], value] }
    }
    if (field === "diameter") {
      return { ...shape, diameter: Math.max(value, 0.01) }
    }
    return shape
  }

  if (shape.shape_type === "Rect") {
    if (field === "ox") {
      return { ...shape, origin: [value, shape.origin[1]] }
    }
    if (field === "oy") {
      return { ...shape, origin: [shape.origin[0], value] }
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
    return { ...shape, origin: [value, shape.origin[1]] }
  }
  if (field === "oy") {
    return { ...shape, origin: [shape.origin[0], value] }
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

function NumberField({
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
    <label className="field-label compact">
      <span>{label}</span>
      <input
        className="field-input"
        type="number"
        value={Number.isFinite(value) ? value : 0}
        step={step}
        min={min}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  )
}

function ShapeEditor({
  title,
  shape,
  onUpdate,
}: {
  title: string
  shape: Shape
  onUpdate: (nextShape: Shape) => void
}): JSX.Element {
  return (
    <section className="shape-editor">
      <h4>{title}</h4>
      <div className="xy-row">
        <NumberField
          label="origin x"
          value={shape.origin[0]}
          onChange={(value) => onUpdate(updateShapeField(shape, "ox", value))}
        />
        <NumberField
          label="origin y"
          value={shape.origin[1]}
          onChange={(value) => onUpdate(updateShapeField(shape, "oy", value))}
        />
      </div>

      {shape.shape_type === "Circle" ? (
        <NumberField
          label="diameter"
          value={shape.diameter}
          min={0.01}
          onChange={(value) => onUpdate(updateShapeField(shape, "diameter", value))}
        />
      ) : null}

      {shape.shape_type === "Rect" ? (
        <>
          <NumberField
            label="length"
            value={shape.length}
            min={0.01}
            onChange={(value) => onUpdate(updateShapeField(shape, "length", value))}
          />
          <NumberField
            label="width"
            value={shape.width}
            min={0.01}
            onChange={(value) => onUpdate(updateShapeField(shape, "width", value))}
          />
          <NumberField
            label="fillet radius"
            value={shape.fillet_radius}
            min={0.01}
            onChange={(value) => onUpdate(updateShapeField(shape, "fillet_radius", value))}
          />
        </>
      ) : null}

      {shape.shape_type === "CubicSplineShape" ? (
        <>
          <div className="xy-row">
            <NumberField
              label="v1 x"
              value={shape.v1[0]}
              onChange={(value) => onUpdate(updateShapeField(shape, "v1x", value))}
            />
            <NumberField
              label="v1 y"
              value={shape.v1[1]}
              onChange={(value) => onUpdate(updateShapeField(shape, "v1y", value))}
            />
          </div>
          <div className="xy-row">
            <NumberField
              label="v2 x"
              value={shape.v2[0]}
              onChange={(value) => onUpdate(updateShapeField(shape, "v2x", value))}
            />
            <NumberField
              label="v2 y"
              value={shape.v2[1]}
              onChange={(value) => onUpdate(updateShapeField(shape, "v2y", value))}
            />
          </div>
          <div className="xy-row">
            <NumberField
              label="v3 x"
              value={shape.v3[0]}
              onChange={(value) => onUpdate(updateShapeField(shape, "v3x", value))}
            />
            <NumberField
              label="v3 y"
              value={shape.v3[1]}
              onChange={(value) => onUpdate(updateShapeField(shape, "v3y", value))}
            />
          </div>
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
  const [padding, setPadding] = useState(0.2)
  const [dirtyAt, setDirtyAt] = useState<Record<number, number>>({})
  const [appliedAt, setAppliedAt] = useState<Record<number, number>>({})

  useEffect(() => {
    fetchTemplates()
      .then((data) => {
        setTemplates(data)
        const firstName = Object.keys(data)[0] ?? ""
        setTemplateName(firstName)
        setPipes(firstName ? data[firstName].map(duplicatePipe) : [])
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

    const timer = window.setTimeout(() => {
      analyzeProfile({ version: 1, pipes })
        .then((result) => {
          setMetrics(result)
          const now = Date.now()
          const entries = Object.keys(dirtyAt).map((idx) => [Number(idx), now] as const)
          setAppliedAt((prev) => ({ ...prev, ...Object.fromEntries(entries) }))
          setError("")
        })
        .catch((err: unknown) => {
          setError(err instanceof Error ? err.message : String(err))
        })
    }, DEBOUNCE_SECONDS * 1000)

    return () => window.clearTimeout(timer)
  }, [pipes, dirtyAt])

  const now = Date.now()

  const commonBounds = useMemo(() => {
    if (pipes.length === 0) {
      return { minX: -50, maxX: 50, minY: -50, maxY: 50 }
    }
    const all = pipes.map((pipe) => getPipeBounds([pipe.outer, pipe.inner], padding))
    return mergeBounds(all)
  }, [pipes, padding])

  const markDirty = (pipeIdx: number) => {
    setDirtyAt((prev) => ({ ...prev, [pipeIdx]: Date.now() }))
  }

  const updatePipe = (pipeIdx: number, nextPipe: Pipe) => {
    setPipes((prev) => {
      const updated = [...prev]
      updated[pipeIdx] = nextPipe
      return updated
    })
    markDirty(pipeIdx)
  }

  const updatePipeShape = (pipeIdx: number, key: ShapeKey, nextShape: Shape) => {
    setPipes((prev) => {
      const updated = [...prev]
      updated[pipeIdx] = { ...updated[pipeIdx], [key]: nextShape }
      return updated
    })
    markDirty(pipeIdx)
  }

  const statusText = (pipeIdx: number): string => {
    const dirty = dirtyAt[pipeIdx]
    const applied = appliedAt[pipeIdx] ?? 0
    if (!dirty || dirty <= applied) {
      return "Updated"
    }
    const elapsed = (now - dirty) / 1000
    const remaining = DEBOUNCE_SECONDS - elapsed
    if (remaining > 0) {
      return `Editing... auto-apply in ${remaining.toFixed(1)}s`
    }
    return "Applying changes..."
  }

  return (
    <div className="app-shell">
      <aside className="side-panel">
        <h1>Drawing Pipe Web</h1>

        <label className="field-label" htmlFor="template-select">
          Template
        </label>
        <select
          id="template-select"
          className="field-input"
          value={templateName}
          onChange={(event) => {
            const value = event.target.value
            setTemplateName(value)
            setPipes((templates[value] ?? []).map(duplicatePipe))
            setDirtyAt({})
            setAppliedAt({})
          }}
        >
          {Object.keys(templates).map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>

        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={showMarkers}
            onChange={(event) => setShowMarkers(event.target.checked)}
          />
          <span>Show markers</span>
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
                bounds={commonBounds}
                showMarkers={showMarkers}
                title={`Transition: Pipe ${index + 1} -> Pipe ${index + 2}`}
                areaReduction={metrics?.area_reductions[index] ?? null}
                eccentricityDiff={metrics?.eccentricity_diffs[index] ?? null}
                thicknessReduction={metrics?.thickness_reductions[index] ?? null}
              />
            ))}
          </section>
        ) : null}

        <section className="pipe-row">
          {pipes.map((pipe, index) => (
            <article key={`pipe-${index}`} className="pipe-card">
              <h2>Pipe {index + 1}</h2>

              <label className="field-label compact" htmlFor={`pipe-type-${index}`}>
                <span>Pipe type</span>
                <select
                  id={`pipe-type-${index}`}
                  className="field-input"
                  value={pipeTypeName(pipe)}
                  onChange={(event) =>
                    updatePipe(index, convertPipeType(pipe, event.target.value as PipeType))
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
                shape={pipe.outer}
                onUpdate={(nextShape) => updatePipeShape(index, "outer", nextShape)}
              />
              <ShapeEditor
                title="Inner"
                shape={pipe.inner}
                onUpdate={(nextShape) => updatePipeShape(index, "inner", nextShape)}
              />

              <p className="pipe-status">{statusText(index)}</p>

              <div className="pipe-actions">
                <button
                  className="danger"
                  type="button"
                  onClick={() => {
                    setPipes((prev) => prev.filter((_, pipeIdx) => pipeIdx !== index))
                    setDirtyAt({})
                    setAppliedAt({})
                  }}
                >
                  x
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPipes((prev) => {
                      const next = [...prev]
                      next.splice(index + 1, 0, duplicatePipe(pipe))
                      return next
                    })
                    setDirtyAt({})
                    setAppliedAt({})
                  }}
                >
                  +
                </button>
              </div>
            </article>
          ))}
        </section>
      </main>
    </div>
  )
}

export default App
