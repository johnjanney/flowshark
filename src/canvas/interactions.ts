import type { Connector, ConnectorType, Point, Shape, ShapeType } from "../model/types";
import type { Editor } from "../core/editor";
import { CanvasView, type HandleId } from "./view";
import { snapMove, snapPoint } from "../core/snap";
import {
  dist,
  distToPolyline,
  pointAlongPolyline,
  polylineLength,
  rectsIntersect,
  shapeBounds,
} from "../core/geometry";
import { routeConnector, shapeAnchorPoints } from "../connectors/routing";
import {
  attachedEnd,
  freeEnd,
  newConnector,
  newLabel,
  newShape,
  nextZ,
} from "../model/defaults";

export type Tool = "select" | "pan" | "text" | "connector";

interface DragState {
  mode:
    | "none"
    | "maybe-drag"
    | "move"
    | "marquee"
    | "pan"
    | "resize"
    | "connector-new"
    | "connector-end"
    | "bend"
    | "label";
  startClient: Point;
  startDoc: Point;
  moved: boolean;
  // move
  origBounds?: { x: number; y: number; w: number; h: number };
  // resize
  handle?: HandleId;
  origShape?: Shape;
  // connector drawing / retargeting
  connId?: string;
  connEnd?: "source" | "target";
  fromShapeId?: string;
  fromAnchor?: string | null;
  // bend point dragging
  bendIndex?: number;
  // label dragging
  labelId?: string;
  additive?: boolean;
  clickedId?: string | null;
}

/**
 * Pointer/keyboard interaction controller for the canvas.
 */
export class Interactions {
  tool: Tool = "select";
  connectorType: ConnectorType = "elbow";
  /** shape type armed for click-to-place (from the shape panel) */
  pendingShape: ShapeType | null = null;

  private drag: DragState = idleDrag();
  private spaceDown = false;
  private textEditor: HTMLElement | null = null;
  onToolChange: (() => void) | null = null;
  onCursorMove: ((p: Point) => void) | null = null;
  /** called for double-click on empty canvas etc. */
  onRequestEditText: (() => void) | null = null;

  constructor(public editor: Editor, public view: CanvasView) {
    const svg = view.svg;
    svg.addEventListener("pointerdown", (e) => this.pointerDown(e));
    svg.addEventListener("pointermove", (e) => this.pointerMove(e));
    svg.addEventListener("pointerup", (e) => this.pointerUp(e));
    svg.addEventListener("dblclick", (e) => this.doubleClick(e));
    svg.addEventListener("wheel", (e) => this.wheel(e), { passive: false });
    svg.addEventListener("contextmenu", (e) => e.preventDefault());

    // drag & drop from the shape panel
    svg.addEventListener("dragover", (e) => {
      if (e.dataTransfer?.types.includes("application/x-flowshark-shape")) {
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
      }
    });
    svg.addEventListener("drop", (e) => {
      const type = e.dataTransfer?.getData("application/x-flowshark-shape");
      if (!type) return;
      e.preventDefault();
      const p = view.clientToDoc(e.clientX, e.clientY);
      this.placeShape(type as ShapeType, p);
    });

    window.addEventListener("keydown", (e) => {
      if (e.key === " " && !this.isTyping(e)) {
        this.spaceDown = true;
        this.view.host.classList.add("tool-pan");
      }
    });
    window.addEventListener("keyup", (e) => {
      if (e.key === " ") {
        this.spaceDown = false;
        if (this.tool !== "pan") this.view.host.classList.remove("tool-pan");
      }
    });
  }

  setTool(tool: Tool): void {
    this.tool = tool;
    this.pendingShape = null;
    this.view.host.className = "";
    this.view.host.id = "canvas-host";
    if (tool === "pan") this.view.host.classList.add("tool-pan");
    if (tool === "text") this.view.host.classList.add("tool-text");
    if (tool === "connector") this.view.host.classList.add("tool-connector");
    this.onToolChange?.();
  }

  armShape(type: ShapeType): void {
    this.pendingShape = type;
    this.tool = "select";
    this.view.host.classList.add("tool-connector"); // crosshair
    this.onToolChange?.();
  }

