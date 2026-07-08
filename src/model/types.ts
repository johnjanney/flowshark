/**
 * FlowShark document model.
 *
 * Everything in a document is plain JSON-serializable data. The schema is
 * versioned (see SCHEMA_VERSION in serialization.ts) and migrated on load.
 */

export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type HAlign = "left" | "center" | "right";
export type VAlign = "top" | "middle" | "bottom";
export type LineStyle = "solid" | "dashed" | "dotted";

export interface TextStyle {
  fontFamily: string;
  fontSize: number;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  color: string;
  align: HAlign;
  valign: VAlign;
  lineHeight: number; // multiplier
}

export interface FillStyle {
  color: string;
  opacity: number; // 0..1
}

export interface StrokeStyle {
  color: string;
  width: number;
  style: LineStyle;
}

/** All shape types known to the shape registry. */
export type ShapeType =
  // Flowchart shapes
  | "process"
  | "decision"
  | "terminator"
  | "io"
  | "document"
  | "multi-document"
  | "manual-input"
  | "manual-operation"
  | "preparation"
  | "predefined-process"
  | "database"
  | "internal-storage"
  | "direct-access-storage"
  | "sequential-access-storage"
  | "display"
  | "delay"
  | "connector-circle"
  | "off-page-connector"
  | "merge"
  | "extract"
  | "sort"
  | "collate"
  | "stored-data"
  | "annotation"
  | "callout"
  | "swimlane"
  | "phase"
  // General shapes
  | "rectangle"
  | "rounded-rectangle"
  | "ellipse"
  | "triangle"
  | "diamond"
  | "hexagon"
  | "cylinder"
  | "cloud"
  | "star"
  | "line"
  | "arrow"
  | "text"
  | "image-placeholder"
  | "icon-placeholder";

export interface Shape {
  id: string;
  kind: "shape";
  type: ShapeType;
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number; // degrees, clockwise
  fill: FillStyle;
  stroke: StrokeStyle;
  cornerRadius: number;
  text: string;
  textStyle: TextStyle;
  textPadding: number;
  locked: boolean;
  hidden: boolean;
  zIndex: number;
  groupId: string | null;
  /** data URL for image-placeholder shapes with an imported image */
  imageSrc?: string | null;
}

export type ConnectorType =
  | "straight"
  | "elbow"
  | "step"
  | "curved"
  | "freeform";

export type CapStyle =
  | "none"
  | "arrow"
  | "open-arrow"
  | "filled-arrow"
  | "diamond"
  | "filled-diamond"
  | "circle"
  | "filled-circle"
  | "square"
  | "filled-square"
  | "bar";

/**
 * A connector endpoint. When `shapeId` is set the endpoint is attached:
 * - anchor set    -> fixed to that named connection point
 * - anchor null   -> floating; nearest anchor is chosen dynamically
 * When `shapeId` is null the endpoint is free at (x, y).
 */
export interface ConnectorEnd {
  shapeId: string | null;
  anchor: string | null;
  x: number;
  y: number;
}

export interface ConnectorLabel {
  id: string;
  text: string;
  /** position along the connector path, 0..1 */
  t: number;
  /** perpendicular offset from the line, px */
  offset: number;
  style: TextStyle;
  background: string | null;
  border: string | null;
}

export interface Connector {
  id: string;
  kind: "connector";
  type: ConnectorType;
  source: ConnectorEnd;
  target: ConnectorEnd;
  /** manual bend/way points in document coordinates */
  points: Point[];
  stroke: StrokeStyle;
  opacity: number;
  startCap: CapStyle;
  endCap: CapStyle;
  labels: ConnectorLabel[];
  locked: boolean;
  hidden: boolean;
  zIndex: number;
  groupId: string | null;
}

export type Element = Shape | Connector;

export interface Group {
  id: string;
  memberIds: string[];
}

export interface CanvasSettings {
  gridVisible: boolean;
  gridSize: number;
  snapToGrid: boolean;
  snapToElement: boolean;
  snapTolerance: number;
  background: string;
}

export interface FlowDoc {
  app: "flowshark";
  schemaVersion: number;
  id: string;
  title: string;
  createdAt: string;
  modifiedAt: string;
  canvas: CanvasSettings;
  shapes: Shape[];
  connectors: Connector[];
  groups: Group[];
}
