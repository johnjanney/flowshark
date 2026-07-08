import type { Editor } from "../core/editor";
import type { CanvasView } from "../canvas/view";
import type { CapStyle, Connector, ConnectorType, LineStyle, Shape } from "../model/types";
import { CAP_STYLES, CONNECTOR_TYPES } from "../connectors/routing";
import { newLabel } from "../model/defaults";

const FONTS = [
  "Segoe UI, system-ui, sans-serif",
  "Arial, sans-serif",
  "Calibri, sans-serif",
  "Georgia, serif",
  "Times New Roman, serif",
  "Consolas, monospace",
  "Courier New, monospace",
  "Verdana, sans-serif",
  "Tahoma, sans-serif",
];

function fontLabel(f: string): string {
  return f.split(",")[0];
}

/**
 * Contextual properties panel. Rebuilt on every editor change; simple and
 * fast enough at this scale.
 */
export function buildInspector(
  container: HTMLElement,
  editor: Editor,
  view: CanvasView
): { update: () => void } {
  function commitPatch(label: string, fn: () => void): void {
    editor.apply(label, fn);
    view.refresh();
  }

  function row(labelText: string, ...controls: HTMLElement[]): HTMLElement {
    const r = document.createElement("div");
    r.className = "insp-row";
    const l = document.createElement("label");
    l.textContent = labelText;
    r.appendChild(l);
    for (const c of controls) r.appendChild(c);
    return r;
  }

  function title(text: string): HTMLElement {
    const t = document.createElement("div");
    t.className = "insp-title";
    t.textContent = text;
    return t;
  }

  function numberInput(
    value: number,
    onCommit: (v: number) => void,
    opts: { min?: number; max?: number; step?: number } = {}
  ): HTMLInputElement {
    const i = document.createElement("input");
    i.type = "number";
    i.value = String(Math.round(value * 100) / 100);
    if (opts.min !== undefined) i.min = String(opts.min);
    if (opts.max !== undefined) i.max = String(opts.max);
    i.step = String(opts.step ?? 1);
    i.addEventListener("change", () => {
      const v = Number(i.value);
      if (Number.isFinite(v)) onCommit(v);
    });
    return i;
  }

  function colorInput(value: string, onCommit: (v: string) => void): HTMLInputElement {
    const i = document.createElement("input");
    i.type = "color";
    i.value = toHexColor(value);
    i.addEventListener("input", () => onCommit(i.value));
    return i;
  }

  function selectInput<T extends string>(
    value: T,
    options: Array<{ id: T; label: string }>,
    onCommit: (v: T) => void
  ): HTMLSelectElement {
    const s = document.createElement("select");
    for (const o of options) {
      const opt = document.createElement("option");
      opt.value = o.id;
      opt.textContent = o.label;
      if (o.id === value) opt.selected = true;
      s.appendChild(opt);
    }
    s.addEventListener("change", () => onCommit(s.value as T));
    return s;
  }

  function checkbox(value: boolean, onCommit: (v: boolean) => void): HTMLInputElement {
    const i = document.createElement("input");
    i.type = "checkbox";
    i.checked = value;
    i.addEventListener("change", () => onCommit(i.checked));
    return i;
  }

  function rangeInput(
    value: number,
    onCommit: (v: number) => void,
    min = 0,
    max = 1,
    step = 0.05
  ): HTMLInputElement {
    const i = document.createElement("input");
    i.type = "range";
    i.min = String(min);
    i.max = String(max);
    i.step = String(step);
    i.value = String(value);
    i.addEventListener("change", () => onCommit(Number(i.value)));
    return i;
  }

  function toggleBtn(label: string, active: boolean, onClick: () => void): HTMLButtonElement {
    const b = document.createElement("button");
    b.className = `mini-btn${active ? " active" : ""}`;
    b.innerHTML = label;
    b.setAttribute("aria-pressed", String(active));
    b.addEventListener("click", onClick);
    return b;
  }

  // ---- section builders -------------------------------------------------------

  function docSection(): DocumentFragment {
    const frag = document.createDocumentFragment();
    const doc = editor.doc;
    frag.appendChild(title("Canvas"));
    frag.appendChild(
      row(
        "Grid size",
        numberInput(doc.canvas.gridSize, (v) => {
          doc.canvas.gridSize = Math.max(2, v);
          editor.notify();
          view.refresh();
        }, { min: 2, max: 200 })
      )
    );
    frag.appendChild(
      row(
        "Show grid",
        checkbox(doc.canvas.gridVisible, (v) => {
          doc.canvas.gridVisible = v;
          editor.notify();
          view.refresh();
        })
      )
    );
    frag.appendChild(
      row(
        "Snap to grid",
        checkbox(doc.canvas.snapToGrid, (v) => {
          doc.canvas.snapToGrid = v;
          editor.notify();
        })
      )
    );
    frag.appendChild(
      row(
        "Snap to elements",
        checkbox(doc.canvas.snapToElement, (v) => {
          doc.canvas.snapToElement = v;
          editor.notify();
        })
      )
    );
    frag.appendChild(
      row(
        "Snap tolerance",
        numberInput(doc.canvas.snapTolerance, (v) => {
          doc.canvas.snapTolerance = Math.max(1, v);
          editor.notify();
        }, { min: 1, max: 30 })
      )
    );
    frag.appendChild(
      row(
        "Background",
        colorInput(doc.canvas.background, (v) => {
          doc.canvas.background = v;
          editor.notify();
          view.refresh();
        })
      )
    );
    const hint = document.createElement("div");
    hint.className = "insp-empty";
    hint.textContent =
      "Select a shape or connector to edit its properties. Drag shapes from the left panel onto the canvas.";
    frag.appendChild(hint);
    return frag;
  }

  function positionSection(shapes: Shape[]): DocumentFragment {
    const frag = document.createDocumentFragment();
    const s = shapes[0];
    frag.appendChild(title("Position and size"));
    frag.appendChild(
      row(
        "X / Y",
        numberInput(s.x, (v) => commitPatch("Move", () => forEach(shapes, (sh) => (sh.x += v - s.x)))),
        numberInput(s.y, (v) => commitPatch("Move", () => forEach(shapes, (sh) => (sh.y += v - s.y))))
      )
    );
    frag.appendChild(
      row(
        "W / H",
        numberInput(s.w, (v) => commitPatch("Resize", () => forEach(shapes, (sh) => (sh.w = Math.max(4, v)))), { min: 4 }),
        numberInput(s.h, (v) => commitPatch("Resize", () => forEach(shapes, (sh) => (sh.h = Math.max(4, v)))), { min: 4 })
      )
    );
    frag.appendChild(
      row(
        "Rotation",
        numberInput(s.rotation, (v) => commitPatch("Rotate", () => forEach(shapes, (sh) => (sh.rotation = ((v % 360) + 360) % 360))), { min: -360, max: 360, step: 15 })
      )
    );
    return frag;
  }

  function fillStrokeSection(shapes: Shape[]): DocumentFragment {
    const frag = document.createDocumentFragment();
    const s = shapes[0];
    frag.appendChild(title("Fill and border"));
    frag.appendChild(
      row(
        "Fill",
        colorInput(s.fill.color, (v) =>
          commitPatch("Fill color", () => forEach(shapes, (sh) => (sh.fill.color = v)))
        ),
        rangeInput(s.fill.opacity, (v) =>
          commitPatch("Fill opacity", () => forEach(shapes, (sh) => (sh.fill.opacity = v)))
        )
      )
    );
    frag.appendChild(
      row(
        "Border",
        colorInput(s.stroke.color, (v) =>
          commitPatch("Border color", () => forEach(shapes, (sh) => (sh.stroke.color = v)))
        ),
        numberInput(s.stroke.width, (v) =>
          commitPatch("Border width", () => forEach(shapes, (sh) => (sh.stroke.width = Math.max(0, v)))),
          { min: 0, max: 20, step: 0.5 }
        )
      )
    );
    frag.appendChild(
      row(
        "Border style",
        selectInput<LineStyle>(
          s.stroke.style,
          [
            { id: "solid", label: "Solid" },
            { id: "dashed", label: "Dashed" },
            { id: "dotted", label: "Dotted" },
          ],
          (v) => commitPatch("Border style", () => forEach(shapes, (sh) => (sh.stroke.style = v)))
        )
      )
    );
    frag.appendChild(
      row(
        "Corner radius",
        numberInput(s.cornerRadius, (v) =>
          commitPatch("Corner radius", () => forEach(shapes, (sh) => (sh.cornerRadius = Math.max(0, v)))),
          { min: 0, max: 80 }
        )
      )
    );
    return frag;
  }

  function textSection(shapes: Shape[]): DocumentFragment {
    const frag = document.createDocumentFragment();
    const ts = shapes[0].textStyle;
    frag.appendChild(title("Text"));
    frag.appendChild(
      row(
        "Font",
        selectInput(
          ts.fontFamily,
          FONTS.map((f) => ({ id: f, label: fontLabel(f) })),
          (v) => commitPatch("Font", () => forEach(shapes, (sh) => (sh.textStyle.fontFamily = v)))
        )
      )
    );
    frag.appendChild(
      row(
        "Size / Color",
        numberInput(ts.fontSize, (v) =>
          commitPatch("Font size", () => forEach(shapes, (sh) => (sh.textStyle.fontSize = Math.max(4, v)))),
          { min: 4, max: 96 }
        ),
        colorInput(ts.color, (v) =>
          commitPatch("Text color", () => forEach(shapes, (sh) => (sh.textStyle.color = v)))
        )
      )
    );
    const styleRow = document.createElement("div");
    styleRow.className = "btn-row";
    styleRow.append(
      toggleBtn("<b>B</b>", ts.bold, () =>
        commitPatch("Bold", () => forEach(shapes, (sh) => (sh.textStyle.bold = !ts.bold)))
      ),
      toggleBtn("<i>I</i>", ts.italic, () =>
        commitPatch("Italic", () => forEach(shapes, (sh) => (sh.textStyle.italic = !ts.italic)))
      ),
      toggleBtn("<u>U</u>", ts.underline, () =>
        commitPatch("Underline", () => forEach(shapes, (sh) => (sh.textStyle.underline = !ts.underline)))
      )
    );
    const alignRow = document.createElement("div");
    alignRow.className = "btn-row";
    for (const [id, label] of [["left", "⇤"], ["center", "↔"], ["right", "⇥"]] as const) {
      alignRow.appendChild(
        toggleBtn(label, ts.align === id, () =>
          commitPatch("Align text", () => forEach(shapes, (sh) => (sh.textStyle.align = id)))
        )
      );
    }
    for (const [id, label] of [["top", "⤒"], ["middle", "↕"], ["bottom", "⤓"]] as const) {
      alignRow.appendChild(
        toggleBtn(label, ts.valign === id, () =>
          commitPatch("Align text", () => forEach(shapes, (sh) => (sh.textStyle.valign = id)))
        )
      );
    }
    frag.append(styleRow, alignRow);
    frag.appendChild(
      row(
        "Padding",
        numberInput(shapes[0].textPadding, (v) =>
          commitPatch("Text padding", () => forEach(shapes, (sh) => (sh.textPadding = Math.max(0, v)))),
          { min: 0, max: 60 }
        ),
      )
    );
    frag.appendChild(
      row(
        "Line spacing",
        numberInput(ts.lineHeight, (v) =>
          commitPatch("Line spacing", () => forEach(shapes, (sh) => (sh.textStyle.lineHeight = Math.max(0.6, v)))),
          { min: 0.6, max: 3, step: 0.1 }
        )
      )
    );
    return frag;
  }

  function connectorSection(conns: Connector[]): DocumentFragment {
    const frag = document.createDocumentFragment();
    const c = conns[0];
    frag.appendChild(title(`Connector${conns.length > 1 ? `s (${conns.length})` : ""}`));
    frag.appendChild(
      row(
        "Type",
        selectInput<ConnectorType>(
          c.type,
          CONNECTOR_TYPES as Array<{ id: ConnectorType; label: string }>,
          (v) => commitPatch("Connector type", () => forEach(conns, (cn) => (cn.type = v)))
        )
      )
    );
    frag.appendChild(
      row(
        "Line",
        colorInput(c.stroke.color, (v) =>
          commitPatch("Line color", () => forEach(conns, (cn) => (cn.stroke.color = v)))
        ),
        numberInput(c.stroke.width, (v) =>
          commitPatch("Line width", () => forEach(conns, (cn) => (cn.stroke.width = Math.max(0.5, v)))),
          { min: 0.5, max: 16, step: 0.5 }
        )
      )
    );
    frag.appendChild(
      row(
        "Line style",
        selectInput<LineStyle>(
          c.stroke.style,
          [
            { id: "solid", label: "Solid" },
            { id: "dashed", label: "Dashed" },
            { id: "dotted", label: "Dotted" },
          ],
          (v) => commitPatch("Line style", () => forEach(conns, (cn) => (cn.stroke.style = v)))
        )
      )
    );
    frag.appendChild(
      row(
        "Start cap",
        selectInput<CapStyle>(c.startCap, CAP_STYLES as Array<{ id: CapStyle; label: string }>, (v) =>
          commitPatch("Start cap", () => forEach(conns, (cn) => (cn.startCap = v)))
        )
      )
    );
    frag.appendChild(
      row(
        "End cap",
        selectInput<CapStyle>(c.endCap, CAP_STYLES as Array<{ id: CapStyle; label: string }>, (v) =>
          commitPatch("End cap", () => forEach(conns, (cn) => (cn.endCap = v)))
        )
      )
    );
    frag.appendChild(
      row(
        "Opacity",
        rangeInput(c.opacity, (v) =>
          commitPatch("Opacity", () => forEach(conns, (cn) => (cn.opacity = v)))
        )
      )
    );
    const swap = document.createElement("button");
    swap.className = "mini-btn";
    swap.textContent = "⇄ Reverse direction";
    swap.addEventListener("click", () =>
      commitPatch("Reverse connector", () =>
        forEach(conns, (cn) => {
          const tmp = cn.source;
          cn.source = cn.target;
          cn.target = tmp;
          cn.points.reverse();
          for (const l of cn.labels) l.t = 1 - l.t;
        })
      )
    );
    const clearBends = document.createElement("button");
    clearBends.className = "mini-btn";
    clearBends.textContent = "Clear bend points";
    clearBends.addEventListener("click", () =>
      commitPatch("Clear bends", () => forEach(conns, (cn) => (cn.points = [])))
    );
    const btnRow = document.createElement("div");
    btnRow.className = "btn-row";
    btnRow.append(swap, clearBends);
    frag.appendChild(btnRow);

    // labels
    if (conns.length === 1) {
      frag.appendChild(title("Labels"));
      for (const label of c.labels) {
        const input = document.createElement("input");
        input.type = "text";
        input.value = label.text;
        input.setAttribute("aria-label", "Connector label text");
        input.addEventListener("change", () =>
          commitPatch("Edit label", () => {
            label.text = input.value;
          })
        );
        const pos = numberInput(
          Math.round(label.t * 100),
          (v) =>
            commitPatch("Move label", () => {
              label.t = Math.max(0, Math.min(1, v / 100));
            }),
          { min: 0, max: 100, step: 5 }
        );
        pos.title = "Position along connector (%)";
        pos.style.maxWidth = "58px";
        const off = numberInput(
          label.offset,
          (v) => commitPatch("Offset label", () => (label.offset = v)),
          { min: -100, max: 100, step: 2 }
        );
        off.title = "Perpendicular offset";
        off.style.maxWidth = "58px";
        const del = document.createElement("button");
        del.className = "mini-btn";
        del.textContent = "✕";
        del.title = "Remove label";
        del.addEventListener("click", () =>
          commitPatch("Remove label", () => {
            c.labels = c.labels.filter((l) => l.id !== label.id);
          })
        );
        const r = document.createElement("div");
        r.className = "insp-row";
        r.append(input, pos, off, del);
        frag.appendChild(r);
      }
      const add = document.createElement("button");
      add.className = "mini-btn";
      add.textContent = "+ Add label";
      add.addEventListener("click", () =>
        commitPatch("Add label", () => {
          c.labels.push(newLabel("Label"));
        })
      );
      frag.appendChild(add);
    }
    return frag;
  }

  function arrangeSection(): DocumentFragment {
    const frag = document.createDocumentFragment();
    frag.appendChild(title("Arrange"));
    const mk = (label: string, fn: () => void, titleText: string) => {
      const b = document.createElement("button");
      b.className = "mini-btn";
      b.textContent = label;
      b.title = titleText;
      b.setAttribute("aria-label", titleText);
      b.addEventListener("click", () => {
        fn();
        view.refresh();
      });
      return b;
    };
    const r1 = document.createElement("div");
    r1.className = "btn-row";
    r1.append(
      mk("⫷", () => editor.align("left"), "Align left edges"),
      mk("⫶", () => editor.align("hcenter"), "Align horizontal centers"),
      mk("⫸", () => editor.align("right"), "Align right edges"),
      mk("⤒", () => editor.align("top"), "Align top edges"),
      mk("⇕", () => editor.align("vcenter"), "Align vertical centers"),
      mk("⤓", () => editor.align("bottom"), "Align bottom edges")
    );
    const r2 = document.createElement("div");
    r2.className = "btn-row";
    r2.append(
      mk("↔ dist", () => editor.distribute("horizontal"), "Distribute horizontally"),
      mk("↕ dist", () => editor.distribute("vertical"), "Distribute vertically"),
      mk("=W", () => editor.matchSize("width"), "Make same width"),
      mk("=H", () => editor.matchSize("height"), "Make same height"),
      mk("=WH", () => editor.matchSize("both"), "Make same size")
    );
    frag.append(r1, r2);
    return frag;
  }

  function stateSection(): DocumentFragment {
    const frag = document.createDocumentFragment();
    const els = editor.selectedElements();
    const anyLocked = els.some((e) => e.locked);
    const anyHidden = els.some((e) => e.hidden);
    frag.appendChild(title("State"));
    const r = document.createElement("div");
    r.className = "btn-row";
    const lockBtn = document.createElement("button");
    lockBtn.className = `mini-btn${anyLocked ? " active" : ""}`;
    lockBtn.textContent = anyLocked ? "🔓 Unlock" : "🔒 Lock";
    lockBtn.addEventListener("click", () => {
      editor.setLocked(!anyLocked);
      view.refresh();
    });
    const hideBtn = document.createElement("button");
    hideBtn.className = `mini-btn${anyHidden ? " active" : ""}`;
    hideBtn.textContent = anyHidden ? "👁 Show" : "🕶 Hide";
    hideBtn.addEventListener("click", () => {
      editor.setHidden(!anyHidden);
      view.refresh();
    });
    r.append(lockBtn, hideBtn);
    frag.appendChild(r);
    return frag;
  }

  function update(): void {
    container.innerHTML = "";
    const shapes = editor.selectedShapes();
    const conns = editor.selectedConnectors();

    if (shapes.length === 0 && conns.length === 0) {
      container.appendChild(docSection());
      return;
    }
    if (shapes.length > 0) {
      const heading = document.createElement("div");
      heading.className = "insp-title";
      heading.textContent =
        shapes.length === 1
          ? `Shape: ${shapes[0].type}`
          : `${shapes.length} shapes selected`;
      container.appendChild(heading);
      container.appendChild(positionSection(shapes));
      container.appendChild(fillStrokeSection(shapes));
      container.appendChild(textSection(shapes));
    }
    if (conns.length > 0) {
      container.appendChild(connectorSection(conns));
    }
    if (shapes.length >= 2) container.appendChild(arrangeSection());
    container.appendChild(stateSection());
  }

  function forEach<T>(items: T[], fn: (item: T) => void): void {
    for (const i of items) fn(i);
  }

  update();
  return { update };
}

function toHexColor(c: string): string {
  if (/^#[0-9a-fA-F]{6}$/.test(c)) return c;
  if (/^#[0-9a-fA-F]{3}$/.test(c)) {
    return `#${c[1]}${c[1]}${c[2]}${c[2]}${c[3]}${c[3]}`;
  }
  return "#ffffff";
}