  private isTyping(e: KeyboardEvent): boolean {
    const t = e.target as HTMLElement;
    return (
      !!this.textEditor ||
      t.tagName === "INPUT" ||
      t.tagName === "TEXTAREA" ||
      t.tagName === "SELECT" ||
      t.isContentEditable
    );
  }

  placeShape(type: ShapeType, at: Point): void {
    const ed = this.editor;
    const def = newShape(type, 0, 0, 0);
    const p = snapPoint(ed.doc, { x: at.x - def.w / 2, y: at.y - def.h / 2 });
    ed.apply("Add shape", (doc) => {
      const s = newShape(type, p.x, p.y, nextZ(doc));
      doc.shapes.push(s);
      ed.selection = new Set([s.id]);
    });
    this.pendingShape = null;
    this.view.host.classList.remove("tool-connector");
    this.view.refresh();
    this.onToolChange?.();
  }

  // ----- pointer events ------------------------------------------------------

  private hitInfo(e: PointerEvent | MouseEvent): {
    id: string | null;
    kind: string | null;
    handle: string | null;
    anchor: { shapeId: string; anchor: string } | null;
    connEnd: { connId: string; end: "source" | "target" } | null;
    bend: { connId: string; index: number } | null;
    bendInsert: { connId: string; index: number } | null;
    labelId: string | null;
  } {
    // With pointer capture active (drags) and for dblclick, the event target
    // is retargeted to the svg root — resolve the real element by position.
    let t = e.target as SVGElement;
    if (t === (this.view.svg as unknown) || t === (this.view.root as unknown)) {
      const under = document.elementFromPoint(e.clientX, e.clientY);
      if (under instanceof SVGElement && this.view.svg.contains(under)) {
        t = under;
      }
    }
    const handleEl = t.closest("[data-handle]") as SVGElement | null;
    const anchorEl = t.closest("[data-anchor]") as SVGElement | null;
    const connEndEl = t.closest("[data-conn-end]") as SVGElement | null;
    const bendEl = t.closest("[data-bend]") as SVGElement | null;
    const bendInsertEl = t.closest("[data-bend-insert]") as SVGElement | null;
    const labelEl = t.closest("[data-label-id]") as SVGElement | null;
    const idEl = t.closest("[data-id]") as SVGElement | null;
    return {
      id: idEl?.getAttribute("data-id") ?? null,
      kind: idEl?.getAttribute("data-kind") ?? null,
      handle: handleEl?.getAttribute("data-handle") ?? null,
      anchor: anchorEl
        ? {
            shapeId: anchorEl.getAttribute("data-anchor-shape")!,
            anchor: anchorEl.getAttribute("data-anchor")!,
          }
        : null,
      connEnd: connEndEl
        ? {
            connId: connEndEl.getAttribute("data-conn-id")!,
            end: connEndEl.getAttribute("data-conn-end") as "source" | "target",
          }
        : null,
      bend: bendEl
        ? {
            connId: bendEl.getAttribute("data-conn-id")!,
            index: Number(bendEl.getAttribute("data-bend")),
          }
        : null,
      bendInsert: bendInsertEl
        ? {
            connId: bendInsertEl.getAttribute("data-conn-id")!,
            index: Number(bendInsertEl.getAttribute("data-bend-insert")),
          }
        : null,
      labelId: labelEl?.getAttribute("data-label-id") ?? null,
    };
  }

