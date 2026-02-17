import { useEffect, useRef, useState } from "react"
import { DualAxisMetricChart } from "../features/metrics/DualAxisMetricChart"
import { MetricLineChart } from "../features/metrics/MetricLineChart"
import { TransitionCard } from "../features/transitions/TransitionCard"
import { analyzeProfile, fetchTemplates } from "../shared/api/client"
import type { Locale } from "../shared/i18n/i18n"
import { t } from "../shared/i18n/i18n"
import { getPipeBounds, mergeBounds } from "../shared/lib/geometry"
import { convertPipeType, duplicatePipe, pipeTypeName } from "../shared/lib/pipeUtils"
import type { AnalyzeResponse, Bounds, Pipe, PipeType, Shape } from "../shared/types/domain"
import "./styles.css"

const PIPE_TYPE_OPTIONS: PipeType[] = ["CircleCircle", "RectRect", "SplineSpline"]
const DEFAULT_BOUNDS: Bounds = { minX: -50, maxX: 50, minY: -50, maxY: 50 }
const LOCALE_STORAGE_KEY = "drawing-pipe-locale"

type ShapeKey = "outer" | "inner"
type PointKey = "origin" | "v1" | "v2" | "v3"

type HoveredPointInput = {
  pipeIndex: number
  shapeKey: ShapeKey
  pointKey: PointKey
}

type HoveredThicknessPoint = {
  transitionIndex: number
  markerIndex: number
}

type LockAxis = "x" | "y"
type LockTarget = "origin" | "diameter" | "length" | "width" | "fillet_radius" | "v1" | "v2" | "v3"
type InputLockMap = Record<string, boolean>

type MarkerLockTarget = {
  side: "left" | "right"
  kind: "shape" | "center"
  shapeKey: "outer" | "inner"
  markerIndex: number
}

type MarkerDragAxes = {
  allowX: boolean
  allowY: boolean
}

type CenterShapeDragAxes = {
  outer: MarkerDragAxes
  inner: MarkerDragAxes
}

const INPUT_LOCKS_STORAGE_KEY = "drawing-pipe-input-locks"

function lockKey(pipeIndex: number, shapeKey: ShapeKey, target: LockTarget, axis: LockAxis): string {
  return `${pipeIndex}:${shapeKey}:${target}:${axis}`
}

function buildDefaultLocks(pipes: Pipe[]): InputLockMap {
  const locks: InputLockMap = {}

  pipes.forEach((pipe, pipeIndex) => {
    locks[lockKey(pipeIndex, "inner", "origin", "x")] = true
    locks[lockKey(pipeIndex, "inner", "origin", "y")] = true
    locks[lockKey(pipeIndex, "outer", "origin", "x")] = true

    if (pipe.outer.shape_type === "CubicSplineShape") {
      locks[lockKey(pipeIndex, "outer", "v1", "x")] = true
    }
    if (pipe.inner.shape_type === "CubicSplineShape") {
      locks[lockKey(pipeIndex, "inner", "v1", "x")] = true
    }
  })

  return locks
}

type LockEntry = {
  target: LockTarget
  axis: LockAxis
}

function lockEntriesForShape(shape: Shape): LockEntry[] {
  const entries: LockEntry[] = [
    { target: "origin", axis: "x" },
    { target: "origin", axis: "y" },
  ]

  if (shape.shape_type === "Circle") {
    entries.push({ target: "diameter", axis: "y" })
    return entries
  }

  if (shape.shape_type === "Rect") {
    entries.push({ target: "length", axis: "y" })
    entries.push({ target: "width", axis: "y" })
    entries.push({ target: "fillet_radius", axis: "y" })
    return entries
  }

  entries.push({ target: "v1", axis: "x" })
  entries.push({ target: "v1", axis: "y" })
  entries.push({ target: "v2", axis: "x" })
  entries.push({ target: "v2", axis: "y" })
  entries.push({ target: "v3", axis: "x" })
  entries.push({ target: "v3", axis: "y" })
  return entries
}

function lockKeysForShape(pipeIndex: number, shapeKey: ShapeKey, shape: Shape): string[] {
  return lockEntriesForShape(shape).map((entry) => lockKey(pipeIndex, shapeKey, entry.target, entry.axis))
}

