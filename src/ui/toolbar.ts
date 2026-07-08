import type { Editor } from "../core/editor";
import type { Interactions, Tool } from "../canvas/interactions";
import type { Actions } from "./actions";
import type { ConnectorType } from "../model/types";
import { getRecentFiles, isTauri } from "../platform/fileio";
import { CONNECTOR_TYPES } from "../connectors/routing";

interface MenuItem {
  label?: string;
  shortcut?: string;
  action?: () => void;
  disabled?: boolean;
  sep?: boolean;
  head?: string;
}

function icon(paths: string, size = 15): string {
  return `<svg width="${size}" height="${size}" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
}

const ICONS = {
  select: icon(`<path d="M3 2 L3 12 L6.2 9.4 L8 13.5 L9.8 12.6 L8 8.7 L12 8.2 Z" fill="currentColor" stroke="none"/>`),
  pan: icon(`<path d="M8 2v12M2 8h12M8 2l-1.8 1.8M8 2l1.8 1.8M8 14l-1.8-1.8M8 14l1.8-1.8M2 8l1.8-1.8M2 8l1.8 1.8M14 8l-1.8-1.8M14 8l-1.8 1.8"/>`),
  text: icon(`<path d="M3 3h10M8 3v10"/>`),
  connector: icon(`<circle cx="3.5" cy="3.5" r="1.8"/><circle cx="12.5" cy="12.5" r="1.8"/><path d="M5 5 L11 11M11 11l-.5-2.4M11 11l-2.4-.5"/>`),
  undo: icon(`<path d="M3 6h7a3.5 3.5 0 0 1 0 7H6"/><path d="M5.5 3.5 3 6l2.5 2.5"/>`),
  redo: icon(`<path d="M13 6H6a3.5 3.5 0 0 0 0 7h4"/><path d="M10.5 3.5 13 6l-2.5 2.5"/>`),
  grid: icon(`<path d="M2 5.5h12M2 10.5h12M5.5 2v12M10.5 2v12"/>`),
  magnet: icon(`<path d="M4 2v6a4 4 0 0 0 8 0V2M4 2h3v4H4zM9 2h3v4H9z"/>`),
  snapEl: icon(`<rect x="2" y="2" width="5" height="5"/><rect x="9" y="9" width="5" height="5"/><path d="M7 12 L4.5 12 L4.5 7" stroke-dasharray="1.5 1.5"/>`),
  group: icon(`<rect x="2" y="2" width="7" height="7"/><rect x="7" y="7" width="7" height="7"/>`),
  ungroup: icon(`<rect x="2" y="2" width="5" height="5"/><rect x="9" y="9" width="5" height="5"/>`),
  lock: icon(`<rect x="3.5" y="7" width="9" height="6.5" rx="1"/><path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2"/>`),
  theme: icon(`<path d="M13 9.5A5.5 5.5 0 0 1 6.5 3 5.5 5.5 0 1 0 13 9.5Z"/>`),
  export: icon(`<path d="M8 2v8M8 2 5.5 4.5M8 2l2.5 2.5M3 10v3h10v-3"/>`),
  alignL: icon(`<path d="M3 2v12"/><rect x="5" y="4" width="8" height="3"/><rect x="5" y="9" width="5" height="3"/>`),
  distH: icon(`<path d="M2 2v12M14 2v12"/><rect x="5" y="5" width="2.5" height="6"/><rect x="8.5" y="5" width="2.5" height="6"/>`),
  order: icon(`<rect x="2" y="6" width="8" height="8"/><path d="M6 6V2h8v8h-4"/>`),
  fit: icon(`<path d="M2 5V2h3M11 2h3v3M14 11v3h-3M5 14H2v-3"/><rect x="5.5" y="5.5" width="5" height="5"/>`),
};

