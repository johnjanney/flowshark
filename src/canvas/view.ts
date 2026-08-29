import type { Point, Rect } from "../model/types";
import type { Editor } from "../core/editor";
import type { Guide } from "../core/snap";
import { docContentSVG, gridSVG } from "./render";
import { routeConnector, shapeAnchorPoints } from "../connectors/routing";
import { shapeBounds } from "../core/geometry";
import { escapeXML } from "../core/text";

const SVGNS = "http://www.w3.org/2000/svg";

export type HandleId =
  | "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";

export const HANDLE_DEFS: Array<{ id: HandleId; rx: number; ry: number; cursor: string }> = [
  { id: "nw", rx: 0, ry: 0, cursor: "nwse-resize" },
  { id: "n", rx: 0.5, ry: 0, cursor: "ns-resize" },
  { id: "ne", rx: 1, ry: 0, cursor: "nesw-resize" },
  { id: "e", rx: 1, ry: 0.5, cursor: "ew-resize" },
  { id: "se", rx: 1, ry: 1, cursor: "nwse-resize" },
  { id: "s", rx: 0.5, ry: 1, cursor: "ns-resize" },
  { id: "sw", rx: 0, ry: 1, cursor: "nesw-resize" },
  { id: "w", rx: 0, ry: 0.5, cursor: "ew-resize" },
];

/**
 * Owns the on-screen SVG: viewport transform, grid, content, and the
 * interaction overlay (selection outlines, handles, guides, anchors).
 */
export class CanvasView {
  svg: SVGSVGElement;
  root: SVGGElement;
  gridLayer: SVGGElement;
  contentLayer: SVGGElement;
  overlayLayer: SVGGElement;
  host: HTMLElement;
  /** polite live region used to announce selection to screen readers */
  liveRegion: HTMLElement;

  /** transient state written by interactions, read by refreshOverlay */
  guides: Guide[] = [];
  marquee: Rect | null = null;
  hoverShapeId: string | null = null;
  connectorPreview: string | null = null; // svg fragment while drawing
  hideSelectionUI = false;

  constructor(public editor: Editor, host: HTMLElement) {
    this.host = host;
    this.svg = document.createElementNS(SVGNS, "svg");
    this.svg.id = "canvas-svg";
    this.svg.setAttribute("tabindex", "0");
    // "application" rather than "img": the canvas is an interactive editing
    // surface with its own key bindings, not a static picture. The label
    // states the traversal keys because the SVG scene graph itself is not a
    // meaningful accessibility tree — selection is announced through the
    // live region below instead.
    this.svg.setAttribute("role", "application");
    this.svg.setAttribute(
      "aria-label",
      "Flowchart canvas. Press Tab or Shift+Tab to move through the diagram's objects, Enter to edit the selected object's text, arrow keys to move it, and Escape to deselect."
    );
    this.root = document.createElementNS(SVGNS, "g");
    this.gridLayer = document.createElementNS(SVGNS, "g");
    this.contentLayer = document.createElementNS(SVGNS, "g");
    this.overlayLayer = document.createElementNS(SVGNS, "g");
    this.root.append(this.gridLayer, this.contentLayer, this.overlayLayer);
    this.svg.appendChild(this.root);
    host.appendChild(this.svg);
    this.liveRegion = document.createElement("div");
    this.liveRegion.className = "sr-only";
    this.liveRegion.setAttribute("aria-live", "polite");
    this.liveRegion.setAttribute("aria-atomic", "true");
    host.appendChild(this.liveRegion);
    new ResizeObserver(() => this.refresh()).observe(host);
  }

  /** Announce a change (selection, mode) to assistive technology. */
  announce(message: string): void {
    // Re-setting identical text does not re-announce, so clear first.
    this.liveRegion.textContent = "";
    this.liveRegion.textContent = message;
  }

  // ----- coordinates -------------------------------------------------------

  clientToDoc(clientX: number, clientY: number): Point {
    const rect = this.svg.getBoundingClientRect();
    const vp = this.editor.viewport;
    return {
      x: vp.x + (clientX - rect.left) / vp.zoom,
      y: vp.y + (clientY - rect.top) / vp.zoom,
    };
  }