  private pointerDown(e: PointerEvent): void {
    this.view.svg.setPointerCapture(e.pointerId);
    this.view.svg.focus({ preventScroll: true });
    this.commitTextEdit();
    const ed = this.editor;
    const docPt = this.view.clientToDoc(e.clientX, e.clientY);
    const hit = this.hitInfo(e);
    const additive = e.shiftKey || e.ctrlKey;

    // Pan: middle button, space, or pan tool
    if (e.button === 1 || this.spaceDown || this.tool === "pan") {
      this.drag = {
        ...idleDrag(),
        mode: "pan",
        startClient: { x: e.clientX, y: e.clientY },
        startDoc: docPt,
      };
      this.view.host.classList.add("panning");
      return;
    }
    if (e.button !== 0) return;

    // Armed shape placement
    if (this.pendingShape) {
      this.placeShape(this.pendingShape, docPt);
      return;
    }

    // Text tool: click to create a text box
    if (this.tool === "text") {
      const p = snapPoint(ed.doc, { x: docPt.x - 80, y: docPt.y - 20 });
      let created: Shape | null = null;
      ed.apply("Add text", (doc) => {
        created = newShape("text", p.x, p.y, nextZ(doc));
        doc.shapes.push(created);
        ed.selection = new Set([created.id]);
      });
      this.setTool("select");
      this.view.refresh();
      if (created) this.startTextEdit((created as Shape).id);
      return;
    }

    // Connector tool: start drawing from wherever we press
    if (this.tool === "connector") {
      const fromShape = hit.kind === "shape" ? hit.id : null;
      this.beginConnectorDraw(docPt, fromShape, null, e);
      return;
    }

    // ---- select tool ----
    if (hit.handle && ed.selectedShapes().length === 1) {
      const s = ed.selectedShapes()[0];
      ed.begin("Resize");
      this.drag = {
        ...idleDrag(),
        mode: "resize",
        startClient: { x: e.clientX, y: e.clientY },
        startDoc: docPt,
        handle: hit.handle as HandleId,
        origShape: structuredClone(s),
      };
      return;
    }

    if (hit.anchor) {
      this.beginConnectorDraw(docPt, hit.anchor.shapeId, hit.anchor.anchor, e);
      return;
    }

    if (hit.connEnd) {
      const c = ed.connector(hit.connEnd.connId);
      if (c && !c.locked) {
        ed.begin("Reconnect");
        this.drag = {
          ...idleDrag(),
          mode: "connector-end",
          startClient: { x: e.clientX, y: e.clientY },
          startDoc: docPt,
          connId: c.id,
          connEnd: hit.connEnd.end,
        };
        return;
      }
    }

    if (hit.bendInsert) {
      const c = ed.connector(hit.bendInsert.connId);
      if (c && !c.locked) {
        ed.begin("Add bend point");
        c.points.splice(hit.bendInsert.index, 0, { ...docPt });
        this.drag = {
          ...idleDrag(),
          mode: "bend",
          startClient: { x: e.clientX, y: e.clientY },
          startDoc: docPt,
          connId: c.id,
          bendIndex: hit.bendInsert.index,
        };
        this.view.refresh();
        return;
      }
    }

    if (hit.bend) {
      const c = ed.connector(hit.bend.connId);
      if (c && !c.locked) {
        if (e.altKey) {
          ed.apply("Remove bend point", () => {
            c.points.splice(hit.bend!.index, 1);
          });
          this.view.refresh();
          return;
        }
        ed.begin("Move bend point");
        this.drag = {
          ...idleDrag(),
          mode: "bend",
          startClient: { x: e.clientX, y: e.clientY },
          startDoc: docPt,
          connId: c.id,
          bendIndex: hit.bend.index,
        };
        return;
      }
    }

    if (hit.id) {
      const el = ed.element(hit.id);
      if (el) {
        const isSelected = ed.selection.has(hit.id);
        if (additive) {
          ed.toggleSelect(hit.id);
        } else if (!isSelected) {
          ed.select([hit.id]);
        }
        this.view.refreshOverlay();
        // begin potential move drag (shapes or free connectors)
        if (!el.locked) {
          const bounds = ed.selectionBounds();
          ed.begin("Move");
          this.drag = {
            ...idleDrag(),
            mode: "maybe-drag",
            startClient: { x: e.clientX, y: e.clientY },
            startDoc: docPt,
            origBounds: bounds ?? undefined,
            additive,
            clickedId: hit.id,
          };
        }
        return;
      }
    }

    // empty canvas: marquee
    if (!additive) ed.deselect();
    this.drag = {
      ...idleDrag(),
      mode: "marquee",
      startClient: { x: e.clientX, y: e.clientY },
      startDoc: docPt,
      additive,
    };
  }

  private beginConnectorDraw(
    docPt: Point,
    fromShapeId: string | null,
    fromAnchor: string | null,
    e: PointerEvent
  ): void {
    this.editor.begin("Add connector");
    this.drag = {
      ...idleDrag(),
      mode: "connector-new",
      startClient: { x: e.clientX, y: e.clientY },
      startDoc: docPt,
      fromShapeId: fromShapeId ?? undefined,
      fromAnchor,
    };
  }

