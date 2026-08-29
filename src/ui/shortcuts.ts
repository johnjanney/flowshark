import type { Editor } from "../core/editor";
import type { Interactions } from "../canvas/interactions";
import type { Actions } from "./actions";
import type { Element } from "../model/types";
import { getShapeDef } from "../shapes/registry";

/** Short spoken description of an element, for the canvas live region. */
export function describeElement(el: Element, index: number, total: number): string {
  const position = `${index + 1} of ${total}`;
  if (el.kind === "shape") {
    const name = getShapeDef(el.type).label;
    const text = el.text.trim();
    return `${name}${text ? `, "${text.slice(0, 80)}"` : ", no text"}. ${position}.`;
  }
  const labels = el.labels
    .map((l) => l.text.trim())
    .filter(Boolean)
    .join(", ");
  return `${el.type} connector${labels ? `, labelled "${labels.slice(0, 80)}"` : ""}. ${position}.`;
}

/** Global keyboard shortcuts (brief §8.12 plus common extras). */
export function installShortcuts(
  editor: Editor,
  interactions: Interactions,
  actions: Actions
): void {
  const view = actions.view;

  /**
   * Keyboard traversal of the diagram itself. The canvas is a single focus
   * stop, so without this a keyboard-only user can reach the toolbar and
   * panels but never an individual shape or connector. Tab/Shift+Tab move
   * through elements in painting order while the canvas has focus, and each
   * move is announced through the canvas live region.
   */
  function traverse(delta: 1 | -1): void {
    const target = editor.selectAdjacent(delta);
    if (!target) {
      view.announce("The diagram is empty.");
      return;
    }
    const order = editor.documentOrder();
    view.announce(
      describeElement(target, order.findIndex((e) => e.id === target.id), order.length)
    );
    const b = editor.selectionBounds();
    if (b) {
      // keep the newly selected object on screen without changing zoom
      const visible = view.visibleDocRect();
      const offscreen =
        b.x + b.w < visible.x ||
        b.x > visible.x + visible.w ||
        b.y + b.h < visible.y ||
        b.y > visible.y + visible.h;
      if (offscreen) {
        editor.viewport.x = b.x + b.w / 2 - visible.w / 2;
        editor.viewport.y = b.y + b.h / 2 - visible.h / 2;
      }
    }
    view.refresh();
  }

  window.addEventListener("keydown", (e) => {
    const target = e.target as HTMLElement;
    const typing =
      target.tagName === "INPUT" ||
      target.tagName === "TEXTAREA" ||
      target.tagName === "SELECT" ||
      target.isContentEditable;

    const ctrl = e.ctrlKey || e.metaKey;
    const key = e.key.toLowerCase();

    // shortcuts that apply even while typing
    if (typing) {
      return; // native editing behavior wins inside inputs
    }

    const canvasFocused = document.activeElement === view.svg;
    if (canvasFocused && !ctrl && !e.altKey) {
      if (e.key === "Tab") {
        e.preventDefault();
        traverse(e.shiftKey ? -1 : 1);
        return;
      }
      if (e.key === "Enter") {
        const s = editor.selectedShapes()[0];
        if (s && !s.locked) {
          e.preventDefault();
          interactions.startTextEdit(s.id);
          return;
        }
      }
    }

    if (ctrl) {
      switch (key) {
        case "n":
          e.preventDefault();
          actions.newFile();
          return;
        case "o":
          e.preventDefault();
          actions.open();
          return;
        case "s":
          e.preventDefault();
          if (e.shiftKey) actions.saveAs();
          else actions.save();
          return;
        case "e":
          e.preventDefault();
          actions.showExportDialog();
          return;
        case "z":
          e.preventDefault();
          if (e.shiftKey) editor.redo();
          else editor.undo();
          actions.view.refresh();
          return;
        case "y":
          e.preventDefault();
          editor.redo();
          actions.view.refresh();
          return;
        case "c":
          e.preventDefault();
          if (e.shiftKey) editor.copyStyle();
          else editor.copy();
          return;
        case "x":
          e.preventDefault();
          editor.cut();
          actions.view.refresh();
          return;
        case "v":
          e.preventDefault();
          if (e.shiftKey) editor.pasteStyle();
          else editor.paste();
          actions.view.refresh();
          return;
        case "d":
          e.preventDefault();
          editor.duplicate();
          actions.view.refresh();
          return;
        case "a":
          e.preventDefault();
          editor.selectAll();
          actions.view.refreshOverlay();
          return;
        case "g":
          e.preventDefault();
          if (e.shiftKey) editor.ungroup();
          else editor.group();
          actions.view.refresh();
          return;
        case "=":
        case "+":
          e.preventDefault();
          actions.zoomIn();
          return;
        case "-":
          e.preventDefault();
          actions.zoomOut();
          return;
        case "0":
          e.preventDefault();
          actions.fitToContent();
          return;
        case "1":
          e.preventDefault();
          actions.zoomReset();
          return;
        case "2":
          e.preventDefault();
          actions.fitSelection();
          return;
        case "'":
          e.preventDefault();
          actions.toggleGrid();
          return;
        case "]":
          e.preventDefault();
          editor.order(e.shiftKey ? "front" : "forward");
          actions.view.refresh();
          return;
        case "[":
          e.preventDefault();
          editor.order(e.shiftKey ? "back" : "backward");
          actions.view.refresh();
          return;
      }
      return;
    }

    switch (e.key) {
      case "Delete":
      case "Backspace":
        e.preventDefault();
        editor.deleteSelection();
        actions.view.refresh();
        return;
      case "Escape":
        editor.deselect();
        interactions.setTool("select");
        actions.view.refreshOverlay();
        return;
      case "ArrowLeft":
      case "ArrowRight":
      case "ArrowUp":
      case "ArrowDown": {
        if (editor.selection.size === 0) return;
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
        const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
        editor.nudge(dx, dy);
        actions.view.refresh();
        return;
      }
      case "v":
      case "V":
        interactions.setTool("select");
        return;
      case "h":
      case "H":
        interactions.setTool("pan");
        return;
      case "t":
      case "T":
        interactions.setTool("text");
        return;
      case "c":
      case "C":
        interactions.setTool("connector");
        return;
      case "F2": {
        const s = editor.selectedShapes()[0];
        if (s) {
          e.preventDefault();
          interactions.startTextEdit(s.id);
        }
        return;
      }
    }
  });
}
