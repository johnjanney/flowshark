import type {
  CapStyle,
  Connector,
  ConnectorEnd,
  FlowDoc,
  Point,
  Shape,
} from "../model/types";
import {
  dist,
  flattenCubic,
  normalize,
  rectCenter,
  rectOf,
  rotatePoint,
} from "../core/geometry";
import { anchorPoint, getShapeDef, shapeAnchors } from "../shapes/registry";

export interface ResolvedEnd {
  point: Point;
  /** outward direction from the shape at the anchor (unit vector) */
  normal: Point;
  shape: Shape | null;
  anchorId: string | null;
}

export interface RoutedConnector {
  /** polyline approximation of the path (used for hit-testing and labels) */
  polyline: Point[];
  /** svg path data */
  d: string;
  start: ResolvedEnd;
  end: ResolvedEnd;
}

function anchorNormal(id: string): Point {
  switch (id) {
    case "n": return { x: 0, y: -1 };
    case "s": return { x: 0, y: 1 };
    case "e": return { x: 1, y: 0 };
    case "w": return { x: -1, y: 0 };
    case "ne": return normalize({ x: 1, y: -1 });
    case "nw": return normalize({ x: -1, y: -1 });
    case "se": return normalize({ x: 1, y: 1 });
    case "sw": return normalize({ x: -1, y: 1 });
    default: return { x: 1, y: 0 };
  }
}

/** All anchor points of a shape in document coordinates (rotation applied). */
export function shapeAnchorPoints(
  s: Shape
): Array<{ id: string; point: Point; normal: Point }> {
  const def = getShapeDef(s.type);
  const center = rectCenter(rectOf(s));
  return shapeAnchors(def).map((a) => {
    let p = anchorPoint(s, a);
    let n = anchorNormal(a.id);
    if (s.rotation) {
      p = rotatePoint(p, center, s.rotation);
      const rotated = rotatePoint(
        { x: n.x, y: n.y },
        { x: 0, y: 0 },
        s.rotation
      );
      n = normalize(rotated);
    }
    return { id: a.id, point: p, normal: n };
  });
}

function findShape(doc: FlowDoc, id: string | null): Shape | null {
  if (!id) return null;
  return doc.shapes.find((s) => s.id === id) ?? null;
}

/** Resolve one end of a connector to a concrete point + outward normal. */
export function resolveEnd(
  doc: FlowDoc,
  end: ConnectorEnd,
  towards: Point
): ResolvedEnd {
  const shape = findShape(doc, end.shapeId);
  if (!shape) {
    return { point: { x: end.x, y: end.y }, normal: { x: 0, y: 0 }, shape: null, anchorId: null };
  }
  const anchors = shapeAnchorPoints(shape);
  if (end.anchor) {
    const a = anchors.find((x) => x.id === end.anchor) ?? anchors[0];
    return { point: a.point, normal: a.normal, shape, anchorId: a.id };
  }
  // Floating: nearest anchor to the opposite end.
  let best = anchors[0];
  let bestD = Infinity;
  for (const a of anchors) {
    const d = dist(a.point, towards);
    if (d < bestD) {
      bestD = d;
      best = a;
    }
  }
  return { point: best.point, normal: best.normal, shape, anchorId: best.id };
}

function otherEndHint(doc: FlowDoc, end: ConnectorEnd, waypoints: Point[], fromStart: boolean): Point {
  if (waypoints.length > 0) {
    return fromStart ? waypoints[0] : waypoints[waypoints.length - 1];
  }
  const shape = findShape(doc, end.shapeId);
  if (shape) return rectCenter(rectOf(shape));
  return { x: end.x, y: end.y };
}

