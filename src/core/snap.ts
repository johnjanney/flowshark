import type { FlowDoc, Point, Rect, Shape } from "../model/types";
import { shapeBounds, snapValue } from "./geometry";

export interface Guide {
  axis: "x" | "y";
  value: number;
  from: number;
  to: number;
}

export interface SnapResult {
  dx: number;
  dy: number;
  guides: Guide[];
}

/**
 * Snap a movement delta for the given moving shapes.
 * Considers grid snap and element snap (edges + centers of other shapes).
 */
export function snapMove(
  doc: FlowDoc,
  movingIds: Set<string>,
  rawDx: number,
  rawDy: number,
  origBounds: Rect,
  disable = false
): SnapResult {
  let dx = rawDx;
  let dy = rawDy;
  const guides: Guide[] = [];
  if (disable) return { dx, dy, guides };

  const moved: Rect = {
    x: origBounds.x + rawDx,
    y: origBounds.y + rawDy,
    w: origBounds.w,
    h: origBounds.h,
  };
  const tol = doc.canvas.snapTolerance;

  let bestX: { dist: number; adjust: number; guide: Guide } | null = null;
  let bestY: { dist: number; adjust: number; guide: Guide } | null = null;

  if (doc.canvas.snapToElement) {
    const movingXs = [moved.x, moved.x + moved.w / 2, moved.x + moved.w];
    const movingYs = [moved.y, moved.y + moved.h / 2, moved.y + moved.h];
    for (const other of doc.shapes) {
      if (movingIds.has(other.id) || other.hidden) continue;
      const ob = shapeBounds(other);
      const otherXs = [ob.x, ob.x + ob.w / 2, ob.x + ob.w];
      const otherYs = [ob.y, ob.y + ob.h / 2, ob.y + ob.h];
      for (const mx of movingXs) {
        for (const ox of otherXs) {
          const d = Math.abs(mx - ox);
          if (d <= tol && (!bestX || d < bestX.dist)) {
            bestX = {
              dist: d,
              adjust: ox - mx,
              guide: {
                axis: "x",
                value: ox,
                from: Math.min(moved.y, ob.y) - 8,
                to: Math.max(moved.y + moved.h, ob.y + ob.h) + 8,
              },
            };
          }
        }
      }
      for (const my of movingYs) {
        for (const oy of otherYs) {
          const d = Math.abs(my - oy);
          if (d <= tol && (!bestY || d < bestY.dist)) {
            bestY = {
              dist: d,
              adjust: oy - my,
              guide: {
                axis: "y",
                value: oy,
                from: Math.min(moved.x, ob.x) - 8,
                to: Math.max(moved.x + moved.w, ob.x + ob.w) + 8,
              },
            };
          }
        }
      }
    }
  }

  if (bestX) {
    dx = rawDx + bestX.adjust;
    guides.push(bestX.guide);
  }
  if (bestY) {
    dy = rawDy + bestY.adjust;
    guides.push(bestY.guide);
  }

  if (doc.canvas.snapToGrid) {
    const g = doc.canvas.gridSize;
    if (!bestX) dx = snapValue(origBounds.x + rawDx, g) - origBounds.x;
    if (!bestY) dy = snapValue(origBounds.y + rawDy, g) - origBounds.y;
  }

  return { dx, dy, guides };
}

/** Snap a single point (resize handle, connector endpoint, new shape drop). */
export function snapPoint(doc: FlowDoc, p: Point, disable = false): Point {
  if (disable || !doc.canvas.snapToGrid) return p;
  const g = doc.canvas.gridSize;
  return { x: snapValue(p.x, g), y: snapValue(p.y, g) };
}