export function buildToolbar(
  container: HTMLElement,
  editor: Editor,
  interactions: Interactions,
  actions: Actions,
  toggleTheme: () => void
): { update: () => void } {
  container.innerHTML = "";
  let openMenu: HTMLElement | null = null;

  const closeMenus = () => {
    openMenu?.remove();
    openMenu = null;
  };
  document.addEventListener("mousedown", (e) => {
    if (openMenu && !(e.target as HTMLElement).closest(".menu-wrap")) closeMenus();
  });

  function menuButton(label: string, items: () => MenuItem[]): HTMLElement {
    const wrap = document.createElement("div");
    wrap.className = "menu-wrap";
    const btn = document.createElement("button");
    btn.className = "tb-btn";
    btn.textContent = label;
    btn.setAttribute("aria-haspopup", "menu");
    btn.addEventListener("click", () => {
      if (openMenu && wrap.contains(openMenu)) {
        closeMenus();
        return;
      }
      closeMenus();
      const menu = document.createElement("div");
      menu.className = "menu";
      menu.setAttribute("role", "menu");
      for (const item of items()) {
        if (item.sep) {
          const sep = document.createElement("div");
          sep.className = "menu-sep";
          menu.appendChild(sep);
          continue;
        }
        if (item.head) {
          const head = document.createElement("div");
          head.className = "menu-head";
          head.textContent = item.head;
          menu.appendChild(head);
          continue;
        }
        const mi = document.createElement("button");
        mi.className = "menu-item";
        mi.setAttribute("role", "menuitem");
        mi.innerHTML = `<span>${item.label}</span>${
          item.shortcut ? `<span class="shortcut">${item.shortcut}</span>` : ""
        }`;
        mi.disabled = !!item.disabled;
        mi.addEventListener("click", () => {
          closeMenus();
          item.action?.();
        });
        menu.appendChild(mi);
      }
      wrap.appendChild(menu);
      openMenu = menu;
    });
    wrap.appendChild(btn);
    return wrap;
  }

  function toolBtn(
    tool: Tool,
    label: string,
    iconSvg: string
  ): HTMLButtonElement {
    const b = document.createElement("button");
    b.className = "tb-btn";
    b.innerHTML = iconSvg;
    b.title = label;
    b.setAttribute("aria-label", label);
    b.dataset.tool = tool;
    b.addEventListener("click", () => {
      interactions.setTool(tool);
      update();
    });
    return b;
  }

  function cmdBtn(label: string, iconSvg: string, onClick: () => void): HTMLButtonElement {
    const b = document.createElement("button");
    b.className = "tb-btn";
    b.innerHTML = iconSvg;
    b.title = label;
    b.setAttribute("aria-label", label);
    b.addEventListener("click", onClick);
    return b;
  }

  const sep = () => {
    const s = document.createElement("div");
    s.className = "tb-sep";
    return s;
  };

  // ---- File / Edit / View menus ----
  const fileMenu = menuButton("File", () => {
    const recents = getRecentFiles();
    const items: MenuItem[] = [
      { label: "New", shortcut: "Ctrl+N", action: () => actions.newFile() },
      { label: "New from template…", action: () => actions.newFromTemplate() },
      { label: "Open…", shortcut: "Ctrl+O", action: () => actions.open() },
    ];
    if (isTauri() && recents.length > 0) {
      items.push({ head: "Recent files" });
      for (const r of recents.slice(0, 6)) {
        items.push({ label: r.name, action: () => actions.openRecent(r.path) });
      }
    }
    items.push(
      { sep: true },
      { label: "Save", shortcut: "Ctrl+S", action: () => actions.save() },
      { label: "Save As…", shortcut: "Ctrl+Shift+S", action: () => actions.saveAs() },
      { sep: true },
      { label: "Import image…", action: () => actions.importImage() },
      { sep: true },
      { label: "Export…", shortcut: "Ctrl+E", action: () => actions.showExportDialog() },
      { label: "Export PNG", action: () => actions.quickExport("png") },
      { label: "Export SVG", action: () => actions.quickExport("svg") },
      { label: "Export PDF", action: () => actions.quickExport("pdf") },
      { sep: true },
      { label: "Copy as image", action: () => actions.copyAsPNG() },
      { label: "Copy as SVG", action: () => actions.copyAsSVG() }
    );
    return items;
  });

  const editMenu = menuButton("Edit", () => [
    { label: "Undo", shortcut: "Ctrl+Z", action: () => { editor.undo(); actions.view.refresh(); }, disabled: !editor.canUndo() },
    { label: "Redo", shortcut: "Ctrl+Y", action: () => { editor.redo(); actions.view.refresh(); }, disabled: !editor.canRedo() },
    { sep: true },
    { label: "Cut", shortcut: "Ctrl+X", action: () => { editor.cut(); actions.view.refresh(); } },
    { label: "Copy", shortcut: "Ctrl+C", action: () => editor.copy() },
    { label: "Paste", shortcut: "Ctrl+V", action: () => { editor.paste(); actions.view.refresh(); } },
    { label: "Duplicate", shortcut: "Ctrl+D", action: () => { editor.duplicate(); actions.view.refresh(); } },
    { label: "Delete", shortcut: "Del", action: () => { editor.deleteSelection(); actions.view.refresh(); } },
    { sep: true },
    { label: "Copy style", shortcut: "Ctrl+Shift+C", action: () => editor.copyStyle() },
    { label: "Paste style", shortcut: "Ctrl+Shift+V", action: () => { editor.pasteStyle(); actions.view.refresh(); } },
    { sep: true },
    { label: "Select all", shortcut: "Ctrl+A", action: () => editor.selectAll() },
    { label: "Deselect", shortcut: "Esc", action: () => editor.deselect() },
  ]);

  const viewMenu = menuButton("View", () => [
    { label: "Zoom in", shortcut: "Ctrl++", action: () => actions.zoomIn() },
    { label: "Zoom out", shortcut: "Ctrl+-", action: () => actions.zoomOut() },
    { label: "Zoom 100%", shortcut: "Ctrl+1", action: () => actions.zoomReset() },
    { label: "Fit to screen", shortcut: "Ctrl+0", action: () => actions.fitToContent() },
    { label: "Fit selection", shortcut: "Ctrl+2", action: () => actions.fitSelection() },
    { sep: true },
    { label: `${editor.doc.canvas.gridVisible ? "Hide" : "Show"} grid`, action: () => actions.toggleGrid() },
    { label: `Snap to grid: ${editor.doc.canvas.snapToGrid ? "on" : "off"}`, action: () => actions.toggleSnapGrid() },
    { label: `Snap to elements: ${editor.doc.canvas.snapToElement ? "on" : "off"}`, action: () => actions.toggleSnapElement() },
    { sep: true },
    { label: "Toggle dark mode", action: toggleTheme },
  ]);

  // ---- title ----
  const title = document.createElement("input");
  title.id = "doc-title";
  title.setAttribute("aria-label", "Document title");
  title.addEventListener("change", () => {
    editor.doc.title = title.value;
    editor.dirty = true;
    editor.notify();
  });

  // ---- tool buttons ----
  const selectBtn = toolBtn("select", "Select (V)", ICONS.select);
  const panBtn = toolBtn("pan", "Pan (H)", ICONS.pan);
  const textBtn = toolBtn("text", "Text (T)", ICONS.text);

  const connWrap = document.createElement("div");
  connWrap.className = "menu-wrap";
  const connBtn = document.createElement("button");
  connBtn.className = "tb-btn";
  connBtn.innerHTML = ICONS.connector + `<span id="conn-type-label">Elbow</span> ▾`;
  connBtn.title = "Connector tool (C) — click to choose type";
  connBtn.addEventListener("click", () => {
    if (openMenu && connWrap.contains(openMenu)) {
      closeMenus();
      return;
    }
    closeMenus();
    const menu = document.createElement("div");
    menu.className = "menu";
    for (const ct of CONNECTOR_TYPES) {
      const mi = document.createElement("button");
      mi.className = "menu-item";
      mi.innerHTML = `<span>${ct.label}${
        interactions.connectorType === ct.id ? " ✓" : ""
      }</span>`;
      mi.addEventListener("click", () => {
        interactions.connectorType = ct.id as ConnectorType;
        interactions.setTool("connector");
        closeMenus();
        update();
      });
      menu.appendChild(mi);
    }
    connWrap.appendChild(menu);
    openMenu = menu;
  });
  connWrap.appendChild(connBtn);

  // ---- history ----
  const undoBtn = cmdBtn("Undo (Ctrl+Z)", ICONS.undo, () => {
    editor.undo();
    actions.view.refresh();
  });
  const redoBtn = cmdBtn("Redo (Ctrl+Y)", ICONS.redo, () => {
    editor.redo();
    actions.view.refresh();
  });

  // ---- snapping toggles ----
  const gridBtn = cmdBtn("Toggle grid (Ctrl+')", ICONS.grid, () => actions.toggleGrid());
  const snapGridBtn = cmdBtn("Snap to grid", ICONS.magnet, () => actions.toggleSnapGrid());
  const snapElBtn = cmdBtn("Snap to elements", ICONS.snapEl, () => actions.toggleSnapElement());

  // ---- arrange menus ----
  const alignMenu = menuButton("Align", () => [
    { label: "Align left", action: () => { editor.align("left"); actions.view.refresh(); } },
    { label: "Align center", action: () => { editor.align("hcenter"); actions.view.refresh(); } },
    { label: "Align right", action: () => { editor.align("right"); actions.view.refresh(); } },
    { sep: true },
    { label: "Align top", action: () => { editor.align("top"); actions.view.refresh(); } },
    { label: "Align middle", action: () => { editor.align("vcenter"); actions.view.refresh(); } },
    { label: "Align bottom", action: () => { editor.align("bottom"); actions.view.refresh(); } },
    { sep: true },
    { label: "Distribute horizontally", action: () => { editor.distribute("horizontal"); actions.view.refresh(); } },
    { label: "Distribute vertically", action: () => { editor.distribute("vertical"); actions.view.refresh(); } },
    { sep: true },
    { label: "Make same width", action: () => { editor.matchSize("width"); actions.view.refresh(); } },
    { label: "Make same height", action: () => { editor.matchSize("height"); actions.view.refresh(); } },
    { label: "Make same size", action: () => { editor.matchSize("both"); actions.view.refresh(); } },
  ]);

  const orderMenu = menuButton("Order", () => [
    { label: "Bring to front", shortcut: "Ctrl+Shift+]", action: () => { editor.order("front"); actions.view.refresh(); } },
    { label: "Bring forward", shortcut: "Ctrl+]", action: () => { editor.order("forward"); actions.view.refresh(); } },
    { label: "Send backward", shortcut: "Ctrl+[", action: () => { editor.order("backward"); actions.view.refresh(); } },
    { label: "Send to back", shortcut: "Ctrl+Shift+[", action: () => { editor.order("back"); actions.view.refresh(); } },
  ]);

  const groupBtn = cmdBtn("Group (Ctrl+G)", ICONS.group, () => {
    editor.group();
    actions.view.refresh();
  });
  const ungroupBtn = cmdBtn("Ungroup (Ctrl+Shift+G)", ICONS.ungroup, () => {
    editor.ungroup();
    actions.view.refresh();
  });

  const lockBtn = cmdBtn("Lock / unlock selection", ICONS.lock, () => {
    const anyUnlocked = editor.selectedElements().some((e) => !e.locked);
    editor.setLocked(anyUnlocked);
    actions.view.refresh();
  });

  const fitBtn = cmdBtn("Fit to screen (Ctrl+0)", ICONS.fit, () => actions.fitToContent());
  const exportBtn = cmdBtn("Export (Ctrl+E)", ICONS.export, () => actions.showExportDialog());
  const themeBtn = cmdBtn("Toggle dark mode", ICONS.theme, toggleTheme);

  const spacer = document.createElement("div");
  spacer.style.flex = "1";

  container.append(
    fileMenu,
    editMenu,
    viewMenu,
    sep(),
    undoBtn,
    redoBtn,
    sep(),
    selectBtn,
    panBtn,
    textBtn,
    connWrap,
    sep(),
    gridBtn,
    snapGridBtn,
    snapElBtn,
    sep(),
    alignMenu,
    orderMenu,
    groupBtn,
    ungroupBtn,
    lockBtn,
    sep(),
    fitBtn,
    exportBtn,
    spacer,
    title,
    themeBtn
  );

  function update(): void {
    undoBtn.disabled = !editor.canUndo();
    redoBtn.disabled = !editor.canRedo();
    for (const b of [selectBtn, panBtn, textBtn]) {
      b.setAttribute("aria-pressed", String(interactions.tool === b.dataset.tool && !interactions.pendingShape));
    }
    connBtn.setAttribute("aria-pressed", String(interactions.tool === "connector"));
    const label = connBtn.querySelector("#conn-type-label");
    if (label) {
      label.textContent =
        CONNECTOR_TYPES.find((c) => c.id === interactions.connectorType)?.label ?? "Elbow";
    }
    gridBtn.setAttribute("aria-pressed", String(editor.doc.canvas.gridVisible));
    snapGridBtn.setAttribute("aria-pressed", String(editor.doc.canvas.snapToGrid));
    snapElBtn.setAttribute("aria-pressed", String(editor.doc.canvas.snapToElement));
    if (document.activeElement !== title) title.value = editor.doc.title;
  }

  update();
  return { update };
}