/** Orthogonal (elbow) route between two resolved ends honoring exit normals. */
function elbowRoute(start: ResolvedEnd, end: ResolvedEnd, waypoints: Point[]): Point[] {
  const stub = 20;
  const pts: Point[] = [start.point];
  const sDir = dominantAxis(start.normal, end.point, start.point, true);
  const eDir = dominantAxis(end.normal, start.point, end.point, false);

  const sStub: Point = {
    x: start.point.x + sDir.x * stub,
    y: start.point.y + sDir.y * stub,
  };
  const eStub: Point = {
    x: end.point.x + eDir.x * stub,
    y: end.point.y + eDir.y * stub,
  };
  pts.push(sStub);

  const mids: Point[] = [];
  if (waypoints.length > 0) {
    // Orthogonalize through user waypoints.
    let prev = sStub;
    for (const wp of waypoints) {
      mids.push({ x: wp.x, y: prev.y });
      mids.push(wp);
      prev = wp;
    }
    mids.push({ x: eStub.x, y: mids[mids.length - 1].y });
  } else if (Math.abs(sDir.x) > 0.5) {
    // horizontal exit
    if (Math.abs(eDir.x) > 0.5) {
      const mx = (sStub.x + eStub.x) / 2;
      mids.push({ x: mx, y: sStub.y }, { x: mx, y: eStub.y });
    } else {
      mids.push({ x: eStub.x, y: sStub.y });
    }
  } else {
    // vertical exit
    if (Math.abs(eDir.y) > 0.5) {
      const my = (sStub.y + eStub.y) / 2;
      mids.push({ x: sStub.x, y: my }, { x: eStub.x, y: my });
    } else {
      mids.push({ x: sStub.x, y: eStub.y });
    }
  }
  pts.push(...mids, eStub, end.point);
  return dedupe(pts);
}

/** Pick a horizontal/vertical exit direction for an endpoint. */
function dominantAxis(
  normal: Point,
  toward: Point,
  from: Point,
  isStart: boolean
): Point {
  if (Math.abs(normal.x) + Math.abs(normal.y) > 0.01) {
    // snap the normal to the nearest axis
    if (Math.abs(normal.x) >= Math.abs(normal.y)) {
      return { x: Math.sign(normal.x) || 1, y: 0 };
    }
    return { x: 0, y: Math.sign(normal.y) || 1 };
  }
  // free endpoint: head toward the other point along dominant axis
  const dx = toward.x - from.x;
  const dy = toward.y - from.y;
  if (Math.abs(dx) >= Math.abs(dy)) return { x: Math.sign(dx) || 1, y: 0 };
  return { x: 0, y: Math.sign(dy) || 1 };
}

function dedupe(pts: Point[]): Point[] {
  const out: Point[] = [];
  for (const p of pts) {
    const last = out[out.length - 1];
    if (!last || Math.abs(last.x - p.x) > 0.01 || Math.abs(last.y - p.y) > 0.01) {
      out.push(p);
    }
  }
  // remove collinear middle points
  const simplified: Point[] = [];
  for (let i = 0; i < out.length; i++) {
    if (i > 0 && i < out.length - 1) {
      const a = simplified[simplified.length - 1];
      const b = out[i];
      const c = out[i + 1];
      const cross = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
      if (Math.abs(cross) < 0.01) continue;
    }
    simplified.push(out[i]);
  }
  return simplified;
}

function polylineToPath(pts: Point[], rounded = 0): string {
  if (pts.length === 0) return "";
  let d = `M${fmt(pts[0].x)},${fmt(pts[0].y)}`;
  if (rounded > 0 && pts.length > 2) {
    for (let i = 1; i < pts.length - 1; i++) {
      const prev = pts[i - 1];
      const cur = pts[i];
      const next = pts[i + 1];
      const r = Math.min(
        rounded,
        dist(prev, cur) / 2,
        dist(cur, next) / 2
      );
      const inDir = normalize({ x: cur.x - prev.x, y: cur.y - prev.y });
      const outDir = normalize({ x: next.x - cur.x, y: next.y - cur.y });
      const p1 = { x: cur.x - inDir.x * r, y: cur.y - inDir.y * r };
      const p2 = { x: cur.x + outDir.x * r, y: cur.y + outDir.y * r };
      d += ` L${fmt(p1.x)},${fmt(p1.y)} Q${fmt(cur.x)},${fmt(cur.y)} ${fmt(p2.x)},${fmt(p2.y)}`;
    }
    const last = pts[pts.length - 1];
    d += ` L${fmt(last.x)},${fmt(last.y)}`;
  } else {
    for (let i = 1; i < pts.length; i++) {
      d += ` L${fmt(pts[i].x)},${fmt(pts[i].y)}`;
    }
  }
  return d;
}

