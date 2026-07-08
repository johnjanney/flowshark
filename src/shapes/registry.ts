import type { FillStyle, Point, ShapeType } from "../model/types";

export interface AnchorDef {
  id: string;
  /** relative position 0..1 within the shape's box */
  rx: number;
  ry: number;
}

export interface ShapeDef {
  type: ShapeType;
  label: string;
  category: "flowchart" | "general" | "container";
  defaultSize: { w: number; h: number };
  /** SVG path data for the outline, in local coordinates (0,0)-(w,h). */
  path: (w: number, h: number, cornerRadius: number) => string;
  /** Extra decoration paths drawn with the same stroke, no fill. */
  decoration?: (w: number, h: number) => string;
  anchors?: AnchorDef[];
  /** inner box available for text, in local coordinates */
  textInset?: (w: number, h: number) => { x: number; y: number; w: number; h: number };
  defaultFill?: FillStyle;
  keywords: string[];
}

const SIDE_ANCHORS: AnchorDef[] = [
  { id: "n", rx: 0.5, ry: 0 },
  { id: "e", rx: 1, ry: 0.5 },
  { id: "s", rx: 0.5, ry: 1 },
  { id: "w", rx: 0, ry: 0.5 },
];

const FULL_ANCHORS: AnchorDef[] = [
  ...SIDE_ANCHORS,
  { id: "nw", rx: 0, ry: 0 },
  { id: "ne", rx: 1, ry: 0 },
  { id: "se", rx: 1, ry: 1 },
  { id: "sw", rx: 0, ry: 1 },
];