  private pointerMove(e: PointerEvent): void {
    const ed = this.editor;
    const docPt = this.view.clientToDoc(e.clientX, e.clientY);
    this.onCursorMove?.(docPt);

    if (this.drag.mode === "none") {
      // hover feedback: show anchors under cursor
      const hit = this.hitInfo(e);
      const newHover =
        hit.kind === "shape" && this.tool === "select" ? hit.id : hit.anchor?.shapeId ?? null;
      if (newHover !== this.view.hoverShapeId) {
        this.view.hoverShapeId = newHover;
        this.view.refreshOverlay();
      }
      return;
    }

    const dxc = e.clientX - this.drag.startClient.x;
    const dyc = e.clientY - this.drag.startClient.y;

    switch (this.drag.mode) {
      case "pan": {
        this.view.pan(dxc, dyc);
        this.drag.startClient = { x: e.clientX, y: e.clientY };
        break;
      }
      case "maybe-drag": {
        if (Math.hypot(dxc, dyc) > 3) {
          this.drag.mode = "move";
          this.applyMoveDrag(dxc, dyc, e.altKey);
        }
        break;
      }
      case "move": {
        this.applyMoveDrag(dxc, dyc, e.altKey);
        break;
      }
      case "marquee": {
        const a = this.drag.startDoc;
        this.view.marquee = {
          x: Math.min(a.x, docPt.x),
          y: Math.min(a.y, docPt.y),
          w: Math.abs(a.x - docPt.x),
          h: Math.abs(a.y - docPt.y),
        };
        this.view.refreshOverlay();
        break;
      }
      case "resize": {
        this.drag.moved = true;
        ed.restorePendingPreview();
        const s = ed.shape(this.drag.origShape!.id);
        if (!s) break;
        const orig = this.drag.origShape!;
        const zoom = ed.viewport.zoom;
        let dx = dxc / zoom;
        let dy = dyc / zoom;
        const h = this.drag.handle!;
        const min = 12;
        let { x, y, w, h: hh } = orig;
        if (h.includes("e")) w = Math.max(min, orig.w + dx);
        if (h.includes("s")) hh = Math.max(min, orig.h + dy);
        if (h.includes("w")) {
          w = Math.max(min, orig.w - dx);
          x = orig.x + orig.w - w;
        }
        if (h.includes("n")) {
          hh = Math.max(min, orig.h - dy);
          y = orig.y + orig.h - hh;
        }
        if (e.shiftKey && orig.w > 0 && orig.h > 0) {
          const ratio = orig.w / orig.h;
          if (w / hh > ratio) w = hh * ratio;
          else hh = w / ratio;
          if (h.includes("w")) x = orig.x + orig.w - w;
          if (h.includes("n")) y = orig.y + orig.h - hh;
        }
        if (!e.altKey && ed.doc.canvas.snapToGrid) {
          const g = ed.doc.canvas.gridSize;
          if (h.includes("e")) w = Math.max(min, Math.round((x + w) / g) * g - x);
          if (h.includes("s")) hh = Math.max(min, Math.round((y + hh) / g) * g - y);
          if (h.includes("w")) {
            const nx = Math.round(x / g) * g;
            w = Math.max(min, w + (x - nx));
            x = nx;
          }
          if (h.includes("n")) {
            const ny = Math.round(y / g) * g;
            hh = Math.max(min, hh + (y - ny));
            y = ny;
          }
        }
        s.x = x;
        s.y = y;
        s.w = w;
        s.h = hh;
        this.view.refresh();
        break;
      }
      case "connector-new": {
        this.drag.moved = true;
        const targetHit = this.hitInfo(e);
        const targetShape =
          targetHit.anchor?.shapeId ??
          (targetHit.kind === "shape" ? targetHit.id : null);
        this.view.hoverShapeId = targetShape;
        // preview line
        const from = this.connectorStartPoint(docPt);
        const zoom = ed.viewport.zoom;
        this.view.connectorPreview = `<line x1="${from.x}" y1="${from.y}" x2="${docPt.x}" y2="${docPt.y}" stroke="#2563eb" stroke-width="${1.5 / zoom}" stroke-dasharray="${5 / zoom} ${4 / zoom}" pointer-events="none"/>`;
        this.view.refreshOverlay();
        break;
      }
      case "connector-end": {
        this.drag.moved = true;
        const c = ed.connector(this.drag.connId!);
        if (!c) break;
        const targetHit = this.hitInfo(e);
        const overShape =
          targetHit.anchor?.shapeId ??
          (targetHit.kind === "shape" && targetHit.id !== c.id ? targetHit.id : null);
        const end = this.drag.connEnd === "source" ? c.source : c.target;
        if (overShape) {
          end.shapeId = overShape;
          end.anchor = targetHit.anchor?.anchor ?? null;
        } else {
          end.shapeId = null;
          end.anchor = null;
          const p = snapPoint(ed.doc, docPt, e.altKey);
          end.x = p.x;
          end.y = p.y;
        }
        this.view.hoverShapeId = overShape;
        this.view.refresh();
        break;
      }
      case "bend": {
        this.drag.moved = true;
        const c = ed.connector(this.drag.connId!);
        if (!c || this.drag.bendIndex === undefined) break;
        const p = snapPoint(ed.doc, docPt, e.altKey);
        c.points[this.drag.bendIndex] = p;
        this.view.refresh();
        break;
      }
      default:
        break;
    }
  }

