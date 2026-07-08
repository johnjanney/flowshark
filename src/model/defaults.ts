import type {
  CanvasSettings,
  Connector,
  ConnectorEnd,
  ConnectorLabel,
  ConnectorType,
  FillStyle,
  FlowDoc,
  Shape,
  ShapeType,
  StrokeStyle,
  TextStyle,
} from "./types";
import { getShapeDef } from "../shapes/registry";

let counter = 0;

/** Unique, sortable-ish id. Collision-safe within a session and across pastes. */
export function uid(prefix = "el"): string {
  counter = (counter + 1) % 46656;
  return `${prefix}_${Date.now().toString(36)}${counter
    .toString(36)
    .padStart(3, "0")}${Math.floor(Math.random() * 46656)
    .toString(36)
    .padStart(3, "0")}`;
}

export const DEFAULT_FONT = "Segoe UI, system-ui, sans-serif";

export function defaultTextStyle(): TextStyle {
  return {
    fontFamily: DEFAULT_FONT,
    fontSize: 13,
    bold: false,
    italic: false,
    underline: false,
    color: "#1f2937",
    align: "center",
    valign: "middle",
    lineHeight: 1.3,
  };
}

export function defaultFill(): FillStyle {
  return { color: "#ffffff", opacity: 1 };
}

export function defaultStroke(): StrokeStyle {
  return { color: "#4b5563", width: 1.5, style: "solid" };
}

export function defaultCanvas(): CanvasSettings {
  return {
    gridVisible: true,
    gridSize: 20,
    snapToGrid: true,
    snapToElement: true,
    snapTolerance: 6,
    background: "#ffffff",
  };
}

export function newDoc(title = "Untitled flowchart"): FlowDoc {
  const now = new Date().toISOString();
  return {
    app: "flowshark",
    schemaVersion: 1,
    id: uid("doc"),
    title,
    createdAt: now,
    modifiedAt: now,
    canvas: defaultCanvas(),
    shapes: [],
    connectors: [],
    groups: [],
  };
}

export function newShape(
  type: ShapeType,
  x: number,
  y: number,
  zIndex: number,
  overrides: Partial<Shape> = {}
): Shape {
  const def = getShapeDef(type);
  const shape: Shape = {
    id: uid("sh"),
    kind: "shape",
    type,
    x,
    y,
    w: def.defaultSize.w,
    h: def.defaultSize.h,
    rotation: 0,
    fill: def.defaultFill ? { ...def.defaultFill } : defaultFill(),
    stroke: defaultStroke(),
    cornerRadius: type === "rounded-rectangle" || type === "process" ? 6 : 0,
    text: "",
    textStyle: defaultTextStyle(),
    textPadding: 6,
    locked: false,
    hidden: false,
    zIndex,
    groupId: null,
    imageSrc: null,
    ...overrides,
  };
  if (type === "text") {
    shape.fill = { color: "#ffffff", opacity: 0 };
    shape.stroke = { color: "#4b5563", width: 0, style: "solid" };
    shape.textStyle.align = "left";
    shape.textStyle.valign = "top";
  }
  if (type === "annotation" || type === "callout") {
    shape.fill = { color: "#fef9c3", opacity: 1 };
  }
  if (type === "swimlane" || type === "phase") {
    shape.fill = { color: "#f8fafc", opacity: 1 };
    shape.textStyle.valign = type === "swimlane" ? "top" : "middle";
  }
  return shape;
}

export function freeEnd(x: number, y: number): ConnectorEnd {
  return { shapeId: null, anchor: null, x, y };
}

export function attachedEnd(shapeId: string, anchor: string | null = null): ConnectorEnd {
  return { shapeId, anchor, x: 0, y: 0 };
}

export function newConnector(
  type: ConnectorType,
  source: ConnectorEnd,
  target: ConnectorEnd,
  zIndex: number,
  overrides: Partial<Connector> = {}
): Connector {
  return {
    id: uid("cn"),
    kind: "connector",
    type,
    source,
    target,
    points: [],
    stroke: { color: "#4b5563", width: 1.5, style: "solid" },
    opacity: 1,
    startCap: "none",
    endCap: "filled-arrow",
    labels: [],
    locked: false,
    hidden: false,
    zIndex,
    groupId: null,
    ...overrides,
  };
}

export function newLabel(text: string, t = 0.5): ConnectorLabel {
  const style = defaultTextStyle();
  style.fontSize = 12;
  return {
    id: uid("lb"),
    text,
    t,
    offset: 0,
    style,
    background: "#ffffff",
    border: null,
  };
}

export function nextZ(doc: FlowDoc): number {
  let max = 0;
  for (const s of doc.shapes) max = Math.max(max, s.zIndex);
  for (const c of doc.connectors) max = Math.max(max, c.zIndex);
  return max + 1;
}
