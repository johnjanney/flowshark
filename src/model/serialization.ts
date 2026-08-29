import type { Connector, FlowDoc, Shape } from "./types";
import { defaultCanvas, defaultStroke, defaultTextStyle, newDoc } from "./defaults";
import { SHAPE_DEFS } from "../shapes/registry";
import { isSafeId, isSafeImageDataUrl, safeColor } from "../core/safety";
import {
  LIMITS,
  clampCoord,
  clampDimension,
  clampFontSize,
  clampGridSize,
  clampLineHeight,
  clampNonNegative,
  clampRotation,
  clampSigned,
  clampSnapTolerance,
  clampStrokeWidth,
  clampText,
  clampZIndex,
} from "./limits";

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
  if (json.length > LIMITS.maxDocumentChars) {
    throw new DocumentError(
      `This file is ${Math.round(json.length / 1_048_576)} MB, which is larger than the ` +
        `${Math.round(LIMITS.maxDocumentChars / 1_048_576)} MB limit FlowShark will open. ` +
        `It may be corrupt or not a FlowShark document.`
    );
  }
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
    id: isSafeId(obj.id) ? obj.id : base.id,
    title: clampText(str(obj.title, "Untitled flowchart"), LIMITS.maxTitleLength),
    createdAt: str(obj.createdAt, base.createdAt),
    modifiedAt: str(obj.modifiedAt, base.modifiedAt),
    canvas: { ...defaultCanvas(), ...(isObj(obj.canvas) ? sanitizeCanvas(obj.canvas) : {}) },
    shapes: [],
    connectors: [],
    groups: [],
  };

  // `seen` enforces one global id namespace across shapes, connectors and
  // groups: duplicate ids make selection, grouping and connector attachment
  // ambiguous, so the second claimant is dropped rather than silently
  // shadowing the first.
  const seen = new Set<string>();
  if (Array.isArray(obj.shapes)) {
    for (const s of obj.shapes.slice(0, LIMITS.maxShapes)) {
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
    for (const c of obj.connectors.slice(0, LIMITS.maxConnectors)) {
      if (!isObj(c)) continue;
      const conn = sanitizeConnector(c, shapeIds);
      if (conn && !seen.has(conn.id)) {
        seen.add(conn.id);
        doc.connectors.push(conn);
      }
    }
  }
  const allIds = new Set([...shapeIds, ...doc.connectors.map((c) => c.id)]);
  // Every element belongs to at most one group. A file that lists the same
  // element in two groups would make ungroup/expand-to-group depend on array
  // order, so the first group to claim a member wins and later claims are
  // dropped.
  const claimed = new Set<string>();
  if (Array.isArray(obj.groups)) {
    for (const g of obj.groups.slice(0, LIMITS.maxGroups)) {
      if (!isObj(g) || !isSafeId(g.id) || seen.has(g.id) || !Array.isArray(g.memberIds)) continue;
      const memberIds: string[] = [];
      const inThisGroup = new Set<string>();
      for (const m of g.memberIds.slice(0, LIMITS.maxGroupMembers)) {
        if (typeof m !== "string") continue;
        if (!allIds.has(m) || claimed.has(m) || inThisGroup.has(m)) continue;
        inThisGroup.add(m);
        memberIds.push(m);
      }
      if (memberIds.length >= 2) {
        seen.add(g.id);
        for (const m of memberIds) claimed.add(m);
        doc.groups.push({ id: g.id, memberIds });
      }
    }
  }
  // Rebuild groupId from the authoritative membership lists, so an element's
  // own groupId can never disagree with the group that actually contains it.
  const owner = new Map<string, string>();
  for (const g of doc.groups) for (const m of g.memberIds) owner.set(m, g.id);
  for (const s of doc.shapes) s.groupId = owner.get(s.id) ?? null;
  for (const c of doc.connectors) c.groupId = owner.get(c.id) ?? null;
  return doc;
}

/** Keep the first entry for each id; later duplicates are dropped. */
function dedupeById<T extends { id: string }>(items: T[]): T[] {
  const seenIds = new Set<string>();
  const out: T[] = [];
  for (const item of items) {
    if (seenIds.has(item.id)) continue;
    seenIds.add(item.id);
    out.push(item);
  }
  return out;
}

function isObj(v: unknown): v is Record<string, any> {
  return typeof v === "object" && v !== null;
}

function sanitizeCanvas(c: Record<string, any>) {
  const d = defaultCanvas();
  return {
    gridVisible: bool(c.gridVisible, d.gridVisible),
    gridSize: clampGridSize(num(c.gridSize, d.gridSize)),
    snapToGrid: bool(c.snapToGrid, d.snapToGrid),
    snapToElement: bool(c.snapToElement, d.snapToElement),
    snapTolerance: clampSnapTolerance(num(c.snapTolerance, d.snapTolerance)),
    background: safeColor(c.background, d.background),
  };
}

function sanitizeTextStyle(t: unknown) {
  const d = defaultTextStyle();
  if (!isObj(t)) return d;
  return {
    fontFamily: clampText(str(t.fontFamily, d.fontFamily), LIMITS.maxFontFamilyLength),
    fontSize: clampFontSize(num(t.fontSize, d.fontSize)),
    bold: bool(t.bold, d.bold),
    italic: bool(t.italic, d.italic),
    underline: bool(t.underline, d.underline),
    color: safeColor(t.color, d.color),
    align: (["left", "center", "right"] as const).includes(t.align) ? t.align : d.align,
    valign: (["top", "middle", "bottom"] as const).includes(t.valign) ? t.valign : d.valign,
    lineHeight: clampLineHeight(num(t.lineHeight, d.lineHeight)),
  };
}