  /** Re-apply a move drag from the pristine pre-drag document. */
  private applyMoveDrag(dxc: number, dyc: number, disableSnap: boolean): void {
    const ed = this.editor;
    this.drag.moved = true;
    ed.restorePendingPreview();
    const zoom = ed.viewport.zoom;
    const bounds = this.drag.origBounds!;
    const { dx, dy, guides } = snapMove(
      ed.doc,
      ed.selection,
      dxc / zoom,
      dyc / zoom,
      bounds,
      disableSnap
    );
    ed.moveSelection(dx, dy);
    this.view.guides = guides;
    this.view.refresh();
  }

  /** Start point for the connector preview while drawing. */
  private connectorStartPoint(cursor: Point): Point {
    const ed = this.editor;
    if (this.drag.fromShapeId) {
      const s = ed.shape(this.drag.fromShapeId);
      if (s) {
        const anchors = shapeAnchorPoints(s);
        if (this.drag.fromAnchor) {
          const a = anchors.find((x) => x.id === this.drag.fromAnchor);
          if (a) return a.point;
        }
        let best = anchors[0].point;
        let bd = Infinity;
        for (const a of anchors) {
          const d = dist(a.point, cursor);
          if (d < bd) {
            bd = d;
            best = a.point;
          }
        }
        return best;
      }
    }
    return this.drag.startDoc;
  }

  private pointerUp(e: PointerEvent): void {
    const ed = this.editor;
    const docPt = this.view.clientToDoc(e.clientX, e.clientY);
    const drag = this.drag;
    this.drag = idleDrag();
    this.view.guides = [];
    this.view.connectorPreview = null;
    this.view.host.classList.remove("panning");

    switch (drag.mode) {
      case "pan":
        break;
      case "maybe-drag": {
        // plain click on an already-selected element without moving
        ed.cancel();
        if (!drag.additive && drag.clickedId) {
          ed.select([drag.clickedId]);
        }
        break;
      }
      case "move":
      case "resize":
      case "bend":
        if (drag.moved) ed.commit();
        else ed.cancel();
        break;
      case "connector-end": {
        if (drag.moved) ed.commit();
        else ed.cancel();
        this.view.hoverShapeId = null;
        break;
      }
      case "marquee": {
        const m = this.view.marquee;
        this.view.marquee = null;
        if (m && (m.w > 2 || m.h > 2)) {
          const ids: string[] = [];
          for (const s of ed.doc.shapes) {
            if (!s.locked && rectsIntersect(m, shapeBounds(s))) ids.push(s.id);
          }
          for (const c of ed.doc.connectors) {
            if (c.locked) continue;
            const route = routeConnector(ed.doc, c);
            if (route.polyline.some((p) => p.x >= m.x && p.x <= m.x + m.w && p.y >= m.y && p.y <= m.y + m.h)) {
              ids.push(c.id);
            }
          }
          ed.select(ids, drag.additive);
        }
        this.view.refreshOverlay();
        break;
      }
      case "connector-new": {
        const hit = this.hitInfo(e);
        const targetShapeId =
          hit.anchor?.shapeId ?? (hit.kind === "shape" ? hit.id : null);
        if (!drag.moved) {
          ed.cancel();
          break;
        }
        const source = drag.fromShapeId
          ? attachedEnd(drag.fromShapeId, drag.fromAnchor ?? null)
          : freeEnd(drag.startDoc.x, drag.startDoc.y);
        const p = snapPoint(ed.doc, docPt, e.altKey);
        const target =
          targetShapeId && targetShapeId !== drag.fromShapeId
            ? attachedEnd(targetShapeId, hit.anchor?.anchor ?? null)
            : freeEnd(p.x, p.y);
        const c = newConnector(this.connectorType, source, target, nextZ(ed.doc));
        ed.doc.connectors.push(c);
        ed.commit();
        ed.select([c.id]);
        this.view.hoverShapeId = null;
        if (this.tool === "connector") this.setTool("select");
        this.view.refresh();
        break;
      }
      default:
        break;
    }
    this.view.refreshOverlay();
  }

