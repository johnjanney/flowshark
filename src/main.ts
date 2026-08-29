import "./style.css";
import { Editor } from "./core/editor";
import { CanvasView } from "./canvas/view";
import { Interactions } from "./canvas/interactions";
import { Actions } from "./ui/actions";
import { buildToolbar } from "./ui/toolbar";
import { buildShapePanel } from "./ui/shapePanel";
import { buildInspector } from "./ui/inspector";
import { buildStatusBar } from "./ui/statusbar";
import { installShortcuts } from "./ui/shortcuts";
import { checkRecovery, clearAutosave, startAutosave } from "./ui/autosave";
import { newShape, nextZ } from "./model/defaults";
import { isSafeImageDataUrl } from "./core/safety";
import { toast } from "./ui/dialogs";

const THEME_KEY = "flowshark.theme";

function applyTheme(theme: "light" | "dark"): void {
  document.documentElement.setAttribute("data-theme", theme);
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    // ignore
  }
}

function initTheme(): void {
  let theme: "light" | "dark" = "light";
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === "dark" || saved === "light") theme = saved;
    else if (window.matchMedia?.("(prefers-color-scheme: dark)").matches) theme = "dark";
  } catch {
    // ignore
  }
  applyTheme(theme);
}

function toggleTheme(): void {
  const cur = document.documentElement.getAttribute("data-theme");
  applyTheme(cur === "dark" ? "light" : "dark");
}

function main(): void {
  initTheme();

  const editor = new Editor();
  const host = document.getElementById("canvas-host")!;
  const view = new CanvasView(editor, host);
  const interactions = new Interactions(editor, view);
  const actions = new Actions(editor, view, interactions);

  const toolbar = buildToolbar(
    document.getElementById("toolbar")!,
    editor,
    interactions,
    actions,
    toggleTheme
  );
  buildShapePanel(document.getElementById("shape-panel")!, editor, interactions);
  const inspector = buildInspector(document.getElementById("inspector")!, editor, view);
  const statusbar = buildStatusBar(
    document.getElementById("statusbar")!,
    editor,
    view,
    actions
  );

  interactions.onCursorMove = (p) => statusbar.setCursor(p);
  interactions.onToolChange = () => toolbar.update();

  editor.onChange(() => {
    toolbar.update();
    inspector.update();
    statusbar.update();
    view.refreshOverlay();
  });

  installShortcuts(editor, interactions, actions);
  startAutosave(editor, () => {
    toast(
      "Autosave couldn't keep up (this diagram may be too large to recover automatically). Save your work manually to be safe.",
      true
    );
  });

  // paste image from system clipboard
  window.addEventListener("paste", (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      // SVG is deliberately excluded: sanitizing arbitrary attacker-controlled
      // SVG markup correctly needs a real XML/DOM sanitizer, which this app
      // doesn't bundle yet (see OPENQUESTIONS.md).
      if (item.type.startsWith("image/") && item.type !== "image/svg+xml") {
        const file = item.getAsFile();
        if (!file) continue;
        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = reader.result as string;
          if (!isSafeImageDataUrl(dataUrl)) {
            toast("That clipboard image couldn't be pasted (unsupported or oversized format).", true);
            return;
          }
          const visible = view.visibleDocRect();
          editor.apply("Paste image", (doc) => {
            const s = newShape(
              "image-placeholder",
              visible.x + visible.w / 2 - 80,
              visible.y + visible.h / 2 - 60,
              nextZ(doc)
            );
            s.w = 160;
            s.h = 120;
            s.imageSrc = dataUrl;
            s.stroke.width = 0;
            doc.shapes.push(s);
            editor.selection = new Set([s.id]);
          });
          view.refresh();
        };
        reader.readAsDataURL(file);
        e.preventDefault();
        return;
      }
    }
  });

  // warn before closing with unsaved changes
  window.addEventListener("beforeunload", (e) => {
    if (editor.dirty) {
      e.preventDefault();
      e.returnValue = "";
    }
  });

  // crash / unsaved-work recovery
  const recovery = checkRecovery();
  if (recovery) {
    const banner = document.createElement("div");
    banner.className = "banner";
    const when = new Date(recovery.when).toLocaleString();
    banner.innerHTML = `<span>Recovered unsaved work from ${when}.</span>`;
    const restore = document.createElement("button");
    restore.className = "mini-btn";
    restore.textContent = "Restore";
    restore.addEventListener("click", () => {
      editor.setDoc(recovery.doc, recovery.filePath);
      // Recovered content has never been written to disk, and no undo step
      // can take the document back to a saved state, so mark it permanently
      // unsaved rather than poking `dirty` (which the next undo would reset).
      editor.markUnsaved();
      actions.fitToContent();
      banner.remove();
    });
    const dismiss = document.createElement("button");
    dismiss.className = "mini-btn";
    dismiss.textContent = "Discard";
    dismiss.addEventListener("click", () => {
      clearAutosave();
      banner.remove();
    });
    banner.append(restore, dismiss);
    host.appendChild(banner);
  }

  view.refresh();
}

main();