function pts(list: Array<[number, number]>): string {
  return (
    "M" + list.map(([x, y]) => `${round(x)},${round(y)}`).join(" L") + " Z"
  );
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

function roundedRect(w: number, h: number, r: number): string {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  if (rr === 0) return pts([[0, 0], [w, 0], [w, h], [0, h]]);
  return (
    `M${rr},0 L${round(w - rr)},0 Q${w},0 ${w},${rr} L${w},${round(h - rr)} ` +
    `Q${w},${h} ${round(w - rr)},${h} L${rr},${h} Q0,${h} 0,${round(h - rr)} ` +
    `L0,${rr} Q0,0 ${rr},0 Z`
  );
}

function ellipsePath(w: number, h: number): string {
  const rx = w / 2;
  const ry = h / 2;
  return (
    `M${rx},0 A${rx},${ry} 0 1 1 ${rx},${h} A${rx},${ry} 0 1 1 ${rx},0 Z`
  );
}

/** Document shape: rectangle with a wavy bottom edge. */
function documentPath(w: number, h: number): string {
  const wave = Math.min(h * 0.15, 14);
  const yb = h - wave;
  return (
    `M0,0 L${w},0 L${w},${round(yb)} ` +
    `C${round(w * 0.75)},${round(h + wave * 0.8)} ${round(w * 0.25)},${round(
      yb - wave * 1.4
    )} 0,${round(h - wave * 0.2)} Z`
  );
}

function cylinderPath(w: number, h: number): string {
  const ry = Math.min(h * 0.18, 16);
  return (
    `M0,${ry} A${w / 2},${ry} 0 0 1 ${w},${ry} ` +
    `L${w},${round(h - ry)} A${w / 2},${ry} 0 0 1 0,${round(h - ry)} Z`
  );
}

function cloudPath(w: number, h: number): string {
  // Four overlapping arcs approximating the classic cloud silhouette.
  const x = (f: number) => round(w * f);
  const y = (f: number) => round(h * f);
  return (
    `M${x(0.22)},${y(0.85)} ` +
    `A${x(0.16)},${y(0.16)} 0 1 1 ${x(0.12)},${y(0.45)} ` +
    `A${x(0.2)},${y(0.22)} 0 1 1 ${x(0.44)},${y(0.2)} ` +
    `A${x(0.22)},${y(0.22)} 0 1 1 ${x(0.83)},${y(0.32)} ` +
    `A${x(0.18)},${y(0.18)} 0 1 1 ${x(0.86)},${y(0.82)} ` +
    `Q${x(0.7)},${y(0.98)} ${x(0.5)},${y(0.92)} ` +
    `Q${x(0.34)},${y(1.0)} ${x(0.22)},${y(0.85)} Z`
  );
}

function starPath(w: number, h: number): string {
  const cx = w / 2;
  const cy = h / 2;
  const points: Array<[number, number]> = [];
  for (let i = 0; i < 10; i++) {
    const rf = i % 2 === 0 ? 0.5 : 0.21;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    points.push([cx + w * rf * Math.cos(a), cy + h * rf * Math.sin(a)]);
  }
  return pts(points);
}

export const SHAPE_DEFS: Record<ShapeType, ShapeDef> = {
  // ---- Flowchart shapes -------------------------------------------------
  process: {
    type: "process",
    label: "Process",
    category: "flowchart",
    defaultSize: { w: 140, h: 70 },
    path: (w, h, r) => roundedRect(w, h, r),
    keywords: ["step", "action", "task", "rectangle"],
  },
  decision: {
    type: "decision",
    label: "Decision",
    category: "flowchart",
    defaultSize: { w: 140, h: 90 },
    path: (w, h) => pts([[w / 2, 0], [w, h / 2], [w / 2, h], [0, h / 2]]),
    textInset: (w, h) => ({ x: w * 0.18, y: h * 0.18, w: w * 0.64, h: h * 0.64 }),
    keywords: ["diamond", "branch", "if", "condition", "choice"],
  },
  terminator: {
    type: "terminator",
    label: "Start / End",
    category: "flowchart",
    defaultSize: { w: 140, h: 56 },
    path: (w, h) => roundedRect(w, h, h / 2),
    keywords: ["start", "end", "terminal", "begin", "stop", "pill"],
  },
  io: {
    type: "io",
    label: "Input / Output",
    category: "flowchart",
    defaultSize: { w: 150, h: 70 },
    path: (w, h) => {
      const skew = Math.min(w * 0.2, 26);
      return pts([[skew, 0], [w, 0], [w - skew, h], [0, h]]);
    },
    textInset: (w, h) => ({ x: w * 0.16, y: 4, w: w * 0.68, h: h - 8 }),
    keywords: ["data", "parallelogram", "input", "output"],
  },
  document: {
    type: "document",
    label: "Document",
    category: "flowchart",
    defaultSize: { w: 140, h: 90 },
    path: documentPath,
    textInset: (w, h) => ({ x: 6, y: 4, w: w - 12, h: h * 0.75 }),
    keywords: ["report", "paper", "file"],
  },
  "multi-document": {
    type: "multi-document",
    label: "Multiple documents",
    category: "flowchart",
    defaultSize: { w: 150, h: 100 },
    path: (w, h) => documentPath(w - 12, h - 12).replace(/^M/, "M"),
    decoration: (w, h) => {
      // two offset backdrop pages behind the front document
      const back = (off: number) =>
        `M${off},${off - 0} L${w - 12 + off},${off} L${w - 12 + off},${off + 6}` +
        ` M${off},${off} L${off},${off + 6}`;
      return `${back(6)} ${back(12)}`;
    },
    textInset: (w, h) => ({ x: 6, y: 8, w: w - 24, h: h * 0.65 }),
    keywords: ["documents", "copies", "reports"],
  },
  "manual-input": {
    type: "manual-input",
    label: "Manual input",
    category: "flowchart",
    defaultSize: { w: 140, h: 70 },
    path: (w, h) => pts([[0, h * 0.28], [w, 0], [w, h], [0, h]]),
    textInset: (w, h) => ({ x: 6, y: h * 0.3, w: w - 12, h: h * 0.66 }),
    keywords: ["keyboard", "user entry"],
  },
  "manual-operation": {
    type: "manual-operation",
    label: "Manual operation",
    category: "flowchart",
    defaultSize: { w: 140, h: 70 },
    path: (w, h) => {
      const inset = Math.min(w * 0.15, 24);
      return pts([[0, 0], [w, 0], [w - inset, h], [inset, h]]);
    },
    keywords: ["trapezoid", "hand"],
  },
  preparation: {
    type: "preparation",
    label: "Preparation",
    category: "flowchart",
    defaultSize: { w: 150, h: 70 },
    path: (w, h) => {
      const c = Math.min(w * 0.18, 28);
      return pts([[c, 0], [w - c, 0], [w, h / 2], [w - c, h], [c, h], [0, h / 2]]);
    },
    keywords: ["hexagon", "setup", "initialize"],
  },
  "predefined-process": {
    type: "predefined-process",
    label: "Predefined process",
    category: "flowchart",
    defaultSize: { w: 150, h: 70 },
    path: (w, h) => pts([[0, 0], [w, 0], [w, h], [0, h]]),
    decoration: (w, h) => `M8,0 L8,${h} M${w - 8},0 L${w - 8},${h}`,
    textInset: (w, h) => ({ x: 12, y: 4, w: w - 24, h: h - 8 }),
    keywords: ["subroutine", "subprocess", "function", "call"],
  },
  database: {
    type: "database",
    label: "Database",
    category: "flowchart",
    defaultSize: { w: 110, h: 90 },
    path: cylinderPath,
    decoration: (w, h) => {
      const ry = Math.min(h * 0.18, 16);
      return `M0,${ry} A${w / 2},${ry} 0 0 0 ${w},${ry}`;
    },
    textInset: (w, h) => {
      const ry = Math.min(h * 0.18, 16);
      return { x: 4, y: ry * 2, w: w - 8, h: h - ry * 2.6 };
    },
    keywords: ["data store", "cylinder", "storage", "db"],
  },
  "internal-storage": {
    type: "internal-storage",
    label: "Internal storage",
    category: "flowchart",
    defaultSize: { w: 130, h: 80 },
    path: (w, h) => pts([[0, 0], [w, 0], [w, h], [0, h]]),
    decoration: (w, h) => `M14,0 L14,${h} M0,14 L${w},14`,
    textInset: (w, h) => ({ x: 18, y: 18, w: w - 22, h: h - 22 }),
    keywords: ["memory", "ram"],
  },
  "direct-access-storage": {
    type: "direct-access-storage",
    label: "Direct access storage",
    category: "flowchart",
    defaultSize: { w: 130, h: 70 },
    path: (w, h) => {
      const rx = Math.min(w * 0.14, 18);
      return (
        `M${rx},0 L${round(w - rx)},0 A${rx},${h / 2} 0 0 1 ${round(
          w - rx
        )},${h} L${rx},${h} A${rx},${h / 2} 0 0 1 ${rx},0 Z`
      );
    },
    decoration: (w, h) => {
      const rx = Math.min(w * 0.14, 18);
      return `M${round(w - rx)},0 A${rx},${h / 2} 0 0 0 ${round(w - rx)},${h}`;
    },
    keywords: ["disk", "drum"],
  },
  "sequential-access-storage": {
    type: "sequential-access-storage",
    label: "Sequential storage",
    category: "flowchart",
    defaultSize: { w: 90, h: 90 },
    path: (w, h) => {
      const r = Math.min(w, h) / 2;
      const cx = w / 2;
      const cy = h / 2;
      return (
        `M${cx + r * 0.35},${h} L${cx},${h} ` +
        `A${r},${r} 0 1 1 ${cx + r * 0.7},${round(cy + r * 0.72)} ` +
        `L${w},${h} Z`
      );
    },
    keywords: ["tape", "magnetic tape", "loop"],
  },
  display: {
    type: "display",
    label: "Display",
    category: "flowchart",
    defaultSize: { w: 140, h: 70 },
    path: (w, h) => {
      const c = Math.min(w * 0.18, 26);
      return (
        `M${c},0 L${round(w - c)},0 Q${w},0 ${w},${h / 2} Q${w},${h} ${round(
          w - c
        )},${h} L${c},${h} L0,${h / 2} Z`
      );
    },
    textInset: (w, h) => ({ x: w * 0.16, y: 4, w: w * 0.68, h: h - 8 }),
    keywords: ["screen", "monitor", "output"],
  },
  delay: {
    type: "delay",
    label: "Delay",
    category: "flowchart",
    defaultSize: { w: 130, h: 64 },
    path: (w, h) =>
      `M0,0 L${round(w - h / 2)},0 A${h / 2},${h / 2} 0 0 1 ${round(
        w - h / 2
      )},${h} L0,${h} Z`,
    keywords: ["wait", "pause", "half"],
  },
  "connector-circle": {
    type: "connector-circle",
    label: "Connector",
    category: "flowchart",
    defaultSize: { w: 48, h: 48 },
    path: ellipsePath,
    keywords: ["circle", "junction", "on-page"],
  },
  "off-page-connector": {
    type: "off-page-connector",
    label: "Off-page connector",
    category: "flowchart",
    defaultSize: { w: 90, h: 80 },
    path: (w, h) => pts([[0, 0], [w, 0], [w, h * 0.6], [w / 2, h], [0, h * 0.6]]),
    textInset: (w, h) => ({ x: 4, y: 4, w: w - 8, h: h * 0.55 }),
    keywords: ["page", "continue", "home plate"],
  },
  merge: {
    type: "merge",
    label: "Merge",
    category: "flowchart",
    defaultSize: { w: 100, h: 70 },
    path: (w, h) => pts([[0, 0], [w, 0], [w / 2, h]]),
    textInset: (w, h) => ({ x: w * 0.25, y: 2, w: w * 0.5, h: h * 0.45 }),
    keywords: ["triangle down", "combine"],
  },
  extract: {
    type: "extract",
    label: "Extract",
    category: "flowchart",
    defaultSize: { w: 100, h: 70 },
    path: (w, h) => pts([[w / 2, 0], [w, h], [0, h]]),
    textInset: (w, h) => ({ x: w * 0.25, y: h * 0.5, w: w * 0.5, h: h * 0.45 }),
    keywords: ["triangle up", "split"],
  },
  sort: {
    type: "sort",
    label: "Sort",
    category: "flowchart",
    defaultSize: { w: 100, h: 90 },
    path: (w, h) => pts([[w / 2, 0], [w, h / 2], [w / 2, h], [0, h / 2]]),
    decoration: (w, h) => `M0,${h / 2} L${w},${h / 2}`,
    textInset: (w, h) => ({ x: w * 0.22, y: h * 0.15, w: w * 0.56, h: h * 0.3 }),
    keywords: ["order", "arrange"],
  },
  collate: {
    type: "collate",
    label: "Collate",
    category: "flowchart",
    defaultSize: { w: 100, h: 80 },
    path: (w, h) =>
      `M0,0 L${w},0 L0,${h} L${w},${h} Z M0,0 L${w},${h} M${w},0 L0,${h}`,
    keywords: ["hourglass", "organize"],
  },
  "stored-data": {
    type: "stored-data",
    label: "Stored data",
    category: "flowchart",
    defaultSize: { w: 130, h: 70 },
    path: (w, h) => {
      const rx = Math.min(w * 0.14, 18);
      return (
        `M${w},0 L${rx},0 A${rx},${h / 2} 0 0 0 ${rx},${h} L${w},${h} ` +
        `A${rx},${h / 2} 0 0 1 ${w},0 Z`
      );
    },
    keywords: ["bow", "data"],
  },
  annotation: {
    type: "annotation",
    label: "Annotation",
    category: "flowchart",
    defaultSize: { w: 150, h: 70 },
    path: (w, h) => `M14,0 L0,0 L0,${h} L14,${h} M0,0 L${w},0 L${w},${h} L0,${h} Z`,
    defaultFill: { color: "#fef9c3", opacity: 1 },
    textInset: (w, h) => ({ x: 10, y: 4, w: w - 16, h: h - 8 }),
    keywords: ["note", "comment", "bracket"],
  },
  callout: {
    type: "callout",
    label: "Callout",
    category: "flowchart",
    defaultSize: { w: 150, h: 80 },
    path: (w, h) => {
      const bh = h * 0.72;
      return (
        `M6,0 L${round(w - 6)},0 Q${w},0 ${w},6 L${w},${round(bh - 6)} ` +
        `Q${w},${round(bh)} ${round(w - 6)},${round(bh)} L${round(w * 0.38)},${round(
          bh
        )} L${round(w * 0.22)},${h} L${round(w * 0.26)},${round(bh)} L6,${round(bh)} ` +
        `Q0,${round(bh)} 0,${round(bh - 6)} L0,6 Q0,0 6,0 Z`
      );
    },
    defaultFill: { color: "#fef9c3", opacity: 1 },
    textInset: (w, h) => ({ x: 6, y: 4, w: w - 12, h: h * 0.62 }),
    keywords: ["speech", "bubble", "remark"],
  },
  swimlane: {
    type: "swimlane",
    label: "Swimlane",
    category: "container",
    defaultSize: { w: 260, h: 480 },
    path: (w, h) => pts([[0, 0], [w, 0], [w, h], [0, h]]),
    decoration: (w, h) => `M0,32 L${w},32`,
    textInset: (w) => ({ x: 4, y: 4, w: w - 8, h: 24 }),
    defaultFill: { color: "#f8fafc", opacity: 1 },
    keywords: ["lane", "container", "cross-functional", "column"],
  },
  phase: {
    type: "phase",
    label: "Phase",
    category: "container",
    defaultSize: { w: 640, h: 160 },
    path: (w, h) => pts([[0, 0], [w, 0], [w, h], [0, h]]),
    decoration: (w, h) => `M32,0 L32,${h}`,
    textInset: (_, h) => ({ x: 4, y: 4, w: 24, h: h - 8 }),
    defaultFill: { color: "#f8fafc", opacity: 1 },
    keywords: ["section", "band", "row", "container"],
  },

  // ---- General shapes ---------------------------------------------------
  rectangle: {
    type: "rectangle",
    label: "Rectangle",
    category: "general",
    defaultSize: { w: 120, h: 80 },
    path: (w, h) => pts([[0, 0], [w, 0], [w, h], [0, h]]),
    keywords: ["box", "square"],
  },
  "rounded-rectangle": {
    type: "rounded-rectangle",
    label: "Rounded rectangle",
    category: "general",
    defaultSize: { w: 120, h: 80 },
    path: (w, h, r) => roundedRect(w, h, r || 10),
    keywords: ["box", "soft"],
  },
  ellipse: {
    type: "ellipse",
    label: "Ellipse",
    category: "general",
    defaultSize: { w: 110, h: 80 },
    path: ellipsePath,
    keywords: ["circle", "oval"],
  },
  triangle: {
    type: "triangle",
    label: "Triangle",
    category: "general",
    defaultSize: { w: 110, h: 90 },
    path: (w, h) => pts([[w / 2, 0], [w, h], [0, h]]),
    textInset: (w, h) => ({ x: w * 0.25, y: h * 0.45, w: w * 0.5, h: h * 0.5 }),
    keywords: ["delta"],
  },
  diamond: {
    type: "diamond",
    label: "Diamond",
    category: "general",
    defaultSize: { w: 110, h: 110 },
    path: (w, h) => pts([[w / 2, 0], [w, h / 2], [w / 2, h], [0, h / 2]]),
    textInset: (w, h) => ({ x: w * 0.2, y: h * 0.2, w: w * 0.6, h: h * 0.6 }),
    keywords: ["rhombus"],
  },
  hexagon: {
    type: "hexagon",
    label: "Hexagon",
    category: "general",
    defaultSize: { w: 130, h: 80 },
    path: (w, h) => {
      const c = Math.min(w * 0.22, 30);
      return pts([[c, 0], [w - c, 0], [w, h / 2], [w - c, h], [c, h], [0, h / 2]]);
    },
    keywords: ["hex", "six"],
  },
  cylinder: {
    type: "cylinder",
    label: "Cylinder",
    category: "general",
    defaultSize: { w: 100, h: 110 },
    path: cylinderPath,
    decoration: (w, h) => {
      const ry = Math.min(h * 0.18, 16);
      return `M0,${ry} A${w / 2},${ry} 0 0 0 ${w},${ry}`;
    },
    keywords: ["tube", "can"],
  },
  cloud: {
    type: "cloud",
    label: "Cloud",
    category: "general",
    defaultSize: { w: 150, h: 100 },
    path: cloudPath,
    textInset: (w, h) => ({ x: w * 0.18, y: h * 0.3, w: w * 0.64, h: h * 0.5 }),
    keywords: ["network", "internet", "sky"],
  },
  star: {
    type: "star",
    label: "Star",
    category: "general",
    defaultSize: { w: 110, h: 110 },
    path: starPath,
    textInset: (w, h) => ({ x: w * 0.3, y: h * 0.35, w: w * 0.4, h: h * 0.3 }),
    keywords: ["favorite", "badge"],
  },
  text: {
    type: "text",
    label: "Text box",
    category: "general",
    defaultSize: { w: 160, h: 40 },
    path: (w, h) => pts([[0, 0], [w, 0], [w, h], [0, h]]),
    keywords: ["label", "caption", "words"],
  },
  "image-placeholder": {
    type: "image-placeholder",
    label: "Image",
    category: "general",
    defaultSize: { w: 120, h: 90 },
    path: (w, h) => pts([[0, 0], [w, 0], [w, h], [0, h]]),
    decoration: (w, h) =>
      `M${w * 0.12},${h * 0.72} L${w * 0.35},${h * 0.4} L${w * 0.55},${h * 0.62} ` +
      `L${w * 0.68},${h * 0.5} L${w * 0.88},${h * 0.72} ` +
      `M${w * 0.68},${h * 0.28} A${w * 0.06},${w * 0.06} 0 1 1 ${w * 0.68},${
        h * 0.28 + 0.01
      }`,
    keywords: ["picture", "photo", "placeholder"],
  },
  "icon-placeholder": {
    type: "icon-placeholder",
    label: "Icon",
    category: "general",
    defaultSize: { w: 64, h: 64 },
    path: (w, h) => roundedRect(w, h, 8),
    decoration: (w, h) =>
      `M${w * 0.3},${h * 0.5} L${w * 0.7},${h * 0.5} M${w * 0.5},${h * 0.3} L${
        w * 0.5
      },${h * 0.7}`,
    keywords: ["symbol", "glyph", "placeholder"],
  },
};

export function getShapeDef(type: ShapeType): ShapeDef {
  const def = SHAPE_DEFS[type];
  if (!def) throw new Error(`Unknown shape type: ${type}`);
  return def;
}

export function shapeAnchors(def: ShapeDef): AnchorDef[] {
  return def.anchors ?? FULL_ANCHORS;
}

/** Anchor position in document coordinates for an unrotated shape box. */
export function anchorPoint(
  s: { x: number; y: number; w: number; h: number },
  a: AnchorDef
): Point {
  return { x: s.x + s.w * a.rx, y: s.y + s.h * a.ry };
}

export const SHAPE_CATEGORIES: Array<{
  id: "flowchart" | "general" | "container";
  label: string;
}> = [
  { id: "flowchart", label: "Flowchart" },
  { id: "general", label: "General" },
  { id: "container", label: "Containers" },
];