  private doubleClick(e: MouseEvent): void {
    const hit = this.hitInfo(e);
    const ed = this.editor;
    if (hit.kind === "shape" && hit.id) {
      const s = ed.shape(hit.id);
      if (s && !s.locked) this.startTextEdit(hit.id);
      return;
    }
    if (hit.kind === "connector" && hit.id) {
      const c = ed.connector(hit.id);
      if (!c || c.locked) return;
      if (hit.labelId) {
        this.startLabelEdit(c.id, hit.labelId);
        return;
      }
      // add a new label at the position clicked
      const docPt = this.view.clientToDoc(e.clientX, e.clientY);
      const route = routeConnector(ed.doc, c);
      const near = distToPolyline(docPt, route.polyline);
      // convert segment index + t into arc-length fraction
      let lenBefore = 0;
      for (let i = 0; i < near.segIndex; i++) {
        lenBefore += dist(route.polyline[i], route.polyline[i + 1]);
      }
      lenBefore +=
        near.t * dist(route.polyline[near.segIndex], route.polyline[near.segIndex + 1]);
      const total = Math.max(1e-6, polylineLength(route.polyline));
      const t = Math.max(0.05, Math.min(0.95, lenBefore / total));
      let labelId = "";
      ed.apply("Add label", () => {
        const label = newLabel("", t);
        labelId = label.id;
        c.labels.push(label);
      });
      this.startLabelEdit(c.id, labelId);
      return;
    }
    // double-click empty canvas: add a process shape (quick create)
    if (!hit.id) {
      const docPt = this.view.clientToDoc(e.clientX, e.clientY);
      this.placeShape("process", docPt);
    }
  }

  private wheel(e: WheelEvent): void {
    e.preventDefault();
    const vp = this.editor.viewport;
    if (e.ctrlKey || e.metaKey) {
      const factor = Math.exp(-e.deltaY * 0.0015);
      this.view.setZoom(vp.zoom * factor, { x: e.clientX, y: e.clientY });
    } else if (e.shiftKey) {
      this.view.pan(-e.deltaY, 0);
    } else {
      this.view.pan(-e.deltaX, -e.deltaY);
    }
  }

  // ----- inline text editing ---------------------------------------------------

