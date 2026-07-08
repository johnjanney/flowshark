import type { Connector, FlowDoc, Shape } from "./types";
import { defaultCanvas, defaultStroke, defaultTextStyle, newDoc } from "./defaults";
import { SHAPE_DEFS } from "../shapes/registry";

export const SCHEMA_VERSION = 1;
export const FILE_EXTENSION = "flowshark";

export class DocumentError extends Error {}

/** Serialize a document to the native .flowshark JSON format. */
export function serializeDoc(doc: FlowDoc): string {
  const out: FlowDoc = {
    ...doc,
    app: "flowshark",
    schemaVersion: SCHEMA_VERSION,
    modifiedAt: new Date().toISOString(),
  };
  return JSON.stringify(out, null, 2);
}

/**
 * Parse and validate a .flowshark document. Unknown fields are dropped,
 * missing optional fields get defaults, structural problems throw
 * DocumentError with a human-readable message.
 */
export function parseDoc(json: string): FlowDoc {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    throw new DocumentError("This file is not valid JSON, so it can't be opened as a FlowShark document.");
  }
  if (typeof raw !== "object" || raw === null) {
    throw new DocumentError("This file does not contain a FlowShark document.");
  }
  const obj = raw as Record<string, unknown>;
  if (obj.app !== "flowshark") {
    throw new DocumentError("This file was not created by FlowShark (missing app marker).");
  }
  const version = typeof obj.schemaVersion === "number" ? obj.schemaVersion : 0;
  if (version > SCHEMA_VERSION) {
    throw new DocumentError(
      `This document uses schema version ${version}, but this build of FlowShark only supports up to ${SCHEMA_VERSION}. Please update FlowShark.`
    );
  }
  const migrated = migrate(obj, version);
  return validate(migrated);
}

/** Migrate older schema versions forward. v1 is the first public schema. */
function migrate(obj: Record<string, unknown>, from: number): Record<string, unknown> {
  let cur = obj;
  let v = from;
  while (v < SCHEMA_VERSION) {
    // Future migrations chain here:
    // if (v === 1) { cur = migrateV1toV2(cur); }
    v++;
  }
  return cur;
}

function num(v: unknown, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}
function str(v: unknown, fallback: string): string {
  return typeof v === "string" ? v : fallback;
}
function bool(v: unknown, fallback: boolean): boolean {
  return typeof v === "boolean" ? v : fallback;
}

function validate(obj: Record<string, unknown>): FlowDoc {
  const base = newDoc();
  const doc: FlowDoc = {
    ...base,
    id: str(obj.id, base.id),
    title: str(obj.title, "Untitled flowchart"),
    createdAt: str(obj.createdAt, base.createdAt),
    modifiedAt: str(obj.modifiedAt, base.modifiedAt),
    canvas: { ...defaultCanvas(), ...(isObj(obj.canvas) ? sanitizeCanvas(obj.canvas) : {}) },
    shapes: [],
    connectors: [],
    groups: [],
  };

  const seen = new Set<string>();
  if (Array.isArray(obj.shapes)) {
    for (const s of obj.shapes) {
      if (!isObj(s)) continue;
      const shape = sanitizeShape(s);
      if (shape && !seen.has(shape.id)) {
        seen.add(shape.id);
        doc.shapes.push(shape);
      }
    }
  }
  const shapeIds = new Set(doc.shapes.map((s) => s.id));
  if (Array.isArray(obj.connectors)) {
    for (const c of obj.connectors) {
      if (!isObj(c)) continue;
      const conn = sanitizeConnector(c, shapeIds);
      if (conn && !seen.has(conn.id)) {
        seen.add(conn.id);
        doc.connectors.push(conn);
      }
    }
  }
  const allIds = new Set([...shapeIds, ...doc.connectors.map((c) => c.id)]);
  if (Array.isArray(obj.groups)) {
    for (const g of obj.groups) {
      if (!isObj(g) || typeof g.id !== "string" || !Array.isArray(g.memberIds)) continue;
      const memberIds = g.memberIds.filter(
        (m: unknown): m is string => typeof m === "string" && allIds.has(m)
      );
      if (memberIds.length >= 2) doc.groups.push({ id: g.id, memberIds });
    }
  }
  // drop dangling groupId references
  const groupIds = new Set(doc.groups.map((g) => g.id));
  for (const s of doc.shapes) if (s.groupId && !groupIds.has(s.groupId)) s.groupId = null;
  for (const c of doc.connectors) if (c.groupId && !groupIds.has(c.groupId)) c.groupId = null;
  return doc;
}

function isObj(v: unknown): v is Record<string, any> {
  return typeof v === "object" && v !== null;
}

function sanitizeCanvas(c: Record<string, any>) {
  const d = defaultCanvas();
  return {
    gridVisible: bool(c.gridVisible, d.gridVisible),
    gridSize: Math.max(2, num(c.gridSize, d.gridSize)),
    snapToGrid: bool(c.snapToGrid, d.snapToGrid),
    snapToElement: bool(c.snapToElement, d.snapToElement),
    snapTolerance: Math.max(1, num(c.snapTolerance, d.snapTolerance)),
    background: str(c.background, d.background),
  };
}

