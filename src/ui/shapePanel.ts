import type { Editor } from "../core/editor";
import type { Interactions } from "../canvas/interactions";
import type { ShapeType } from "../model/types";
import { SHAPE_CATEGORIES, SHAPE_DEFS, type ShapeDef } from "../shapes/registry";

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

  function render(): void {
    const q = search.value.trim().toLowerCase();
    list.innerHTML = "";

    const matches = (def: ShapeDef) =>
      !q ||
      def.label.toLowerCase().includes(q) ||
      def.keywords.some((k) => k.includes(q));

    const addCategory = (id: string, label: string, defs: ShapeDef[]) => {
      if (defs.length === 0) return;
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
        for (const def of defs) grid.appendChild(shapeButton(def));
        cat.appendChild(grid);
      }
      list.appendChild(cat);
    };

    const recent = getRecentShapes()
      .map((t) => SHAPE_DEFS[t])
      .filter((d) => d && matches(d));
    if (recent.length && !q) addCategory("recent", "Recently used", recent);

    for (const cat of SHAPE_CATEGORIES) {
      const defs = Object.values(SHAPE_DEFS).filter(
        (d) => d.category === cat.id && matches(d)
      );
      addCategory(cat.id, cat.label, defs);
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