  docToClient(p: Point): Point {
    const rect = this.svg.getBoundingClientRect();
    const vp = this.editor.viewport;
    return {
      x: rect.left + (p.x - vp.x) * vp.zoom,
      y: rect.top + (p.y - vp.y) * vp.zoom,
    };
  }

  visibleDocRect(): Rect {
    const rect = this.svg.getBoundingClientRect();
    const vp = this.editor.viewport;
    return {
      x: vp.x,
      y: vp.y,
      w: rect.width / vp.zoom,
      h: rect.height / vp.zoom,
    };
  }

  // ----- viewport ------------------------------------------------------------

  setZoom(zoom: number, aroundClient?: Point): void {
    const vp = this.editor.viewport;
    const clamped = Math.max(0.1, Math.min(8, zoom));
    if (aroundClient) {
      const before = this.clientToDoc(aroundClient.x, aroundClient.y);
      vp.zoom = clamped;
      const after = this.clientToDoc(aroundClient.x, aroundClient.y);
      vp.x += before.x - after.x;
      vp.y += before.y - after.y;
    } else {
      const rect = this.svg.getBoundingClientRect();
      const center = this.clientToDoc(rect.left + rect.width / 2, rect.top + rect.height / 2);
      vp.zoom = clamped;
      const centerAfter = this.clientToDoc(rect.left + rect.width / 2, rect.top + rect.height / 2);
      vp.x += center.x - centerAfter.x;
      vp.y += center.y - centerAfter.y;
    }
    this.refresh();
    this.editor.notify();
  }

  pan(dxClient: number, dyClient: number): void {
    const vp = this.editor.viewport;
    vp.x -= dxClient / vp.zoom;
    vp.y -= dyClient / vp.zoom;
    this.refresh();
  }

  fitRect(r: Rect, padding = 60): void {
    const rect = this.svg.getBoundingClientRect();
    if (r.w <= 0 || r.h <= 0 || rect.width === 0) return;
    const zoom = Math.max(
      0.1,
      Math.min(
        4,
        Math.min(
          rect.width / (r.w + padding * 2),
          rect.height / (r.h + padding * 2)
        )
      )
    );
    const vp = this.editor.viewport;
    vp.zoom = zoom;
    vp.x = r.x + r.w / 2 - rect.width / zoom / 2;
    vp.y = r.y + r.h / 2 - rect.height / zoom / 2;
    this.refresh();
    this.editor.notify();
  }

  // ----- rendering -------------------------------------------------------------

  refresh(): void {
    const vp = this.editor.viewport;
    this.root.setAttribute(
      "transform",
      `scale(${vp.zoom}) translate(${-vp.x},${-vp.y})`
    );
    this.refreshGrid();
    this.refreshContent();
    this.refreshOverlay();
  }

  refreshContent(): void {
    this.contentLayer.innerHTML = docContentSVG(this.editor.doc, false);
  }

  refreshGrid(): void {
    const doc = this.editor.doc;
    if (!doc.canvas.gridVisible) {
      this.gridLayer.innerHTML = "";
      return;
    }
    const area = this.visibleDocRect();
    // pad so grid covers while panning
    this.gridLayer.innerHTML = gridSVG(doc, {
      x: area.x - 100,
      y: area.y - 100,
      w: area.w + 200,
      h: area.h + 200,
    });
  }

