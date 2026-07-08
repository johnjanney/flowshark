import type {
  Connector,
  Element,
  FlowDoc,
  Group,
  Point,
  Rect,
  Shape,
} from "../model/types";
import { newDoc, nextZ, uid } from "../model/defaults";
import { shapeBounds, unionRects } from "../core/geometry";
import { routeConnector } from "../connectors/routing";

export type AlignOp = "left" | "hcenter" | "right" | "top" | "vcenter" | "bottom";
export type DistributeOp = "horizontal" | "vertical";
export type SizeOp = "width" | "height" | "both";
export type OrderOp = "front" | "back" | "forward" | "backward";

export interface Viewport {
  x: number; // doc coordinate at the left edge
  y: number;
  zoom: number;
}

interface Snapshot {
  label: string;
  doc: FlowDoc;
}

const MAX_UNDO = 200;

export interface StyleClipboard {
  fill?: Shape["fill"];
  stroke?: Shape["stroke"];
  cornerRadius?: number;
  textStyle?: Shape["textStyle"];
  connectorStroke?: Connector["stroke"];
  startCap?: Connector["startCap"];
  endCap?: Connector["endCap"];
  opacity?: number;
}

/**
 * Central editor state. Undo/redo is snapshot-based: every user-visible
 * mutation goes through begin()/commit() (or the `apply` helper) which
 * pushes a deep clone of the document on the undo stack.
 */
export class Editor {
  doc: FlowDoc = newDoc();
  selection = new Set<string>();
  viewport: Viewport = { x: -100, y: -80, zoom: 1 };
  filePath: string | null = null;
  dirty = false;

  private undoStack: Snapshot[] = [];
  private redoStack: Snapshot[] = [];
  private pending: Snapshot | null = null;
  private listeners = new Set<() => void>();
  clipboard: { shapes: Shape[]; connectors: Connector[]; groups: Group[] } | null = null;
  styleClipboard: StyleClipboard | null = null;
  private pasteCount = 0;

