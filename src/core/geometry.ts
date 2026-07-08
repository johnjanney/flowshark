import type { Point, Rect, Shape } from "../model/types";

export function rectOf(s: { x: number; y: number; w: number; h: number }): Rect {
  return { x: s.x, y: s.y, w: s.w, h: s.h };
}

export function rectCenter(r: Rect): Point {
  return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
}

export function rectContains(r: Rect, p: Point): boolean {
  return p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
}

export function rectsIntersect(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export function rectContainsRect(outer: Rect, inner: Rect): boolean {
  return (
    inner.x >= outer.x &&
    inner.y >= outer.y &&
    inner.x + inner.w <= outer.x + outer.w &&
    inner.y + inner.h <= outer.y + outer.h
  );
}

export function unionRects(rects: Rect[]): Rect {
  if (rects.length === 0) return { x: 0, y: 0, w: 0, h: 0 };
  let x1 = Infinity,
    y1 = Infinity,
    x2 = -Infinity,
    y2 = -Infinity;
  for (const r of rects) {
    x1 = Math.min(x1, r.x);
    y1 = Math.min(y1, r.y);
    x2 = Math.max(x2, r.x + r.w);
    y2 = Math.max(y2, r.y + r.h);
  }
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}

export function inflateRect(r: Rect, by: number): Rect {
  return { x: r.x - by, y: r.y - by, w: r.w + 2 * by, h: r.h + 2 * by };
}

export function dist(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function lerp(a: Point, b: Point, t: number): Point {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

export function rotatePoint(p: Point, center: Point, degrees: number): Point {
  if (!degrees) return { ...p };
  const rad = (degrees * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const dx = p.x - center.x;
  const dy = p.y - center.y;
  return {
    x: center.x + dx * cos - dy * sin,
    y: center.y + dx * sin + dy * cos,
  };
}

/** Axis-aligned bounding box of a possibly-rotated shape. */
export function shapeBounds(s: Shape): Rect {
  if (!s.rotation) return rectOf(s);
  const c = rectCenter(rectOf(s));
  const corners = [
    { x: s.x, y: s.y },
    { x: s.x + s.w, y: s.y },
    { x: s.x + s.w, y: s.y + s.h },
    { x: s.x, y: s.y + s.h },
  ].map((p) => rotatePoint(p, c, s.rotation));
  let x1 = Infinity,
    y1 = Infinity,
    x2 = -Infinity,
    y2 = -Infinity;
  for (const p of corners) {
    x1 = Math.min(x1, p.x);
    y1 = Math.min(y1, p.y);
    x2 = Math.max(x2, p.x);
    y2 = Math.max(y2, p.y);
  }
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}

/** Distance from point p to segment ab. */
export function distToSegment(p: Point, a: Point, b: Point): number {
  const l2 = (b.x - a.x) ** 2 + (b.y - a.y) ** 2;
  if (l2 === 0) return dist(p, a);
  let t = ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / l2;
  t = Math.max(0, Math.min(1, t));
  return dist(p, { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) });
}

/** Distance from point to a polyline; returns {d, segIndex, t} of nearest spot. */
export function distToPolyline(
  p: Point,
  pts: Point[]
): { d: number; segIndex: number; t: number } {
  let best = { d: Infinity, segIndex: 0, t: 0 };
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    const l2 = (b.x - a.x) ** 2 + (b.y - a.y) ** 2;
    let t = l2 === 0 ? 0 : ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / l2;
    t = Math.max(0, Math.min(1, t));
    const d = dist(p, { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) });
    if (d < best.d) best = { d, segIndex: i, t };
  }
  return best;
}

export function polylineLength(pts: Point[]): number {
  let len = 0;
  for (let i = 0; i < pts.length - 1; i++) len += dist(pts[i], pts[i + 1]);
  return len;
}

/** Point + tangent direction at fraction t (0..1) of a polyline's arc length. */
export function pointAlongPolyline(
  pts: Point[],
  t: number
): { point: Point; dir: Point } {
  if (pts.length === 0) return { point: { x: 0, y: 0 }, dir: { x: 1, y: 0 } };
  if (pts.length === 1) return { point: { ...pts[0] }, dir: { x: 1, y: 0 } };
  const total = polylineLength(pts);
  let target = Math.max(0, Math.min(1, t)) * total;
  for (let i = 0; i < pts.length - 1; i++) {
    const segLen = dist(pts[i], pts[i + 1]);
    if (target <= segLen || i === pts.length - 2) {
      const f = segLen === 0 ? 0 : target / segLen;
      const dir = normalize({
        x: pts[i + 1].x - pts[i].x,
        y: pts[i + 1].y - pts[i].y,
      });
      return { point: lerp(pts[i], pts[i + 1], Math.min(1, f)), dir };
    }
    target -= segLen;
  }
  return { point: { ...pts[pts.length - 1] }, dir: { x: 1, y: 0 } };
}

export function normalize(v: Point): Point {
  const len = Math.hypot(v.x, v.y);
  if (len < 1e-9) return { x: 1, y: 0 };
  return { x: v.x / len, y: v.y / len };
}

/** Sample a cubic bezier into a polyline. */
export function flattenCubic(
  p0: Point,
  c1: Point,
  c2: Point,
  p1: Point,
  segments = 24
): Point[] {
  const out: Point[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const mt = 1 - t;
    out.push({
      x:
        mt * mt * mt * p0.x +
        3 * mt * mt * t * c1.x +
        3 * mt * t * t * c2.x +
        t * t * t * p1.x,
      y:
        mt * mt * mt * p0.y +
        3 * mt * mt * t * c1.y +
        3 * mt * t * t * c2.y +
        t * t * t * p1.y,
    });
  }
  return out;
}

export function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

export function snapValue(v: number, grid: number): number {
  return Math.round(v / grid) * grid;
}