function sanitizeTextStyle(t: unknown) {
  const d = defaultTextStyle();
  if (!isObj(t)) return d;
  return {
    fontFamily: str(t.fontFamily, d.fontFamily),
    fontSize: Math.max(4, num(t.fontSize, d.fontSize)),
    bold: bool(t.bold, d.bold),
    italic: bool(t.italic, d.italic),
    underline: bool(t.underline, d.underline),
    color: str(t.color, d.color),
    align: (["left", "center", "right"] as const).includes(t.align) ? t.align : d.align,
    valign: (["top", "middle", "bottom"] as const).includes(t.valign) ? t.valign : d.valign,
    lineHeight: Math.max(0.5, num(t.lineHeight, d.lineHeight)),
  };
}

function sanitizeStroke(s: unknown) {
  const d = defaultStroke();
  if (!isObj(s)) return d;
  return {
    color: str(s.color, d.color),
    width: Math.max(0, num(s.width, d.width)),
    style: (["solid", "dashed", "dotted"] as const).includes(s.style) ? s.style : d.style,
  };
}

function sanitizeShape(s: Record<string, any>): Shape | null {
  if (typeof s.id !== "string" || typeof s.type !== "string") return null;
  if (!(s.type in SHAPE_DEFS)) return null;
  return {
    id: s.id,
    kind: "shape",
    type: s.type as Shape["type"],
    x: num(s.x, 0),
    y: num(s.y, 0),
    w: Math.max(1, num(s.w, 100)),
    h: Math.max(1, num(s.h, 60)),
    rotation: num(s.rotation, 0),
    fill: isObj(s.fill)
      ? { color: str(s.fill.color, "#ffffff"), opacity: Math.max(0, Math.min(1, num(s.fill.opacity, 1))) }
      : { color: "#ffffff", opacity: 1 },
    stroke: sanitizeStroke(s.stroke),
    cornerRadius: Math.max(0, num(s.cornerRadius, 0)),
    text: str(s.text, ""),
    textStyle: sanitizeTextStyle(s.textStyle),
    textPadding: Math.max(0, num(s.textPadding, 6)),
    locked: bool(s.locked, false),
    hidden: bool(s.hidden, false),
    zIndex: num(s.zIndex, 0),
    groupId: typeof s.groupId === "string" ? s.groupId : null,
    imageSrc: typeof s.imageSrc === "string" && s.imageSrc.startsWith("data:image/") ? s.imageSrc : null,
  };
}

const CAPS = new Set([
  "none", "arrow", "open-arrow", "filled-arrow", "diamond", "filled-diamond",
  "circle", "filled-circle", "square", "filled-square", "bar",
]);
const CONN_TYPES = new Set(["straight", "elbow", "step", "curved", "freeform"]);

function sanitizeEnd(e: unknown, shapeIds: Set<string>) {
  if (!isObj(e)) return { shapeId: null, anchor: null, x: 0, y: 0 };
  const shapeId = typeof e.shapeId === "string" && shapeIds.has(e.shapeId) ? e.shapeId : null;
  return {
    shapeId,
    anchor: shapeId && typeof e.anchor === "string" ? e.anchor : null,
    x: num(e.x, 0),
    y: num(e.y, 0),
  };
}

function sanitizeConnector(c: Record<string, any>, shapeIds: Set<string>): Connector | null {
  if (typeof c.id !== "string") return null;
  return {
    id: c.id,
    kind: "connector",
    type: CONN_TYPES.has(c.type) ? c.type : "straight",
    source: sanitizeEnd(c.source, shapeIds),
    target: sanitizeEnd(c.target, shapeIds),
    points: Array.isArray(c.points)
      ? c.points
          .filter((p: unknown) => isObj(p))
          .map((p: any) => ({ x: num(p.x, 0), y: num(p.y, 0) }))
      : [],
    stroke: sanitizeStroke(c.stroke),
    opacity: Math.max(0, Math.min(1, num(c.opacity, 1))),
    startCap: CAPS.has(c.startCap) ? c.startCap : "none",
    endCap: CAPS.has(c.endCap) ? c.endCap : "filled-arrow",
    labels: Array.isArray(c.labels)
      ? c.labels
          .filter((l: unknown) => isObj(l) && typeof (l as any).id === "string")
          .map((l: any) => ({
            id: l.id,
            text: str(l.text, ""),
            t: Math.max(0, Math.min(1, num(l.t, 0.5))),
            offset: num(l.offset, 0),
            style: sanitizeTextStyle(l.style),
            background: typeof l.background === "string" ? l.background : null,
            border: typeof l.border === "string" ? l.border : null,
          }))
      : [],
    locked: bool(c.locked, false),
    hidden: bool(c.hidden, false),
    zIndex: num(c.zIndex, 0),
    groupId: typeof c.groupId === "string" ? c.groupId : null,
  };
}