  refreshOverlay(): void {
    const ed = this.editor;
    const vp = ed.viewport;
    const px = (n: number) => n / vp.zoom; // constant screen-size in doc units
    let out = "";

    if (!this.hideSelectionUI) {
      // Hover anchors (connection points)
      const hoverId = this.hoverShapeId;
      if (hoverId) {
        const s = ed.shape(hoverId);
        if (s && !s.locked) {
          for (const a of shapeAnchorPoints(s)) {
            out += `<circle data-anchor="${escapeXML(a.id)}" data-anchor-shape="${escapeXML(s.id)}" cx="${a.point.x}" cy="${a.point.y}" r="${px(4)}" fill="#ffffff" stroke="#2563eb" stroke-width="${px(1.5)}" style="cursor:crosshair"/>`;
          }
        }
      }

      // Selection outlines
      const selShapes = ed.selectedShapes();
      for (const s of selShapes) {
        const b = shapeBounds(s);
        out += `<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" fill="none" stroke="#2563eb" stroke-width="${px(1)}" stroke-dasharray="${px(4)} ${px(3)}" pointer-events="none"/>`;
        if (s.locked) {
          out += `<text x="${b.x + b.w - px(14)}" y="${b.y + px(14)}" font-size="${px(11)}" fill="#dc2626" pointer-events="none">🔒</text>`;
        }
      }

      // Resize handles: single unlocked, unrotated shape
      if (selShapes.length === 1 && !selShapes[0].locked && ed.selectedConnectors().length === 0) {
        const s = selShapes[0];
        if (!s.rotation) {
          const hs = px(7);
          for (const h of HANDLE_DEFS) {
            const hx = s.x + s.w * h.rx - hs / 2;
            const hy = s.y + s.h * h.ry - hs / 2;
            out += `<rect data-handle="${h.id}" x="${hx}" y="${hy}" width="${hs}" height="${hs}" fill="#ffffff" stroke="#2563eb" stroke-width="${px(1.2)}" style="cursor:${h.cursor}"/>`;
          }
        }
      }

      // Connector editing UI
      for (const c of ed.selectedConnectors()) {
        const route = routeConnector(ed.doc, c);
        out += `<path d="${route.d}" fill="none" stroke="#2563eb" stroke-width="${px(1)}" stroke-dasharray="${px(3)} ${px(3)}" pointer-events="none" opacity="0.7"/>`;
        if (c.locked) continue;
        // endpoints
        out += `<circle data-conn-end="source" data-conn-id="${escapeXML(c.id)}" cx="${route.start.point.x}" cy="${route.start.point.y}" r="${px(5)}" fill="${c.source.shapeId ? "#2563eb" : "#ffffff"}" stroke="#2563eb" stroke-width="${px(1.5)}" style="cursor:move"/>`;
        out += `<circle data-conn-end="target" data-conn-id="${escapeXML(c.id)}" cx="${route.end.point.x}" cy="${route.end.point.y}" r="${px(5)}" fill="${c.target.shapeId ? "#2563eb" : "#ffffff"}" stroke="#2563eb" stroke-width="${px(1.5)}" style="cursor:move"/>`;
        // waypoints
        c.points.forEach((p, i) => {
          out += `<rect data-bend="${i}" data-conn-id="${escapeXML(c.id)}" x="${p.x - px(4)}" y="${p.y - px(4)}" width="${px(8)}" height="${px(8)}" fill="#ffffff" stroke="#2563eb" stroke-width="${px(1.2)}" style="cursor:move" transform="rotate(45 ${p.x} ${p.y})"/>`;
        });
        // midpoints for inserting waypoints (straight/freeform/elbow only)
        if (c.type !== "curved") {
          const anchors = [route.start.point, ...c.points, route.end.point];
          for (let i = 0; i < anchors.length - 1; i++) {
            const mx = (anchors[i].x + anchors[i + 1].x) / 2;
            const my = (anchors[i].y + anchors[i + 1].y) / 2;
            out += `<circle data-bend-insert="${i}" data-conn-id="${escapeXML(c.id)}" cx="${mx}" cy="${my}" r="${px(3.5)}" fill="#ffffff" stroke="#93c5fd" stroke-width="${px(1.2)}" style="cursor:copy" opacity="0.9"/>`;
          }
        }
      }
    }

    // Snap guides
    for (const g of this.guides) {
      if (g.axis === "x") {
        out += `<line x1="${g.value}" y1="${g.from}" x2="${g.value}" y2="${g.to}" stroke="#f43f5e" stroke-width="${px(1)}" stroke-dasharray="${px(4)} ${px(3)}" pointer-events="none"/>`;
      } else {
        out += `<line x1="${g.from}" y1="${g.value}" x2="${g.to}" y2="${g.value}" stroke="#f43f5e" stroke-width="${px(1)}" stroke-dasharray="${px(4)} ${px(3)}" pointer-events="none"/>`;
      }
    }

    // Marquee
    if (this.marquee) {
      const m = this.marquee;
      out += `<rect x="${m.x}" y="${m.y}" width="${m.w}" height="${m.h}" fill="#2563eb" fill-opacity="0.08" stroke="#2563eb" stroke-width="${px(1)}" pointer-events="none"/>`;
    }

    if (this.connectorPreview) out += this.connectorPreview;

    this.overlayLayer.innerHTML = out;
  }
}