  onChange(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  notify(): void {
    for (const fn of this.listeners) fn();
  }

  // ----- undo/redo -------------------------------------------------------

  /** Capture the current state before a mutation begins (e.g. drag start). */
  begin(label: string): void {
    if (!this.pending) {
      this.pending = { label, doc: structuredClone(this.doc) };
    }
  }

  /** Commit the pending mutation to the undo stack. */
  commit(): void {
    if (this.pending) {
      this.undoStack.push(this.pending);
      if (this.undoStack.length > MAX_UNDO) this.undoStack.shift();
      this.redoStack = [];
      this.pending = null;
      this.dirty = true;
      this.doc.modifiedAt = new Date().toISOString();
    }
    this.notify();
  }

  /**
   * During a drag preview: restore the document to the pending snapshot
   * while keeping the pending state, so the drag can re-apply its full
   * delta from a pristine base each frame.
   */
  restorePendingPreview(): void {
    if (this.pending) {
      this.doc = structuredClone(this.pending.doc);
    }
  }

  /** Abandon a pending mutation (e.g. cancelled drag) and restore state. */
  cancel(): void {
    if (this.pending) {
      this.doc = this.pending.doc;
      this.pending = null;
    }
    this.notify();
  }

  /** One-shot mutation helper. */
  apply(label: string, fn: (doc: FlowDoc) => void): void {
    this.begin(label);
    fn(this.doc);
    this.commit();
  }

  undo(): void {
    const snap = this.undoStack.pop();
    if (!snap) return;
    this.redoStack.push({ label: snap.label, doc: this.doc });
    this.doc = snap.doc;
    this.pruneSelection();
    this.dirty = true;
    this.notify();
  }

  redo(): void {
    const snap = this.redoStack.pop();
    if (!snap) return;
    this.undoStack.push({ label: snap.label, doc: this.doc });
    this.doc = snap.doc;
    this.pruneSelection();
    this.dirty = true;
    this.notify();
  }

  canUndo(): boolean {
    return this.undoStack.length > 0;
  }
  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  setDoc(doc: FlowDoc, filePath: string | null): void {
    this.doc = doc;
    this.filePath = filePath;
    this.selection.clear();
    this.undoStack = [];
    this.redoStack = [];
    this.pending = null;
    this.dirty = false;
    this.pasteCount = 0;
    this.notify();
  }

  // ----- lookup ----------------------------------------------------------

  shape(id: string): Shape | undefined {
    return this.doc.shapes.find((s) => s.id === id);
  }
  connector(id: string): Connector | undefined {
    return this.doc.connectors.find((c) => c.id === id);
  }
  element(id: string): Element | undefined {
    return this.shape(id) ?? this.connector(id);
  }

  selectedShapes(): Shape[] {
    return this.doc.shapes.filter((s) => this.selection.has(s.id));
  }
  selectedConnectors(): Connector[] {
    return this.doc.connectors.filter((c) => this.selection.has(c.id));
  }
  selectedElements(): Element[] {
    return [...this.selectedShapes(), ...this.selectedConnectors()];
  }

  private pruneSelection(): void {
    const ids = new Set([
      ...this.doc.shapes.map((s) => s.id),
      ...this.doc.connectors.map((c) => c.id),
    ]);
    for (const id of [...this.selection]) {
      if (!ids.has(id)) this.selection.delete(id);
    }
  }

  // ----- selection -------------------------------------------------------

  /** Expand a clicked id to its whole group (top-most group). */
  expandToGroup(id: string): string[] {
    const el = this.element(id);
    if (!el || !el.groupId) return [id];
    const group = this.doc.groups.find((g) => g.id === el.groupId);
    return group ? [...group.memberIds] : [id];
  }

  select(ids: string[], additive = false): void {
    if (!additive) this.selection.clear();
    for (const id of ids) {
      for (const member of this.expandToGroup(id)) this.selection.add(member);
    }
    this.notify();
  }

  toggleSelect(id: string): void {
    const members = this.expandToGroup(id);
    const isSelected = members.every((m) => this.selection.has(m));
    for (const m of members) {
      if (isSelected) this.selection.delete(m);
      else this.selection.add(m);
    }
    this.notify();
  }

  selectAll(): void {
    this.selection = new Set([
      ...this.doc.shapes.filter((s) => !s.locked).map((s) => s.id),
      ...this.doc.connectors.filter((c) => !c.locked).map((c) => c.id),
    ]);
    this.notify();
  }

  deselect(): void {
    this.selection.clear();
    this.notify();
  }

  selectionBounds(): Rect | null {
    const rects: Rect[] = this.selectedShapes().map(shapeBounds);
    for (const c of this.selectedConnectors()) {
      const r = routeConnector(this.doc, c);
      for (const p of r.polyline) rects.push({ x: p.x, y: p.y, w: 0, h: 0 });
    }
    if (rects.length === 0) return null;
    return unionRects(rects);
  }

  // ----- editing operations ----------------------------------------------

  deleteSelection(): void {
    if (this.selection.size === 0) return;
    const ids = new Set(this.selection);
    this.apply("Delete", (doc) => {
      doc.shapes = doc.shapes.filter((s) => !ids.has(s.id) || s.locked);
      const kept = new Set(doc.shapes.map((s) => s.id));
      doc.connectors = doc.connectors.filter((c) => {
        if (ids.has(c.id) && !c.locked) return false;
        return true;
      });
      // detach connector ends that referenced deleted shapes
      for (const c of doc.connectors) {
        for (const end of [c.source, c.target]) {
          if (end.shapeId && !kept.has(end.shapeId)) {
            const routed = routeConnector(doc, c);
            const pt = end === c.source ? routed.start.point : routed.end.point;
            end.shapeId = null;
            end.anchor = null;
            end.x = pt.x;
            end.y = pt.y;
          }
        }
      }
      cleanGroups(doc);
    });
    this.selection.clear();
    this.notify();
  }

  moveSelection(dx: number, dy: number): void {
    const ids = this.selection;
    for (const s of this.doc.shapes) {
      if (ids.has(s.id) && !s.locked) {
        s.x += dx;
        s.y += dy;
      }
    }
    for (const c of this.doc.connectors) {
      const srcSel = c.source.shapeId && ids.has(c.source.shapeId);
      const tgtSel = c.target.shapeId && ids.has(c.target.shapeId);
      if (ids.has(c.id) || (srcSel && tgtSel)) {
        if (!c.locked) {
          for (const p of c.points) {
            p.x += dx;
            p.y += dy;
          }
          if (!c.source.shapeId) {
            c.source.x += dx;
            c.source.y += dy;
          }
          if (!c.target.shapeId) {
            c.target.x += dx;
            c.target.y += dy;
          }
        }
      }
    }
  }

  nudge(dx: number, dy: number): void {
    if (this.selection.size === 0) return;
    this.begin("Nudge");
    this.moveSelection(dx, dy);
    this.commit();
  }

  // ----- clipboard ---------------------------------------------------------

  copy(): void {
    const shapes = this.selectedShapes().map((s) => structuredClone(s));
    const shapeIds = new Set(shapes.map((s) => s.id));
    const connectors = this.doc.connectors
      .filter(
        (c) =>
          this.selection.has(c.id) ||
          (c.source.shapeId &&
            shapeIds.has(c.source.shapeId) &&
            c.target.shapeId &&
            shapeIds.has(c.target.shapeId))
      )
      .map((c) => structuredClone(c));
    const groupIds = new Set(
      [...shapes, ...connectors].map((e) => e.groupId).filter(Boolean) as string[]
    );
    const groups = this.doc.groups
      .filter((g) => groupIds.has(g.id))
      .map((g) => structuredClone(g));
    if (shapes.length || connectors.length) {
      this.clipboard = { shapes, connectors, groups };
      this.pasteCount = 0;
    }
  }

  cut(): void {
    this.copy();
    this.deleteSelection();
  }

  paste(at?: Point): void {
    if (!this.clipboard) return;
    this.pasteCount++;
    const offset = at ? 0 : 24 * this.pasteCount;
    const { shapes, connectors, groups } = structuredClone(this.clipboard);

    let dx = offset;
    let dy = offset;
    if (at && shapes.length + connectors.length > 0) {
      const rects = shapes.map(shapeBounds);
      for (const c of connectors) {
        if (!c.source.shapeId) rects.push({ x: c.source.x, y: c.source.y, w: 0, h: 0 });
        if (!c.target.shapeId) rects.push({ x: c.target.x, y: c.target.y, w: 0, h: 0 });
      }
      if (rects.length) {
        const b = unionRects(rects);
        dx = at.x - (b.x + b.w / 2);
        dy = at.y - (b.y + b.h / 2);
      }
    }

    const idMap = new Map<string, string>();
    for (const s of shapes) {
      const nid = uid("sh");
      idMap.set(s.id, nid);
      s.id = nid;
      s.x += dx;
      s.y += dy;
      s.locked = false;
    }
    for (const c of connectors) {
      const nid = uid("cn");
      idMap.set(c.id, nid);
      c.id = nid;
      c.locked = false;
      for (const p of c.points) {
        p.x += dx;
        p.y += dy;
      }
      for (const end of [c.source, c.target]) {
        if (end.shapeId) {
          const mapped = idMap.get(end.shapeId);
          if (mapped) {
            end.shapeId = mapped;
          } else {
            end.shapeId = null;
            end.anchor = null;
          }
        } else {
          end.x += dx;
          end.y += dy;
        }
      }
      for (const l of c.labels) l.id = uid("lb");
    }
    for (const g of groups) {
      const nid = uid("gr");
      idMap.set(g.id, nid);
      g.id = nid;
      g.memberIds = g.memberIds
        .map((m) => idMap.get(m))
        .filter(Boolean) as string[];
    }
    for (const e of [...shapes, ...connectors]) {
      e.groupId = e.groupId ? idMap.get(e.groupId) ?? null : null;
    }

    this.apply("Paste", (doc) => {
      let z = nextZ(doc);
      for (const s of shapes) s.zIndex = z++;
      for (const c of connectors) c.zIndex = z++;
      doc.shapes.push(...shapes);
      doc.connectors.push(...connectors);
      doc.groups.push(...groups.filter((g) => g.memberIds.length >= 2));
    });
    this.selection = new Set([
      ...shapes.map((s) => s.id),
      ...connectors.map((c) => c.id),
    ]);
    this.notify();
  }

  duplicate(): void {
    if (this.selection.size === 0) return;
    const saved = this.clipboard;
    this.copy();
    this.paste();
    this.clipboard = saved;
  }

  // ----- style copy/paste --------------------------------------------------

  copyStyle(): void {
    const s = this.selectedShapes()[0];
    const c = this.selectedConnectors()[0];
    if (s) {
      this.styleClipboard = {
        fill: structuredClone(s.fill),
        stroke: structuredClone(s.stroke),
        cornerRadius: s.cornerRadius,
        textStyle: structuredClone(s.textStyle),
      };
    } else if (c) {
      this.styleClipboard = {
        connectorStroke: structuredClone(c.stroke),
        startCap: c.startCap,
        endCap: c.endCap,
        opacity: c.opacity,
      };
    }
  }

  pasteStyle(): void {
    const sc = this.styleClipboard;
    if (!sc || this.selection.size === 0) return;
    this.apply("Paste style", (doc) => {
      for (const s of doc.shapes) {
        if (!this.selection.has(s.id) || s.locked) continue;
        if (sc.fill) s.fill = structuredClone(sc.fill);
        if (sc.stroke) s.stroke = structuredClone(sc.stroke);
        if (sc.cornerRadius !== undefined) s.cornerRadius = sc.cornerRadius;
        if (sc.textStyle) {
          s.textStyle = structuredClone(sc.textStyle);
        }
      }
      for (const c of doc.connectors) {
        if (!this.selection.has(c.id) || c.locked) continue;
        if (sc.connectorStroke) c.stroke = structuredClone(sc.connectorStroke);
        else if (sc.stroke) c.stroke = structuredClone(sc.stroke);
        if (sc.startCap) c.startCap = sc.startCap;
        if (sc.endCap) c.endCap = sc.endCap;
        if (sc.opacity !== undefined) c.opacity = sc.opacity;
      }
    });
  }

  // ----- grouping ----------------------------------------------------------

  group(): void {
    const members = this.selectedElements().filter((e) => !e.locked);
    if (members.length < 2) return;
    this.apply("Group", (doc) => {
      const gid = uid("gr");
      // dissolve old groups fully contained in the new one
      const oldGroupIds = new Set(
        members.map((m) => m.groupId).filter(Boolean) as string[]
      );
      doc.groups = doc.groups.filter((g) => !oldGroupIds.has(g.id));
      const memberIds = members.map((m) => m.id);
      doc.groups.push({ id: gid, memberIds });
      for (const s of doc.shapes) if (memberIds.includes(s.id)) s.groupId = gid;
      for (const c of doc.connectors) if (memberIds.includes(c.id)) c.groupId = gid;
    });
  }

  ungroup(): void {
    const groupIds = new Set(
      this.selectedElements()
        .map((e) => e.groupId)
        .filter(Boolean) as string[]
    );
    if (groupIds.size === 0) return;
    this.apply("Ungroup", (doc) => {
      doc.groups = doc.groups.filter((g) => !groupIds.has(g.id));
      for (const s of doc.shapes) if (s.groupId && groupIds.has(s.groupId)) s.groupId = null;
      for (const c of doc.connectors) if (c.groupId && groupIds.has(c.groupId)) c.groupId = null;
    });
  }

  // ----- z-order -------------------------------------------------------------

  order(op: OrderOp): void {
    if (this.selection.size === 0) return;
    this.apply("Reorder", (doc) => {
      const all: Element[] = [...doc.shapes, ...doc.connectors];
      all.sort((a, b) => a.zIndex - b.zIndex);
      const sel = all.filter((e) => this.selection.has(e.id));
      const rest = all.filter((e) => !this.selection.has(e.id));
      let ordered: Element[];
      switch (op) {
        case "front":
          ordered = [...rest, ...sel];
          break;
        case "back":
          ordered = [...sel, ...rest];
          break;
        case "forward": {
          ordered = [...all];
          for (let i = ordered.length - 2; i >= 0; i--) {
            if (
              this.selection.has(ordered[i].id) &&
              !this.selection.has(ordered[i + 1].id)
            ) {
              [ordered[i], ordered[i + 1]] = [ordered[i + 1], ordered[i]];
            }
          }
          break;
        }
        case "backward": {
          ordered = [...all];
          for (let i = 1; i < ordered.length; i++) {
            if (
              this.selection.has(ordered[i].id) &&
              !this.selection.has(ordered[i - 1].id)
            ) {
              [ordered[i], ordered[i - 1]] = [ordered[i - 1], ordered[i]];
            }
          }
          break;
        }
      }
      ordered.forEach((e, i) => (e.zIndex = i + 1));
    });
  }

  // ----- lock/hide -----------------------------------------------------------

  setLocked(locked: boolean): void {
    if (this.selection.size === 0) return;
    this.apply(locked ? "Lock" : "Unlock", () => {
      for (const e of this.selectedElements()) e.locked = locked;
    });
  }

  setHidden(hidden: boolean): void {
    if (this.selection.size === 0) return;
    this.apply(hidden ? "Hide" : "Show", () => {
      for (const e of this.selectedElements()) e.hidden = hidden;
    });
  }

  // ----- alignment / distribution / sizing ------------------------------------

  align(op: AlignOp): void {
    const shapes = this.selectedShapes().filter((s) => !s.locked);
    if (shapes.length < 2) return;
    const bounds = unionRects(shapes.map(shapeBounds));
    this.apply("Align", () => {
      for (const s of shapes) {
        const b = shapeBounds(s);
        switch (op) {
          case "left":
            s.x += bounds.x - b.x;
            break;
          case "right":
            s.x += bounds.x + bounds.w - (b.x + b.w);
            break;
          case "hcenter":
            s.x += bounds.x + bounds.w / 2 - (b.x + b.w / 2);
            break;
          case "top":
            s.y += bounds.y - b.y;
            break;
          case "bottom":
            s.y += bounds.y + bounds.h - (b.y + b.h);
            break;
          case "vcenter":
            s.y += bounds.y + bounds.h / 2 - (b.y + b.h / 2);
            break;
        }
      }
    });
  }

  distribute(op: DistributeOp): void {
    const shapes = this.selectedShapes().filter((s) => !s.locked);
    if (shapes.length < 3) return;
    this.apply("Distribute", () => {
      if (op === "horizontal") {
        const sorted = [...shapes].sort((a, b) => a.x - b.x);
        const first = sorted[0];
        const last = sorted[sorted.length - 1];
        const totalW = sorted.reduce((acc, s) => acc + s.w, 0);
        const span = last.x + last.w - first.x;
        const gap = (span - totalW) / (sorted.length - 1);
        let x = first.x;
        for (const s of sorted) {
          s.x = x;
          x += s.w + gap;
        }
      } else {
        const sorted = [...shapes].sort((a, b) => a.y - b.y);
        const first = sorted[0];
        const last = sorted[sorted.length - 1];
        const totalH = sorted.reduce((acc, s) => acc + s.h, 0);
        const span = last.y + last.h - first.y;
        const gap = (span - totalH) / (sorted.length - 1);
        let y = first.y;
        for (const s of sorted) {
          s.y = y;
          y += s.h + gap;
        }
      }
    });
  }

  matchSize(op: SizeOp): void {
    const shapes = this.selectedShapes().filter((s) => !s.locked);
    if (shapes.length < 2) return;
    const ref = shapes[0];
    this.apply("Match size", () => {
      for (const s of shapes.slice(1)) {
        if (op === "width" || op === "both") s.w = ref.w;
        if (op === "height" || op === "both") s.h = ref.h;
      }
    });
  }
}

function cleanGroups(doc: FlowDoc): void {
  const ids = new Set([
    ...doc.shapes.map((s) => s.id),
    ...doc.connectors.map((c) => c.id),
  ]);
  doc.groups = doc.groups
    .map((g) => ({ ...g, memberIds: g.memberIds.filter((m) => ids.has(m)) }))
    .filter((g) => g.memberIds.length >= 2);
  const groupIds = new Set(doc.groups.map((g) => g.id));
  for (const s of doc.shapes) if (s.groupId && !groupIds.has(s.groupId)) s.groupId = null;
  for (const c of doc.connectors) if (c.groupId && !groupIds.has(c.groupId)) c.groupId = null;
}
