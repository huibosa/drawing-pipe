import type { Bounds, CircleShape, RectShape, Shape, SplineShape } from "../types/domain"

export function clamp(value: number, min: number): number {
  return Number.isFinite(value) ? Math.max(min, value) : min
}

function circleVertices(shape: CircleShape): [number, number][] {
  const [ox, oy] = shape.origin
  const radius = shape.diameter / 2
  const points: [number, number][] = []
  const segments = 120
  for (let index = 0; index <= segments; index += 1) {
    const angle = (2 * Math.PI * index) / segments
    points.push([ox + radius * Math.cos(angle), oy + radius * Math.sin(angle)])
  }
  return points
}

function rectVertices(shape: RectShape): [number, number][] {
  const [ox, oy] = shape.origin
  const halfW = shape.width / 2
  const halfL = shape.length / 2
  const left = ox - halfW
  const right = ox + halfW
  const top = oy + halfL
  const bottom = oy - halfL

  const radius = Math.max(0, Math.min(shape.fillet_radius, halfW, halfL))
  if (radius <= 0) {
    return [
      [left, top],
      [right, top],
      [right, bottom],
      [left, bottom],
      [left, top],
    ]
  }

  const cornerSegments = 12
  const points: [number, number][] = []

  const pushArc = (
    cx: number,
    cy: number,
    startAngle: number,
    endAngle: number,
    includeStart: boolean,
  ) => {
    const steps = includeStart ? cornerSegments : cornerSegments - 1
    const firstIndex = includeStart ? 0 : 1
    for (let index = firstIndex; index <= steps; index += 1) {
      const t = index / cornerSegments
      const angle = startAngle + (endAngle - startAngle) * t
      points.push([cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)])
    }
  }

  points.push([left + radius, top])
  points.push([right - radius, top])
  pushArc(right - radius, top - radius, Math.PI / 2, 0, false)
  points.push([right, bottom + radius])
  pushArc(right - radius, bottom + radius, 0, -Math.PI / 2, false)
  points.push([left + radius, bottom])
  pushArc(left + radius, bottom + radius, -Math.PI / 2, -Math.PI, false)
  points.push([left, top - radius])
  pushArc(left + radius, top - radius, Math.PI, Math.PI / 2, false)
  points.push(points[0])

  return points
}

function splineVertices(shape: SplineShape): [number, number][] {
  const [ox, oy] = shape.origin
  const [v1x, v1y] = shape.v1
  const [v2x, v2y] = shape.v2
  const [v3x, v3y] = shape.v3
  return [
    [v1x + ox, v1y + oy],
    [v2x + ox, v2y + oy],
    [v3x + ox, v3y + oy],
    [v2x + ox, -v2y + oy],
    [0 + ox, -v1y + oy],
    [-v2x + ox, -v2y + oy],
    [-v3x + ox, 0 + oy],
    [-v2x + ox, v2y + oy],
  ]
}

function catmullRomClosed(
  points: [number, number][],
  samplesPerSegment = 20,
): [number, number][] {
  const count = points.length
  if (count < 3) {
    return [...points]
  }

  const output: [number, number][] = []
  for (let i = 0; i < count; i += 1) {
    const p0 = points[(i - 1 + count) % count]
    const p1 = points[i]
    const p2 = points[(i + 1) % count]
    const p3 = points[(i + 2) % count]

    for (let j = 0; j < samplesPerSegment; j += 1) {
      const t = j / samplesPerSegment
      const t2 = t * t
      const t3 = t2 * t
      const x =
        0.5 *
        ((2 * p1[0]) +
          (-p0[0] + p2[0]) * t +
          (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 +
          (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3)
      const y =
        0.5 *
        ((2 * p1[1]) +
          (-p0[1] + p2[1]) * t +
          (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 +
          (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3)
      output.push([x, y])
    }
  }
  output.push(output[0])
  return output
}

export function vertices(shape: Shape): [number, number][] {
  if (shape.shape_type === "Circle") {
    return circleVertices(shape)
  }
  if (shape.shape_type === "Rect") {
    return rectVertices(shape)
  }
  return catmullRomClosed(splineVertices(shape))
}

export function getPipeBounds(shapes: Shape[], padding: number): Bounds {
  const allPoints = shapes.flatMap((shape) => vertices(shape))
  const xs = allPoints.map(([x]) => x)
  const ys = allPoints.map(([, y]) => y)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  const spanX = Math.max(maxX - minX, 1)
  const spanY = Math.max(maxY - minY, 1)
  const pad = Math.max(spanX, spanY) * padding
  return {
    minX: minX - pad,
    maxX: maxX + pad,
    minY: minY - pad,
    maxY: maxY + pad,
  }
}

export function mergeBounds(boundsList: Bounds[]): Bounds {
  return {
    minX: Math.min(...boundsList.map((b) => b.minX)),
    maxX: Math.max(...boundsList.map((b) => b.maxX)),
    minY: Math.min(...boundsList.map((b) => b.minY)),
    maxY: Math.max(...boundsList.map((b) => b.maxY)),
  }
}
