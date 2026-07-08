import type { Editor } from "../core/editor";
import type { Interactions } from "../canvas/interactions";
import type { Actions } from "./actions";

/** Global keyboard shortcuts (brief §8.12 plus common extras). */
export function installShortcuts(
  editor: Editor,
  interactions: Interactions,
  actions: Actions
): void {
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