function fmt(n: number): string {
  return String(Math.round(n * 100) / 100);
}

/** Compute the full route for a connector. */
export function routeConnector(doc: FlowDoc, c: Connector): RoutedConnector {
  const sHint = otherEndHint(doc, c.target, c.points, true);
  const tHint = otherEndHint(doc, c.source, c.points, false);
  const start = resolveEnd(doc, c.source, sHint);
  const end = resolveEnd(doc, c.target, tHint);

  let polyline: Point[];
  let d: string;

  switch (c.type) {
    case "elbow":
    case "step": {
      polyline = elbowRoute(start, end, c.points);
      d = polylineToPath(polyline, c.type === "elbow" ? 6 : 0);
      break;
    }
    case "curved": {
      const distance = Math.max(40, dist(start.point, end.point) / 2);
      const c1: Point = {
        x: start.point.x + start.normal.x * distance,
        y: start.point.y + start.normal.y * distance,
      };
      const c2: Point = {
        x: end.point.x + end.normal.x * distance,
        y: end.point.y + end.normal.y * distance,
      };
      if (c.points.length > 0) {
        // Smooth curve through waypoints via quadratic segments.
        const all = [start.point, ...c.points, end.point];
        polyline = [];
        d = `M${fmt(all[0].x)},${fmt(all[0].y)}`;
        for (let i = 0; i < all.length - 1; i++) {
          const a = all[i];
          const b = all[i + 1];
          const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
          if (i === 0) {
            d += ` Q${fmt(a.x)},${fmt(a.y)} ${fmt(mid.x)},${fmt(mid.y)}`;
          }
          if (i < all.length - 2) {
            const next = all[i + 2];
            const mid2 = { x: (b.x + next.x) / 2, y: (b.y + next.y) / 2 };
            d += ` Q${fmt(b.x)},${fmt(b.y)} ${fmt(mid2.x)},${fmt(mid2.y)}`;
            polyline.push(...flattenCubic(mid, b, b, mid2, 12));
          } else {
            d += ` Q${fmt(b.x)},${fmt(b.y)} ${fmt(b.x)},${fmt(b.y)}`;
          }
        }
        d += ` L${fmt(all[all.length - 1].x)},${fmt(all[all.length - 1].y)}`;
        polyline = [start.point, ...c.points, end.point];
      } else {
        polyline = flattenCubic(start.point, c1, c2, end.point, 24);
        d =
          `M${fmt(start.point.x)},${fmt(start.point.y)} ` +
          `C${fmt(c1.x)},${fmt(c1.y)} ${fmt(c2.x)},${fmt(c2.y)} ` +
          `${fmt(end.point.x)},${fmt(end.point.y)}`;
      }
      break;
    }
    case "freeform": {
      polyline = [start.point, ...c.points, end.point];
      d = polylineToPath(polyline);
      break;
    }
    case "straight":
    default: {
      polyline = [start.point, ...c.points, end.point];
      d = polylineToPath(polyline);
      break;
    }
  }

  return { polyline, d, start, end };
}

/** Cap size scales with stroke width. */
export function capSize(strokeWidth: number): number {
  return 8 + strokeWidth * 2;
}

/**
 * SVG fragment for an endpoint cap.
 * `at` is the tip point; `dir` is the direction the line travels INTO the tip.
 */
