import { describe, expect, it } from "vitest";
import { snapMove, snapPoint } from "../src/core/snap";
import { newDoc, newShape } from "../src/model/defaults";

describe("snapping", () => {
  it("snaps movement to the grid", () => {
    const doc = newDoc();
    doc.canvas.snapToGrid = true;
    doc.canvas.snapToElement = false;
    doc.canvas.gridSize = 20;
    const moving = newShape("process", 0, 0, 1);
    doc.shapes.push(moving);
    const r = snapMove(doc, new Set([moving.id]), 33, 47, { x: 0, y: 0, w: 100, h: 50 });
    expect((0 + r.dx) % 20).toBeCloseTo(0);
    expect((0 + r.dy) % 20).toBeCloseTo(0);
  });

  it("snaps to another element's edge within tolerance and emits a guide", () => {
    const doc = newDoc();
    doc.canvas.snapToGrid = false;
    doc.canvas.snapToElement = true;
    doc.canvas.snapTolerance = 6;
    const still = newShape("process", 200, 0, 1); // left edge at 200
    const moving = newShape("process", 0, 300, 2);
    doc.shapes.push(still, moving);
    // moving so its left edge lands at 197 -> should snap to 200
    const r = snapMove(doc, new Set([moving.id]), 197, 0, { x: 0, y: 300, w: 140, h: 70 });
    expect(r.dx).toBe(200);
    expect(r.guides.some((g) => g.axis === "x" && g.value === 200)).toBe(true);
  });

  it("does not snap beyond tolerance", () => {
    const doc = newDoc();
    doc.canvas.snapToGrid = false;
    doc.canvas.snapToElement = true;
    doc.canvas.snapTolerance = 6;
    const still = newShape("process", 200, 0, 1);
    const moving = newShape("process", 0, 300, 2);
    doc.shapes.push(still, moving);
    const r = snapMove(doc, new Set([moving.id]), 150, 0, { x: 0, y: 300, w: 140, h: 70 });
    expect(r.dx).toBe(150);
    expect(r.guides).toHaveLength(0);
  });

  it("disable flag bypasses all snapping", () => {
    const doc = newDoc();
    const moving = newShape("process", 0, 0, 1);
    doc.shapes.push(moving);
    const r = snapMove(doc, new Set([moving.id]), 33, 47, { x: 0, y: 0, w: 100, h: 50 }, true);
    expect(r.dx).toBe(33);
    expect(r.dy).toBe(47);
  });

  it("snapPoint rounds to grid", () => {
    const doc = newDoc();
    doc.canvas.gridSize = 10;
    doc.canvas.snapToGrid = true;
    expect(snapPoint(doc, { x: 14, y: 26 })).toEqual({ x: 10, y: 30 });
  });
});