function sanitizeStroke(s: unknown) {
  const d = defaultStroke();
  if (!isObj(s)) return d;
  return {
    color: safeColor(s.color, d.color),
    width: clampStrokeWidth(num(s.width, d.width)),
    style: (["solid", "dashed", "dotted"] as const).includes(s.style) ? s.style : d.style,
  };
}

/** data: URLs pointing at a sanitization-safe raster image, or null. */
function sanitizeImageSrc(v: unknown): string | null {
  return isSafeImageDataUrl(v) ? v : null;
}

function sanitizeShape(s: Record<string, any>): Shape | null {
  if (!isSafeId(s.id) || typeof s.type !== "string") return null;
  if (!(s.type in SHAPE_DEFS)) return null;
  return {
    id: s.id,
    kind: "shape",
    type: s.type as Shape["type"],
    x: clampCoord(num(s.x, 0)),
    y: clampCoord(num(s.y, 0)),
    w: clampDimension(num(s.w, 100)),
    h: clampDimension(num(s.h, 60)),
    rotation: clampRotation(num(s.rotation, 0)),
    fill: isObj(s.fill)
      ? { color: safeColor(s.fill.color, "#ffffff"), opacity: Math.max(0, Math.min(1, num(s.fill.opacity, 1))) }
      : { color: "#ffffff", opacity: 1 },
    stroke: sanitizeStroke(s.stroke),
    cornerRadius: clampNonNegative(num(s.cornerRadius, 0), LIMITS.maxCornerRadius),
    text: clampText(str(s.text, ""), LIMITS.maxTextLength),
    textStyle: sanitizeTextStyle(s.textStyle),
    textPadding: clampNonNegative(num(s.textPadding, 6), LIMITS.maxTextPadding),
    locked: bool(s.locked, false),
    hidden: bool(s.hidden, false),
    zIndex: clampZIndex(num(s.zIndex, 0)),
    groupId: isSafeId(s.groupId) ? s.groupId : null,
    imageSrc: sanitizeImageSrc(s.imageSrc),
  };
}

const CAPS = new Set([
  "none", "arrow", "open-arrow", "filled-arrow", "diamond", "filled-diamond",
  "circle", "filled-circle", "square", "filled-square", "bar",
]);
const CONN_TYPES = new Set(["straight", "elbow", "step", "curved", "freeform"]);
/**
 * The connection-point names every shape definition exposes. An endpoint
 * naming anything else is treated as floating (the router already falls back
 * to the nearest anchor), so a malformed file can't leave a connector bound
 * to a phantom anchor that silently changes behavior between builds.
 */
const ANCHOR_IDS = new Set(["n", "s", "e", "w", "ne", "nw", "se", "sw"]);

function sanitizeEnd(e: unknown, shapeIds: Set<string>) {
  if (!isObj(e)) return { shapeId: null, anchor: null, x: 0, y: 0 };
  const shapeId = typeof e.shapeId === "string" && shapeIds.has(e.shapeId) ? e.shapeId : null;
  return {
    shapeId,
    anchor: shapeId && ANCHOR_IDS.has(e.anchor) ? (e.anchor as string) : null,
    x: clampCoord(num(e.x, 0)),
    y: clampCoord(num(e.y, 0)),
  };
}

function sanitizeConnector(c: Record<string, any>, shapeIds: Set<string>): Connector | null {
  if (!isSafeId(c.id)) return null;
  return {
    id: c.id,
    kind: "connector",
    type: CONN_TYPES.has(c.type) ? c.type : "straight",
    source: sanitizeEnd(c.source, shapeIds),
    target: sanitizeEnd(c.target, shapeIds),
    points: Array.isArray(c.points)
      ? c.points
          .slice(0, LIMITS.maxPointsPerConnector)
          .filter((p: unknown) => isObj(p))
          .map((p: any) => ({ x: clampCoord(num(p.x, 0)), y: clampCoord(num(p.y, 0)) }))
      : [],
    stroke: sanitizeStroke(c.stroke),
    opacity: Math.max(0, Math.min(1, num(c.opacity, 1))),
    startCap: CAPS.has(c.startCap) ? c.startCap : "none",
    endCap: CAPS.has(c.endCap) ? c.endCap : "filled-arrow",
    labels: Array.isArray(c.labels)
      ? dedupeById(
          c.labels
            .slice(0, LIMITS.maxLabelsPerConnector)
            .filter((l: unknown) => isObj(l) && isSafeId((l as any).id))
            .map((l: any) => ({
              id: l.id as string,
              text: clampText(str(l.text, ""), LIMITS.maxTextLength),
              t: Math.max(0, Math.min(1, num(l.t, 0.5))),
              offset: clampSigned(num(l.offset, 0), LIMITS.maxLabelOffset),
              style: sanitizeTextStyle(l.style),
              background: typeof l.background === "string" ? safeColor(l.background, "#ffffff") : null,
              border: typeof l.border === "string" ? safeColor(l.border, "#000000") : null,
            }))
        )
      : [],
    locked: bool(c.locked, false),
    hidden: bool(c.hidden, false),
    zIndex: clampZIndex(num(c.zIndex, 0)),
    groupId: isSafeId(c.groupId) ? c.groupId : null,
  };
}