  startTextEdit(shapeId: string): void {
    const ed = this.editor;
    const s = ed.shape(shapeId);
    if (!s) return;
    this.commitTextEdit();
    const vp = ed.viewport;
    const topLeft = this.view.docToClient({ x: s.x, y: s.y });
    const hostRect = this.view.host.getBoundingClientRect();

    const div = document.createElement("div");
    div.className = "text-editor";
    div.contentEditable = "plaintext-only";
    if (div.contentEditable !== "plaintext-only") div.contentEditable = "true";
    div.textContent = s.text;
    div.style.left = `${topLeft.x - hostRect.left}px`;
    div.style.top = `${topLeft.y - hostRect.top}px`;
    div.style.width = `${s.w * vp.zoom}px`;
    div.style.minHeight = `${s.h * vp.zoom}px`;
    div.style.fontFamily = s.textStyle.fontFamily;
    div.style.fontSize = `${s.textStyle.fontSize * vp.zoom}px`;
    div.style.fontWeight = s.textStyle.bold ? "700" : "400";
    div.style.fontStyle = s.textStyle.italic ? "italic" : "normal";
    div.style.color = s.textStyle.color;
    div.style.lineHeight = String(s.textStyle.lineHeight);
    div.style.textAlign = s.textStyle.align;

    let committed = false;
    const commit = () => {
      if (committed) return;
      committed = true;
      const text = div.textContent ?? "";
      div.remove();
      this.textEditor = null;
      if (text !== s.text) {
        ed.apply("Edit text", () => {
          const cur = ed.shape(shapeId);
          if (cur) cur.text = text;
        });
      }
      this.view.refresh();
    };
    div.addEventListener("keydown", (ke) => {
      ke.stopPropagation();
      if (ke.key === "Escape") {
        div.textContent = s.text;
        commit();
      } else if (ke.key === "Enter" && !ke.shiftKey) {
        ke.preventDefault();
        commit();
      }
    });
    div.addEventListener("focusout", () => commit());

    this.view.host.appendChild(div);
    this.textEditor = div;
    // put caret at end
    const range = document.createRange();
    range.selectNodeContents(div);
    range.collapse(false);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
    div.focus();
  }

  startLabelEdit(connId: string, labelId: string): void {
    const ed = this.editor;
    const c = ed.connector(connId);
    const label = c?.labels.find((l) => l.id === labelId);
    if (!c || !label) return;
    this.commitTextEdit();
    const route = routeConnector(ed.doc, c);
    const posInfo = labelDocPosition(route.polyline, label.t, label.offset);
    const client = this.view.docToClient(posInfo);
    const hostRect = this.view.host.getBoundingClientRect();
    const vp = ed.viewport;

    const div = document.createElement("div");
    div.className = "text-editor";
    div.contentEditable = "true";
    div.style.left = `${client.x - hostRect.left - 60}px`;
    div.style.top = `${client.y - hostRect.top - 12}px`;
    div.style.width = `120px`;
    div.style.minHeight = `20px`;
    div.style.background = "var(--panel)";
    div.style.textAlign = "center";
    div.style.fontSize = `${label.style.fontSize * vp.zoom}px`;
    div.textContent = label.text;

    let committed = false;
    const commit = () => {
      if (committed) return;
      committed = true;
      const text = (div.textContent ?? "").trim();
      div.remove();
      this.textEditor = null;
      ed.apply(text ? "Edit label" : "Remove label", () => {
        const cur = ed.connector(connId);
        if (!cur) return;
        const l = cur.labels.find((x) => x.id === labelId);
        if (!l) return;
        if (text) l.text = text;
        else cur.labels = cur.labels.filter((x) => x.id !== labelId);
      });
      this.view.refresh();
    };
    div.addEventListener("keydown", (ke) => {
      ke.stopPropagation();
      if (ke.key === "Escape" || (ke.key === "Enter" && !ke.shiftKey)) {
        ke.preventDefault();
        commit();
      }
    });
    div.addEventListener("focusout", () => commit());
    this.view.host.appendChild(div);
    this.textEditor = div;
    const range = document.createRange();
    range.selectNodeContents(div);
    range.collapse(false);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
    div.focus();
  }

  commitTextEdit(): void {
    if (this.textEditor) {
      // triggers focusout handler which commits
      const ed = this.textEditor;
      this.textEditor = null;
      ed.dispatchEvent(new FocusEvent("focusout"));
      ed.remove();
    }
  }
}

function idleDrag(): DragState {
  return {
    mode: "none",
    startClient: { x: 0, y: 0 },
    startDoc: { x: 0, y: 0 },
    moved: false,
  };
}

function labelDocPosition(polyline: Point[], t: number, offset: number): Point {
  const { point, dir } = pointAlongPolyline(polyline, t);
  return { x: point.x - dir.y * offset, y: point.y + dir.x * offset };
}
