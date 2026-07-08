import { describe, expect, it } from "vitest";
import { newDoc, newShape, newConnector, attachedEnd, freeEnd } from "../src/model/defaults";
import { routeConnector, shapeAnchorPoints } from "../src/connectors/routing";
import { pointAlongPolyline, polylineLength } from "../src/core/geometry";

function docWithTwoShapes() {
  const doc = newDoc();
  const a = newShape("process", 0, 0, 1); // 140x70 default
  const b = newShape("process", 400, 300, 2);
  doc.shapes.push(a, b);
  return { doc, a, b };
}

describe("connector routing", () => {
  it("resolves fixed anchors to exact anchor points", () => {
    const { doc, a, b } = docWithTwoShapes();
    const c = newConnector("straight", attachedEnd(a.id, "e"), attachedEnd(b.id, "w"), 3);
    doc.connectors.push(c);
    const route = routeConnector(doc, c);
    expect(route.start.point).toEqual({ x: a.x + a.w, y: a.y + a.h / 2 });
    expect(route.end.point).toEqual({ x: b.x, y: b.y + b.h / 2 });
  });

  it("floating ends pick the nearest anchor and move with the shape", () => {
    const { doc, a, b } = docWithTwoShapes();
    const c = newConnector("straight", attachedEnd(a.id), attachedEnd(b.id), 3);
    doc.connectors.push(c);
    const before = routeConnector(doc, c);
    // b is below-right of a, so a's exit should be on its right or bottom
    expect(
      before.start.anchorId === "e" ||
        before.start.anchorId === "s" ||
        before.start.anchorId === "se"
    ).toBe(true);
    // move b above a: the chosen anchor should change
    b.x = 0;
    b.y = -300;
    const after = routeConnector(doc, c);
    expect(after.start.point.y).toBeLessThanOrEqual(before.start.point.y);
  });

  it("elbow routes are strictly orthogonal", () => {
    const { doc, a, b } = docWithTwoShapes();
    const c = newConnector("elbow", attachedEnd(a.id, "e"), attachedEnd(b.id, "w"), 3);
    doc.connectors.push(c);
    const { polyline } = routeConnector(doc, c);
    expect(polyline.length).toBeGreaterThanOrEqual(3);
    for (let i = 0; i < polyline.length - 1; i++) {
      const dx = Math.abs(polyline[i].x - polyline[i + 1].x);
      const dy = Math.abs(polyline[i].y - polyline[i + 1].y);
      expect(Math.min(dx, dy)).toBeLessThan(0.01); // each segment is axis-aligned
    }
  });

  it("free endpoints route to their coordinates", () => {
    const doc = newDoc();
    const c = newConnector("straight", freeEnd(10, 20), freeEnd(200, 120), 1);
    doc.connectors.push(c);
    const route = routeConnector(doc, c);
    expect(route.polyline[0]).toEqual({ x: 10, y: 20 });
    expect(route.polyline[route.polyline.length - 1]).toEqual({ x: 200, y: 120 });
  });

  it("honors manual bend points", () => {
    const doc = newDoc();
    const c = newConnector("straight", freeEnd(0, 0), freeEnd(100, 0), 1);
    c.points.push({ x: 50, y: 80 });
    doc.connectors.push(c);
    const route = routeConnector(doc, c);
    expect(route.polyline).toContainEqual({ x: 50, y: 80 });
  });

  it("curved connectors produce a smooth polyline between endpoints", () => {
    const { doc, a, b } = docWithTwoShapes();
    const c = newConnector("curved", attachedEnd(a.id, "e"), attachedEnd(b.id, "n"), 3);
    doc.connectors.push(c);
    const { polyline } = routeConnector(doc, c);
    expect(polyline.length).toBeGreaterThan(10);
    expect(polyline[0].x).toBeCloseTo(a.x + a.w);
    expect(polyline[polyline.length - 1].y).toBeCloseTo(b.y);
  });

  it("every shape type exposes anchor points", () => {
    const doc = newDoc();
    const types = [
      "process", "decision", "terminator", "io", "document", "database",
      "cloud", "star", "swimlane", "callout",
    ] as const;
    for (const t of types) {
      const s = newShape(t, 0, 0, 1);
      const anchors = shapeAnchorPoints(s);
      expect(anchors.length).toBeGreaterThanOrEqual(4);
      for (const a of anchors) {
        expect(Number.isFinite(a.point.x)).toBe(true);
        expect(Number.isFinite(a.point.y)).toBe(true);
      }
    }
  });
});

describe("polyline helpers", () => {
  it("computes length and midpoints", () => {
    const pts = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
    ];
    expect(polylineLength(pts)).toBe(200);
    const mid = pointAlongPolyline(pts, 0.5);
    expect(mid.point).toEqual({ x: 100, y: 0 });
    const quarter = pointAlongPolyline(pts, 0.25);
    expect(quarter.point).toEqual({ x: 50, y: 0 });
  });
});
