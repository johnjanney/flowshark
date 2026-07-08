import type { Editor } from "../core/editor";
import type { CanvasView } from "../canvas/view";
import type { Point } from "../model/types";
import type { Actions } from "./actions";
import { shortcut } from "../platform/os";

export function buildStatusBar(
  container: HTMLElement,
  editor: Editor,
  view: CanvasView,
  actions: Actions
): { update: () => void; setCursor: (p: Point) => void } {
  container.innerHTML = "";

  const coords = document.createElement("span");
  coords.textContent = "0, 0";
  coords.setAttribute("aria-label", "Cursor position");

  const selInfo = document.createElement("span");

  const hint = document.createElement("span");
  hint.className = "grow";
  hint.style.textAlign = "center";
  hint.textContent =
    "Drag shapes from the left panel · Hover a shape and drag from a blue dot to connect · Double-click to edit text";

  const dirtyFlag = document.createElement("span");

  const zoomOut = document.createElement("button");
  zoomOut.className = "tb-btn";
  zoomOut.textContent = "−";
  zoomOut.title = `Zoom out (${shortcut("Mod+-")})`;
  zoomOut.setAttribute("aria-label", "Zoom out");
  zoomOut.addEventListener("click", () => actions.zoomOut());

  const zoomPct = document.createElement("button");
  zoomPct.className = "tb-btn";
  zoomPct.title = "Reset zoom to 100%";
  zoomPct.setAttribute("aria-label", "Zoom level, click to reset");
  zoomPct.addEventListener("click", () => actions.zoomReset());

  const zoomIn = document.createElement("button");
  zoomIn.className = "tb-btn";
  zoomIn.textContent = "+";
  zoomIn.title = `Zoom in (${shortcut("Mod++")})`;
  zoomIn.setAttribute("aria-label", "Zoom in");
  zoomIn.addEventListener("click", () => actions.zoomIn());

  const fit = document.createElement("button");
  fit.className = "tb-btn";
  fit.textContent = "Fit";
  fit.title = `Fit diagram to screen (${shortcut("Mod+0")})`;
  fit.addEventListener("click", () => actions.fitToContent());

  container.append(coords, selInfo, hint, dirtyFlag, zoomOut, zoomPct, zoomIn, fit);

  function update(): void {
    const n = editor.selection.size;
    const shapes = editor.doc.shapes.length;
    const conns = editor.doc.connectors.length;
    selInfo.textContent = n > 0 ? `${n} selected` : `${shapes} shapes, ${conns} connectors`;
    zoomPct.textContent = `${Math.round(editor.viewport.zoom * 100)}%`;
    dirtyFlag.textContent = editor.dirty ? "● Unsaved changes" : "";
  }

  function setCursor(p: Point): void {
    coords.textContent = `${Math.round(p.x)}, ${Math.round(p.y)}`;
  }

  update();
  return { update, setCursor };
}