function snapStep(value: number, step = 0.05): number {
  return Number((Math.round(value / step) * step).toFixed(6))
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

function PointFieldRow({
  label,
  x,
  y,
  onXChange,
  onYChange,
  onHoverStart,
  onHoverEnd,
  lockedX = false,
  lockedY = false,
  onToggleLockX,
  onToggleLockY,
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
  lockedX?: boolean
  lockedY?: boolean
  onToggleLockX?: () => void
  onToggleLockY?: () => void
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
        disabled={disabledX || lockedX}
        aria-label={`${label} x`}
        onChange={(event) => onXChange(Number(event.target.value))}
        onMouseEnter={onHoverStart}
        onMouseLeave={onHoverEnd}
      />
      <button
        type="button"
        className="lock-toggle"
        onClick={onToggleLockX}
        aria-label={`${label} x lock`}
        title={lockedX ? "Locked" : "Editable"}
      >
        {lockedX ? "🔴" : "🟢"}
      </button>
      <input
        className="field-input"
        type="number"
        value={Number.isFinite(y) ? y : 0}
        step={step}
        disabled={lockedY}
        aria-label={`${label} y`}
        onChange={(event) => onYChange(Number(event.target.value))}
        onMouseEnter={onHoverStart}
        onMouseLeave={onHoverEnd}
      />
      <button
        type="button"
        className="lock-toggle"
        onClick={onToggleLockY}
        aria-label={`${label} y lock`}
        title={lockedY ? "Locked" : "Editable"}
      >
        {lockedY ? "🔴" : "🟢"}
      </button>
    </div>
  )
}

function ScalarFieldRow({
  label,
  value,
  onChange,
  locked = false,
  onToggleLock,
  step = 0.1,
  min,
}: {
  label: string
  value: number
  onChange: (value: number) => void
  locked?: boolean
  onToggleLock?: () => void
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
        disabled={locked}
        aria-label={label}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <button
        type="button"
        className="lock-toggle"
        onClick={onToggleLock}
        aria-label={`${label} lock`}
        title={locked ? "Locked" : "Editable"}
      >
        {locked ? "🔴" : "🟢"}
      </button>
    </div>
  )
}

function ShapeEditor({
  title,
  originLabel,
  diameterLabel,
  lengthLabel,
  widthLabel,
  filletRadiusLabel,
  v1Label,
  v2Label,
  v3Label,
  shapeKey,
  pipeIndex,
  shape,
  onUpdate,
  onPointHoverStart,
  onPointHoverEnd,
  isLocked,
  onToggleLock,
  allLocked,
  onToggleAllLocks,
}: {
  title: string
  originLabel: string
  diameterLabel: string
  lengthLabel: string
  widthLabel: string
  filletRadiusLabel: string
  v1Label: string
  v2Label: string
  v3Label: string
  shapeKey: ShapeKey
  pipeIndex: number
  shape: Shape
  onUpdate: (nextShape: Shape) => void
  onPointHoverStart: (target: HoveredPointInput) => void
  onPointHoverEnd: () => void
  isLocked: (target: LockTarget, axis: LockAxis) => boolean
  onToggleLock: (target: LockTarget, axis: LockAxis) => void
  allLocked: boolean
  onToggleAllLocks: () => void
}): JSX.Element {
  return (
    <section className="shape-editor">
      <div className="shape-header">
        <h4>{title}</h4>
        <button
          type="button"
          className="lock-toggle"
          onClick={onToggleAllLocks}
          aria-label={`${title} lock all`}
          title={allLocked ? "Unlock all" : "Lock all"}
        >
          {allLocked ? "🔴" : "🟢"}
        </button>
      </div>
      <PointFieldRow
        label={originLabel}
        x={shape.origin[0]}
        y={shape.origin[1]}
        disabledX={false}
        lockedX={isLocked("origin", "x")}
        lockedY={isLocked("origin", "y")}
        onToggleLockX={() => onToggleLock("origin", "x")}
        onToggleLockY={() => onToggleLock("origin", "y")}
        onHoverStart={() => onPointHoverStart({ pipeIndex, shapeKey, pointKey: "origin" })}
        onHoverEnd={onPointHoverEnd}
        onXChange={(value) => onUpdate(updateShapeField(shape, "ox", value))}
        onYChange={(value) => onUpdate(updateShapeField(shape, "oy", value))}
      />

      {shape.shape_type === "Circle" ? (
        <ScalarFieldRow
          label={diameterLabel}
          value={shape.diameter}
          min={0.01}
          locked={isLocked("diameter", "y")}
          onToggleLock={() => onToggleLock("diameter", "y")}
          onChange={(value) => onUpdate(updateShapeField(shape, "diameter", value))}
        />
      ) : null}

      {shape.shape_type === "Rect" ? (
        <>
          <ScalarFieldRow
            label={lengthLabel}
            value={shape.length}
            min={0.01}
            locked={isLocked("length", "y")}
            onToggleLock={() => onToggleLock("length", "y")}
            onChange={(value) => onUpdate(updateShapeField(shape, "length", value))}
          />
          <ScalarFieldRow
            label={widthLabel}
            value={shape.width}
            min={0.01}
            locked={isLocked("width", "y")}
            onToggleLock={() => onToggleLock("width", "y")}
            onChange={(value) => onUpdate(updateShapeField(shape, "width", value))}
          />
          <ScalarFieldRow
            label={filletRadiusLabel}
            value={shape.fillet_radius}
            min={0.01}
            locked={isLocked("fillet_radius", "y")}
            onToggleLock={() => onToggleLock("fillet_radius", "y")}
            onChange={(value) => onUpdate(updateShapeField(shape, "fillet_radius", value))}
          />
        </>
      ) : null}

      {shape.shape_type === "CubicSplineShape" ? (
        <>
          <PointFieldRow
            label={v1Label}
            x={shape.v1[0]}
            y={shape.v1[1]}
            lockedX={isLocked("v1", "x")}
            lockedY={isLocked("v1", "y")}
            onToggleLockX={() => onToggleLock("v1", "x")}
            onToggleLockY={() => onToggleLock("v1", "y")}
            onHoverStart={() => onPointHoverStart({ pipeIndex, shapeKey, pointKey: "v1" })}
            onHoverEnd={onPointHoverEnd}
            onXChange={(value) => onUpdate(updateShapeField(shape, "v1x", value))}
            onYChange={(value) => onUpdate(updateShapeField(shape, "v1y", value))}
          />
          <PointFieldRow
            label={v2Label}
            x={shape.v2[0]}
            y={shape.v2[1]}
            lockedX={isLocked("v2", "x")}
            lockedY={isLocked("v2", "y")}
            onToggleLockX={() => onToggleLock("v2", "x")}
            onToggleLockY={() => onToggleLock("v2", "y")}
            onHoverStart={() => onPointHoverStart({ pipeIndex, shapeKey, pointKey: "v2" })}
            onHoverEnd={onPointHoverEnd}
            onXChange={(value) => onUpdate(updateShapeField(shape, "v2x", value))}
            onYChange={(value) => onUpdate(updateShapeField(shape, "v2y", value))}
          />
          <PointFieldRow
            label={v3Label}
            x={shape.v3[0]}
            y={shape.v3[1]}
            lockedX={isLocked("v3", "x")}
            lockedY={isLocked("v3", "y")}
            onToggleLockX={() => onToggleLock("v3", "x")}
            onToggleLockY={() => onToggleLock("v3", "y")}
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
  const [locale, setLocale] = useState<Locale>(() => {
    const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY)
    return stored === "zh-CN" ? "zh-CN" : "zh-CN"
  })
  const [templates, setTemplates] = useState<Record<string, Pipe[]>>({})
  const [templateName, setTemplateName] = useState<string>("")
  const [pipes, setPipes] = useState<Pipe[]>([])
  const [metrics, setMetrics] = useState<AnalyzeResponse | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [error, setError] = useState<string>("")
  const [showMarkers, setShowMarkers] = useState(true)
  const [enableTransitionMarkerDrag, setEnableTransitionMarkerDrag] = useState(true)
  const [padding, setPadding] = useState(0.01)
  const [markerSize, setMarkerSize] = useState(2)
  const [plotLineWidth, setPlotLineWidth] = useState(2.0)
  const [viewBounds, setViewBounds] = useState<Bounds>(DEFAULT_BOUNDS)
  const [hoveredTransitionIndex, setHoveredTransitionIndex] = useState<number | null>(null)
  const [hoveredPipeIndex, setHoveredPipeIndex] = useState<number | null>(null)
  const [hoveredTransitionCardIndex, setHoveredTransitionCardIndex] = useState<number | null>(null)
  const [expandedTransitionIndex, setExpandedTransitionIndex] = useState<number | null>(null)
  const [hoveredPointInput, setHoveredPointInput] = useState<HoveredPointInput | null>(null)
  const [hoveredThicknessPoint, setHoveredThicknessPoint] = useState<HoveredThicknessPoint | null>(null)
  const [inputLocks, setInputLocks] = useState<InputLockMap>(() => {
    try {
      const stored = window.localStorage.getItem(INPUT_LOCKS_STORAGE_KEY)
      return stored ? (JSON.parse(stored) as InputLockMap) : {}
    } catch {
      return {}
    }
  })
  const analyzeTimerRef = useRef<number | null>(null)
  const analyzeAbortRef = useRef<AbortController | null>(null)
  const analyzeRequestSeqRef = useRef(0)
  const pipesRef = useRef<Pipe[]>([])
  const draggingMarkerRef = useRef(false)

  useEffect(() => {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale)
  }, [locale])

  useEffect(() => {
    window.localStorage.setItem(INPUT_LOCKS_STORAGE_KEY, JSON.stringify(inputLocks))
  }, [inputLocks])

  const executeAnalyze = (targetPipes: Pipe[]) => {
    if (targetPipes.length === 0) {
      analyzeAbortRef.current?.abort()
      setMetrics(null)
      setIsAnalyzing(false)
      return
    }

    analyzeAbortRef.current?.abort()
    const controller = new AbortController()
    analyzeAbortRef.current = controller
    const requestId = ++analyzeRequestSeqRef.current
    setIsAnalyzing(true)

    analyzeProfile({ version: 1, pipes: targetPipes }, controller.signal)
      .then((result) => {
        if (requestId !== analyzeRequestSeqRef.current) {
          return
        }
        setMetrics(result)
        setError("")
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) {
          return
        }
        if (requestId !== analyzeRequestSeqRef.current) {
          return
        }
        setError(err instanceof Error ? err.message : String(err))
      })
      .finally(() => {
        if (requestId !== analyzeRequestSeqRef.current) {
          return
        }
        setIsAnalyzing(false)
      })
  }

  const scheduleAnalyze = (targetPipes: Pipe[], immediate = false) => {
    if (analyzeTimerRef.current !== null) {
      window.clearTimeout(analyzeTimerRef.current)
      analyzeTimerRef.current = null
    }

    if (immediate) {
      executeAnalyze(targetPipes)
      return
    }

    analyzeTimerRef.current = window.setTimeout(() => {
      analyzeTimerRef.current = null
      executeAnalyze(targetPipes)
    }, 160)
  }

  const isInputLocked = (pipeIndex: number, shapeKey: ShapeKey, target: LockTarget, axis: LockAxis): boolean =>
    Boolean(inputLocks[lockKey(pipeIndex, shapeKey, target, axis)])

  const toggleInputLock = (pipeIndex: number, shapeKey: ShapeKey, target: LockTarget, axis: LockAxis) => {
    const key = lockKey(pipeIndex, shapeKey, target, axis)
    setInputLocks((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const allLocksEnabled = (keys: string[]): boolean => keys.length > 0 && keys.every((key) => Boolean(inputLocks[key]))

  const applyBulkLocks = (keys: string[], lockAll: boolean) => {
    setInputLocks((prev) => {
      const updated = { ...prev }
      keys.forEach((key) => {
        updated[key] = lockAll
      })
      return updated
    })
  }

  const toggleBulkLocks = (keys: string[]) => {
    applyBulkLocks(keys, !allLocksEnabled(keys))
  }

  const transitionMarkerDragAxes = (transitionIndex: number, marker: MarkerLockTarget): MarkerDragAxes => {
    const pipeIndex = marker.side === "left" ? transitionIndex : transitionIndex + 1

    if (marker.kind === "center") {
      return {
        allowX:
          !isInputLocked(pipeIndex, "outer", "origin", "x") ||
          !isInputLocked(pipeIndex, "inner", "origin", "x"),
        allowY:
          !isInputLocked(pipeIndex, "outer", "origin", "y") ||
          !isInputLocked(pipeIndex, "inner", "origin", "y"),
      }
    }

    const pipe = marker.side === "left" ? pipes[transitionIndex] : pipes[transitionIndex + 1]
    if (!pipe) {
      return { allowX: false, allowY: false }
    }
    const shape = pipe[marker.shapeKey]

    if (shape.shape_type === "Circle") {
      const unlocked = !isInputLocked(pipeIndex, marker.shapeKey, "diameter", "y")
      return { allowX: unlocked, allowY: unlocked }
    }

    if (shape.shape_type === "Rect") {
      if (marker.markerIndex === 0 || marker.markerIndex === 4) {
        const unlocked = !isInputLocked(pipeIndex, marker.shapeKey, "length", "y")
        return { allowX: unlocked, allowY: unlocked }
      }
      if (marker.markerIndex === 1 || marker.markerIndex === 3) {
        const unlocked = !isInputLocked(pipeIndex, marker.shapeKey, "fillet_radius", "y")
        return { allowX: unlocked, allowY: unlocked }
      }
      const unlocked = !isInputLocked(pipeIndex, marker.shapeKey, "width", "y")
      return { allowX: unlocked, allowY: unlocked }
    }

    if (marker.markerIndex === 0 || marker.markerIndex === 4) {
      return {
        allowX: !isInputLocked(pipeIndex, marker.shapeKey, "v1", "x"),
        allowY: !isInputLocked(pipeIndex, marker.shapeKey, "v1", "y"),
      }
    }
    if (marker.markerIndex === 1 || marker.markerIndex === 3) {
      return {
        allowX: !isInputLocked(pipeIndex, marker.shapeKey, "v2", "x"),
        allowY: !isInputLocked(pipeIndex, marker.shapeKey, "v2", "y"),
      }
    }
    return {
      allowX: !isInputLocked(pipeIndex, marker.shapeKey, "v3", "x"),
      allowY: !isInputLocked(pipeIndex, marker.shapeKey, "v3", "y"),
    }
  }

  const transitionCenterShapeDragAxes = (
    transitionIndex: number,
    side: "left" | "right"
  ): CenterShapeDragAxes => {
    const pipeIndex = side === "left" ? transitionIndex : transitionIndex + 1
    return {
      outer: {
        allowX: !isInputLocked(pipeIndex, "outer", "origin", "x"),
        allowY: !isInputLocked(pipeIndex, "outer", "origin", "y"),
      },
      inner: {
        allowX: !isInputLocked(pipeIndex, "inner", "origin", "x"),
        allowY: !isInputLocked(pipeIndex, "inner", "origin", "y"),
      },
    }
  }

  const loadTemplate = (name: string) => {
    const nextPipes = (templates[name] ?? []).map(duplicatePipe)
    setPipes(nextPipes)
    setInputLocks(buildDefaultLocks(nextPipes))
    setViewBounds(computeBounds(nextPipes, padding))
  }

  useEffect(() => {
    fetchTemplates()
      .then((data) => {
        setTemplates(data)
        const firstName = Object.keys(data)[0] ?? ""
        setTemplateName(firstName)
        const initialPipes = firstName ? data[firstName].map(duplicatePipe) : []
        setPipes(initialPipes)
        setInputLocks(buildDefaultLocks(initialPipes))
        setViewBounds(computeBounds(initialPipes, padding))
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : String(err))
      })
  }, [])

  useEffect(() => {
    pipesRef.current = pipes
    if (pipes.length === 0) {
      if (analyzeTimerRef.current !== null) {
        window.clearTimeout(analyzeTimerRef.current)
        analyzeTimerRef.current = null
      }
      analyzeAbortRef.current?.abort()
      setMetrics(null)
      setIsAnalyzing(false)
      return
    }
    scheduleAnalyze(pipes)
  }, [pipes])

  useEffect(
    () => () => {
      if (analyzeTimerRef.current !== null) {
        window.clearTimeout(analyzeTimerRef.current)
      }
      analyzeAbortRef.current?.abort()
    },
    []
  )

  useEffect(() => {
    setViewBounds(computeBounds(pipes, padding))
  }, [padding])

  useEffect(() => {
    if (expandedTransitionIndex === null) {
      return
    }
    if (expandedTransitionIndex < 0 || expandedTransitionIndex >= pipes.length - 1) {
      setExpandedTransitionIndex(null)
    }
  }, [expandedTransitionIndex, pipes])

  useEffect(() => {
    if (expandedTransitionIndex === null) {
      return
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setExpandedTransitionIndex(null)
      }
    }

    window.addEventListener("keydown", onKeyDown)
    return () => {
      window.removeEventListener("keydown", onKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [expandedTransitionIndex])

  const updatePipe = (pipeIdx: number, nextPipe: Pipe) => {
    setPipes((prev) => {
      const updated = [...prev]
      const snappedPipe: Pipe = {
        ...nextPipe,
        outer: {
          ...nextPipe.outer,
          origin: [snapStep(nextPipe.outer.origin[0]), snapStep(nextPipe.outer.origin[1])],
        },
        inner: {
          ...nextPipe.inner,
          origin: [snapStep(nextPipe.inner.origin[0]), snapStep(nextPipe.inner.origin[1])],
        },
      }
      updated[pipeIdx] = snappedPipe
      return updated
    })
  }

  const updatePipeShape = (pipeIdx: number, key: ShapeKey, nextShape: Shape) => {
    setPipes((prev) => {
      const updated = [...prev]
      const snappedShape: Shape = {
        ...nextShape,
        origin: [snapStep(nextShape.origin[0]), snapStep(nextShape.origin[1])],
      }
      updated[pipeIdx] = { ...updated[pipeIdx], [key]: snappedShape }
      return updated
    })
  }

  const areaValues = metrics?.area_reductions ?? []
  const eccValues = metrics?.eccentricity_diffs ?? []
  const thickSeries = thicknessSeries(metrics)
  const pipeTypeLabelByOption: Record<PipeType, string> = {
    CircleCircle: t(locale, "pipeTypeCircleCircle"),
    RectRect: t(locale, "pipeTypeRectRect"),
    SplineSpline: t(locale, "pipeTypeSplineSpline"),
  }

  const renderTransitionCard = (index: number, showExpandButton: boolean): JSX.Element | null => {
    const leftPipe = pipes[index]
    const rightPipe = pipes[index + 1]
    if (!leftPipe || !rightPipe) {
      return null
    }

    return (
      <TransitionCard
        key={`transition-${index}${showExpandButton ? "-row" : "-modal"}`}
        leftPipe={leftPipe}
        rightPipe={rightPipe}
        onLeftPipeChange={(nextPipe) => updatePipe(index, nextPipe)}
        onRightPipeChange={(nextPipe) => updatePipe(index + 1, nextPipe)}
        bounds={viewBounds}
        showMarkers={showMarkers}
        markersDraggable={enableTransitionMarkerDrag}
        canDragMarker={(marker) => {
          const axes = transitionMarkerDragAxes(index, marker)
          return axes.allowX || axes.allowY
        }}
        markerDragAxes={(marker) => transitionMarkerDragAxes(index, marker)}
        centerDragAxes={(side) => transitionCenterShapeDragAxes(index, side)}
        markerSize={markerSize}
        plotLineWidth={plotLineWidth}
        title={t(locale, "transitionTitle", { from: index + 1, to: index + 2 })}
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
        hoveredThicknessMarkerIndex={
          hoveredThicknessPoint?.transitionIndex === index ? hoveredThicknessPoint.markerIndex : null
        }
        onCardMouseEnter={() => setHoveredTransitionCardIndex(index)}
        onCardMouseLeave={() => setHoveredTransitionCardIndex(null)}
        onMarkerDragStart={() => {
          draggingMarkerRef.current = true
        }}
        onMarkerDragEnd={() => {
          if (!draggingMarkerRef.current) {
            return
          }
          draggingMarkerRef.current = false
          scheduleAnalyze(pipesRef.current, true)
        }}
        showExpandButton={showExpandButton}
        onExpand={() => setExpandedTransitionIndex(index)}
      />
    )
  }

  return (
    <div className="app-shell">
      <aside className="side-panel">
        <div className="locale-row">
          <h1>{t(locale, "appTitle")}</h1>
          <button
            type="button"
            className="locale-toggle"
            onClick={() => setLocale((prev) => (prev === "en" ? "zh-CN" : "en"))}
          >
            {t(locale, "languageToggle")}
          </button>
        </div>

        <section className="metrics-sidebar">
          <DualAxisMetricChart
            title={`${t(locale, "areaReductionRate")} / ${t(locale, "eccentricity")}`}
            leftLabel={t(locale, "areaReductionRate")}
            rightLabel={t(locale, "eccentricity")}
            leftValues={areaValues}
            rightValues={eccValues}
            leftFormatter={percent1}
            rightFormatter={(value) => `${decimal2(value)}mm`}
            onHoverIndexChange={setHoveredTransitionIndex}
            emptyText={t(locale, "notEnoughData")}
          />
          <MetricLineChart
            title={t(locale, "thicknessReductionRate")}
            series={thickSeries}
            valueFormatter={percent1}
            onHoverIndexChange={setHoveredTransitionIndex}
            onHoverPointChange={(point) => {
              if (!point) {
                setHoveredThicknessPoint(null)
                return
              }
              setHoveredThicknessPoint({
                transitionIndex: point.pointIndex,
                markerIndex: point.seriesIndex,
              })
            }}
            emptyText={t(locale, "notEnoughData")}
          />
          <p className={`analysis-status${isAnalyzing ? " visible" : ""}`}>{t(locale, "analyzing")}</p>
        </section>

        <label className="field-label" htmlFor="template-select">
          {t(locale, "template")}
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
            aria-label={t(locale, "reloadSelectedTemplate")}
            title={t(locale, "reload")}
          >
            {t(locale, "reload")}
          </button>
        </div>

        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={showMarkers}
            onChange={(event) => setShowMarkers(event.target.checked)}
          />
          <span>{t(locale, "showMarkers")}</span>
        </label>

        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={enableTransitionMarkerDrag}
            onChange={(event) => setEnableTransitionMarkerDrag(event.target.checked)}
          />
          <span>{t(locale, "enableTransitionMarkerDrag")}</span>
        </label>

        <label className="field-label compact" htmlFor="padding-range">
          <span>
            {t(locale, "padding")}: {padding.toFixed(2)}
          </span>
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
          <span>
            {t(locale, "markerSize")}: {markerSize.toFixed(1)}
          </span>
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
          <span>
            {t(locale, "plotLineWidth")}: {plotLineWidth.toFixed(1)}
          </span>
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
          {t(locale, "fitView")}
        </button>

        {error ? <p className="error">{error}</p> : null}
      </aside>

      <main className="main-area">
        {pipes.length > 1 ? (
          <section className="main-section">
            <div className="transition-row">
              {pipes.slice(0, -1).map((_, index) => renderTransitionCard(index, true))}
            </div>
          </section>
        ) : null}

        <div className="pipe-section-scroll">
          <section className="main-section">
            <div className="pipe-row">
            {pipes.map((pipe, index) => {
            const linkedToHoveredTransition =
              hoveredTransitionCardIndex === index || hoveredTransitionCardIndex === index - 1
            const highlightedByHover = hoveredPipeIndex === index || linkedToHoveredTransition
            const outerLockKeys = lockKeysForShape(index, "outer", pipe.outer)
            const innerLockKeys = lockKeysForShape(index, "inner", pipe.inner)
            const pipeLockKeys = [...outerLockKeys, ...innerLockKeys]
            const outerAllLocked = allLocksEnabled(outerLockKeys)
            const innerAllLocked = allLocksEnabled(innerLockKeys)
            const pipeAllLocked = allLocksEnabled(pipeLockKeys)

            return (
              <article
                key={`pipe-${index}`}
                className={`pipe-card${highlightedByHover ? " hovered" : ""}`}
                onMouseEnter={() => setHoveredPipeIndex(index)}
                onMouseLeave={() => setHoveredPipeIndex(null)}
              >
              <div className="pipe-title-row">
                <h2>{t(locale, "pipeTitle", { index: index + 1 })}</h2>
                <button
                  type="button"
                  className="lock-toggle"
                  onClick={() => toggleBulkLocks(pipeLockKeys)}
                  aria-label={`Pipe ${index + 1} lock all`}
                  title={pipeAllLocked ? "Unlock all" : "Lock all"}
                >
                  {pipeAllLocked ? "🔴" : "🟢"}
                </button>
              </div>

              <label className="field-label compact" htmlFor={`pipe-type-${index}`}>
                <span>{t(locale, "pipeType")}</span>
                <select
                  id={`pipe-type-${index}`}
                  className="field-input"
                  value={pipeTypeName(pipe)}
                  onChange={(event) =>
                    (() => {
                      const nextPipe = convertPipeType(pipe, event.target.value as PipeType)
                      const nextPipes = pipes.map((currentPipe, pipeIdx) =>
                        pipeIdx === index ? nextPipe : currentPipe
                      )
                      setPipes(nextPipes)
                      setInputLocks(buildDefaultLocks(nextPipes))
                      setViewBounds(computeBounds(nextPipes, padding))
                    })()
                  }
                >
                  {PIPE_TYPE_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {pipeTypeLabelByOption[option]}
                    </option>
                  ))}
                </select>
              </label>

              <ShapeEditor
                title={t(locale, "outer")}
                originLabel={t(locale, "origin")}
                diameterLabel={t(locale, "diameter")}
                lengthLabel={t(locale, "length")}
                widthLabel={t(locale, "width")}
                filletRadiusLabel={t(locale, "filletRadius")}
                v1Label={t(locale, "v1")}
                v2Label={t(locale, "v2")}
                v3Label={t(locale, "v3")}
                shapeKey="outer"
                pipeIndex={index}
                shape={pipe.outer}
                onUpdate={(nextShape) => updatePipeShape(index, "outer", nextShape)}
                onPointHoverStart={setHoveredPointInput}
                onPointHoverEnd={() => setHoveredPointInput(null)}
                isLocked={(target, axis) => isInputLocked(index, "outer", target, axis)}
                onToggleLock={(target, axis) => toggleInputLock(index, "outer", target, axis)}
                allLocked={outerAllLocked}
                onToggleAllLocks={() => toggleBulkLocks(outerLockKeys)}
              />
              <ShapeEditor
                title={t(locale, "inner")}
                originLabel={t(locale, "origin")}
                diameterLabel={t(locale, "diameter")}
                lengthLabel={t(locale, "length")}
                widthLabel={t(locale, "width")}
                filletRadiusLabel={t(locale, "filletRadius")}
                v1Label={t(locale, "v1")}
                v2Label={t(locale, "v2")}
                v3Label={t(locale, "v3")}
                shapeKey="inner"
                pipeIndex={index}
                shape={pipe.inner}
                onUpdate={(nextShape) => updatePipeShape(index, "inner", nextShape)}
                onPointHoverStart={setHoveredPointInput}
                onPointHoverEnd={() => setHoveredPointInput(null)}
                isLocked={(target, axis) => isInputLocked(index, "inner", target, axis)}
                onToggleLock={(target, axis) => toggleInputLock(index, "inner", target, axis)}
                allLocked={innerAllLocked}
                onToggleAllLocks={() => toggleBulkLocks(innerLockKeys)}
              />

              <div className="pipe-actions">
                <button
                  className="danger"
                  type="button"
                  onClick={() => {
                    setPipes((prev) => {
                      const next = prev.filter((_, pipeIdx) => pipeIdx !== index)
                      setInputLocks(buildDefaultLocks(next))
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
                      next.splice(index + 1, 0, duplicatePipe(pipe))
                      setInputLocks(buildDefaultLocks(next))
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
            </div>
          </section>
        </div>

        {expandedTransitionIndex !== null ? (
          <div
            className="transition-modal-backdrop"
            onClick={() => setExpandedTransitionIndex(null)}
            role="presentation"
          >
            <div className="transition-modal-panel" onClick={(event) => event.stopPropagation()} role="dialog">
              <div className="transition-modal-header">
                <span className="transition-modal-hint">{t(locale, "escToClose")}</span>
                <button
                  type="button"
                  className="transition-modal-close"
                  onClick={() => setExpandedTransitionIndex(null)}
                  aria-label="Close expanded transition plot"
                  title="Close"
                >
                  ✕
                </button>
              </div>
              {renderTransitionCard(expandedTransitionIndex, false)}
            </div>
          </div>
        ) : null}
      </main>
    </div>
  )
}

export default App