export function capSVG(
  at: Point,
  dir: Point,
  style: CapStyle,
  color: string,
  strokeWidth: number
): string {
  if (style === "none") return "";
  const s = capSize(strokeWidth);
  const d = normalize(dir);
  const perp = { x: -d.y, y: d.x };
  const back = (f: number): Point => ({ x: at.x - d.x * s * f, y: at.y - d.y * s * f });
  const off = (p: Point, f: number): Point => ({
    x: p.x + perp.x * s * f,
    y: p.y + perp.y * s * f,
  });
  const P = (p: Point) => `${fmt(p.x)},${fmt(p.y)}`;
  const sw = Math.max(1, strokeWidth);

  switch (style) {
    case "arrow": {
      const b = back(1);
      return `<path d="M${P(off(b, 0.5))} L${P(at)} L${P(off(b, -0.5))}" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"/>`;
    }
    case "open-arrow": {
      const b = back(1);
      return `<path d="M${P(off(b, 0.5))} L${P(at)} L${P(off(b, -0.5))} Z" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linejoin="round"/>`;
    }
    case "filled-arrow": {
      const b = back(1);
      return `<path d="M${P(off(b, 0.45))} L${P(at)} L${P(off(b, -0.45))} Z" fill="${color}" stroke="${color}" stroke-width="1"/>`;
    }
    case "diamond":
    case "filled-diamond": {
      const mid = back(0.6);
      const tail = back(1.2);
      const fill = style === "filled-diamond" ? color : "var(--cap-bg, #ffffff)";
      return `<path d="M${P(at)} L${P(off(mid, 0.4))} L${P(tail)} L${P(off(mid, -0.4))} Z" fill="${fill}" stroke="${color}" stroke-width="${sw}"/>`;
    }
    case "circle":
    case "filled-circle": {
      const cpt = back(0.5);
      const fill = style === "filled-circle" ? color : "var(--cap-bg, #ffffff)";
      return `<circle cx="${fmt(cpt.x)}" cy="${fmt(cpt.y)}" r="${fmt(s * 0.4)}" fill="${fill}" stroke="${color}" stroke-width="${sw}"/>`;
    }
    case "square":
    case "filled-square": {
      const cpt = back(0.5);
      const r = s * 0.38;
      const p1 = off({ x: cpt.x - d.x * r, y: cpt.y - d.y * r }, 0.38);
      const p2 = off({ x: cpt.x + d.x * r, y: cpt.y + d.y * r }, 0.38);
      const p3 = off({ x: cpt.x + d.x * r, y: cpt.y + d.y * r }, -0.38);
      const p4 = off({ x: cpt.x - d.x * r, y: cpt.y - d.y * r }, -0.38);
      const fill = style === "filled-square" ? color : "var(--cap-bg, #ffffff)";
      return `<path d="M${P(p1)} L${P(p2)} L${P(p3)} L${P(p4)} Z" fill="${fill}" stroke="${color}" stroke-width="${sw}"/>`;
    }
    case "bar": {
      return `<path d="M${P(off(at, 0.5))} L${P(off(at, -0.5))}" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round"/>`;
    }
    default:
      return "";
  }
}

export const CAP_STYLES: Array<{ id: CapStyle; label: string }> = [
  { id: "none", label: "None" },
  { id: "arrow", label: "Arrow" },
  { id: "open-arrow", label: "Open arrow" },
  { id: "filled-arrow", label: "Filled arrow" },
  { id: "diamond", label: "Diamond" },
  { id: "filled-diamond", label: "Filled diamond" },
  { id: "circle", label: "Circle" },
  { id: "filled-circle", label: "Filled circle" },
  { id: "square", label: "Square" },
  { id: "filled-square", label: "Filled square" },
  { id: "bar", label: "Bar" },
];

export const CONNECTOR_TYPES: Array<{ id: Connector["type"]; label: string }> = [
  { id: "straight", label: "Straight" },
  { id: "elbow", label: "Elbow" },
  { id: "step", label: "Step" },
  { id: "curved", label: "Curved" },
  { id: "freeform", label: "Freeform" },
];
