import type { Editor } from "../core/editor";
import type { Interactions } from "../canvas/interactions";
import type { ConnectorType, ShapeType } from "../model/types";
import { SHAPE_CATEGORIES, SHAPE_DEFS, type ShapeDef } from "../shapes/registry";
import { CONNECTOR_TYPES } from "../connectors/routing";

const RECENT_KEY = "flowshark.recentShapes";

function getRecentShapes(): ShapeType[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list.filter((t) => t in SHAPE_DEFS).slice(0, 6) : [];
  } catch {
    return [];
  }
}

function pushRecentShape(type: ShapeType): void {
  const list = [type, ...getRecentShapes().filter((t) => t !== type)].slice(0, 6);
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(list));
  } catch {
    // ignore
  }
}

/** Small preview icon of a shape, drawn with its real path generator. */
function shapeThumb(def: ShapeDef, size = 40): string {
  const ratio = def.defaultSize.w / def.defaultSize.h;
  let w = size;
  let h = size;
  if (ratio > 1) h = size / ratio;
  else w = size * ratio;
  const d = def.path(w, h, def.type === "process" || def.type === "rounded-rectangle" ? 4 : 0);
  const deco = def.decoration ? def.decoration(w, h) : "";
  return (
    `<svg width="${size}" height="${Math.max(24, size * 0.7)}" viewBox="${-2} ${-2} ${w + 4} ${h + 4}" aria-hidden="true">` +
    `<path d="${d}" fill="none" class="sp-stroke" stroke-width="1.3" stroke-linejoin="round"/>` +
    (deco ? `<path d="${deco}" fill="none" class="sp-stroke" stroke-width="1.1"/>` : "") +
    `</svg>`
  );
}

/** Small preview icon of a connector type. */
function connectorThumb(type: ConnectorType, size = 40): string {
  const w = size;
  const h = size * 0.7;
  let d: string;
  switch (type) {
    case "elbow":
      d = `M4,${h - 4} L${w / 2},${h - 4} L${w / 2},4 L${w - 8},4`;
      break;
    case "step":
      d = `M4,4 L${w * 0.55},4 L${w * 0.55},${h - 4} L${w - 8},${h - 4}`;
      break;
    case "curved":
      d = `M4,${h - 4} Q4,4 ${w / 2},4 T${w - 8},${h - 6}`;
      break;
    case "freeform":
      d = `M4,${h - 4} L${w * 0.35},6 L${w * 0.6},${h - 6} L${w - 8},4`;
      break;
    case "straight":
    default:
      d = `M4,${h - 4} L${w - 8},4`;
  }
  const tip = type === "step" ? { x: w - 8, y: h - 4 } : { x: w - 8, y: 4 };
  return (
    `<svg width="${size}" height="${Math.max(24, h)}" viewBox="-2 -2 ${w + 4} ${h + 4}" aria-hidden="true">` +
    `<path d="${d}" fill="none" class="sp-stroke" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>` +
    `<path d="M${tip.x - 6},${tip.y - 3} L${tip.x},${tip.y} L${tip.x - 6},${tip.y + 3}" fill="none" class="sp-stroke" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>` +
    `</svg>`
  );
}

export function buildShapePanel(
  container: HTMLElement,
  editor: Editor,
  interactions: Interactions
): { update: () => void } {
  container.innerHTML = "";

  const search = document.createElement("input");
  search.id = "shape-search";
  search.type = "search";
  search.placeholder = "Search shapes…";
  search.setAttribute("aria-label", "Search shapes");

  const list = document.createElement("div");
  list.id = "shape-list";

  container.append(search, list);

  const collapsed = new Set<string>();

  function shapeButton(def: ShapeDef): HTMLElement {
    const b = document.createElement("button");
    b.className = "shape-item";
    b.draggable = true;
    b.title = `${def.label} — drag onto canvas or click to arm placement`;
    b.setAttribute("aria-label", `Add ${def.label} shape`);
    b.innerHTML = shapeThumb(def) + `<span>${def.label}</span>`;
    b.addEventListener("dragstart", (e) => {
      e.dataTransfer?.setData("application/x-flowshark-shape", def.type);
      pushRecentShape(def.type);
    });
    b.addEventListener("click", () => {
      interactions.armShape(def.type);
      pushRecentShape(def.type);
      render();
    });
    return b;
  }

  function connectorButton(type: ConnectorType, label: string): HTMLElement {
    const b = document.createElement("button");
    b.className = "shape-item";
    b.title = `${label} connector — click, then drag between shapes on the canvas`;
    b.setAttribute("aria-label", `Use ${label} connector`);
    b.innerHTML = connectorThumb(type) + `<span>${label}</span>`;
    b.addEventListener("click", () => {
      interactions.connectorType = type;
      interactions.setTool("connector");
    });
    return b;
  }

  function render(): void {
    const q = search.value.trim().toLowerCase();
    list.innerHTML = "";

    const matches = (def: ShapeDef) =>
      !q ||
      def.label.toLowerCase().includes(q) ||
      def.keywords.some((k) => k.includes(q));

    const addCategory = (id: string, label: string, items: HTMLElement[]) => {
      if (items.length === 0) return;
      const cat = document.createElement("div");
      cat.className = "shape-cat";
      const head = document.createElement("button");
      head.className = "shape-cat-head";
      const isCollapsed = collapsed.has(id) && !q;
      head.innerHTML = `${isCollapsed ? "▸" : "▾"} ${label}`;
      head.setAttribute("aria-expanded", String(!isCollapsed));
      head.addEventListener("click", () => {
        if (collapsed.has(id)) collapsed.delete(id);
        else collapsed.add(id);
        render();
      });
      cat.appendChild(head);
      if (!isCollapsed) {
        const grid = document.createElement("div");
        grid.className = "shape-grid";
        for (const item of items) grid.appendChild(item);
        cat.appendChild(grid);
      }
      list.appendChild(cat);
    };

    const recent = getRecentShapes()
      .map((t) => SHAPE_DEFS[t])
      .filter((d) => d && matches(d));
    if (recent.length && !q) addCategory("recent", "Recently used", recent.map(shapeButton));

    for (const cat of SHAPE_CATEGORIES) {
      const defs = Object.values(SHAPE_DEFS).filter(
        (d) => d.category === cat.id && matches(d)
      );
      addCategory(cat.id, cat.label, defs.map(shapeButton));

      // Connector category sits right after General, matching the brief's
      // left-panel layout (Flowchart, General, Connector).
      if (cat.id === "general") {
        const connectorMatches = CONNECTOR_TYPES.filter(
          (c) => !q || c.label.toLowerCase().includes(q) || "connector".includes(q)
        );
        addCategory(
          "connectors",
          "Connectors",
          connectorMatches.map((c) => connectorButton(c.id, c.label))
        );
      }
    }

    if (!list.children.length) {
      const empty = document.createElement("div");
      empty.className = "insp-empty";
      empty.textContent = "No shapes match your search.";
      list.appendChild(empty);
    }
  }

  search.addEventListener("input", render);
  render();
  return { update: () => {} };
}
