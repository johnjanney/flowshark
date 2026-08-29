import type { FlowDoc } from "../model/types";
import { exportSVG } from "../canvas/render";
import { TEMPLATES, type Template } from "../templates";

const root = () => document.getElementById("dialog-root")!;

export function toast(message: string, isError = false): void {
  const el = document.createElement("div");
  el.className = `toast${isError ? " error" : ""}`;
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), isError ? 5000 : 2500);
}

interface DialogHandle {
  close: () => void;
  el: HTMLElement;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Open a modal dialog.
 *
 * `onDismiss` runs whenever the dialog closes without the caller having
 * closed it itself — Escape, a backdrop click, or any other cancellation
 * path. Callers that return a promise MUST use it: otherwise a dismissed
 * dialog leaves that promise pending forever, and any command awaiting it
 * (the unsaved-changes prompt, for instance) silently does nothing.
 */
export function openDialog(
  title: string,
  build: (body: HTMLElement, h: DialogHandle) => void,
  onDismiss?: () => void
): DialogHandle {
  const previouslyFocused = document.activeElement as HTMLElement | null;
  const backdrop = document.createElement("div");
  backdrop.className = "dialog-backdrop";
  const dialog = document.createElement("div");
  dialog.className = "dialog";
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-modal", "true");
  dialog.setAttribute("aria-label", title);
  const h2 = document.createElement("h2");
  h2.textContent = title;
  dialog.appendChild(h2);
  const body = document.createElement("div");
  dialog.appendChild(body);
  backdrop.appendChild(dialog);

  let closed = false;
  const teardown = (dismissed: boolean) => {
    if (closed) return;
    closed = true;
    backdrop.remove();
    previouslyFocused?.focus?.();
    if (dismissed) onDismiss?.();
  };

  const handle: DialogHandle = {
    el: dialog,
    close: () => teardown(false),
  };
  backdrop.addEventListener("mousedown", (e) => {
    if (e.target === backdrop) teardown(true);
  });
  backdrop.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      teardown(true);
      return;
    }
    if (e.key === "Tab") {
      // Keep focus inside the modal so keyboard users can't tab out into the
      // inert canvas behind it.
      const focusable = [...dialog.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
        (el) => el.offsetParent !== null || el === document.activeElement
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    e.stopPropagation();
  });
  build(body, handle);
  root().appendChild(backdrop);
  (dialog.querySelector("input,select,button") as HTMLElement | null)?.focus();
  return handle;
}

export function confirmDialog(title: string, message: string): Promise<boolean> {
  return new Promise((resolve) => {
    openDialog(
      title,
      (body, h) => {
        const p = document.createElement("p");
        p.textContent = message;
        body.appendChild(p);
        const actions = document.createElement("div");
        actions.className = "dialog-actions";
        const cancel = btn("Cancel", () => {
          h.close();
          resolve(false);
        });
        const ok = btn("Continue", () => {
          h.close();
          resolve(true);
        });
        ok.classList.add("primary");
        actions.append(cancel, ok);
        body.appendChild(actions);
      },
      // Escape or a backdrop click means "don't continue" — the same as
      // Cancel. Without this the promise never settles and the caller
      // (New / Open / New from template) stalls with no feedback.
      () => resolve(false)
    );
  });
}

function btn(label: string, onClick: () => void): HTMLButtonElement {
  const b = document.createElement("button");
  b.className = "mini-btn";
  b.textContent = label;
  b.addEventListener("click", onClick);
  return b;
}

export function templateDialog(onPick: (t: Template) => void): void {
  openDialog("New from template", (body, h) => {
    const grid = document.createElement("div");
    grid.className = "template-grid";
    for (const t of TEMPLATES) {
      const card = document.createElement("button");
      card.className = "template-card";
      const thumb = document.createElement("div");
      thumb.className = "thumb";
      const doc = t.build();
      if (doc.shapes.length > 0) {
        thumb.innerHTML = exportSVG(doc, { margin: 30 }).svg;
        const svg = thumb.querySelector("svg")!;
        svg.removeAttribute("width");
        svg.removeAttribute("height");
      } else {
        thumb.textContent = "✨";
        thumb.style.fontSize = "32px";
      }
      const name = document.createElement("b");
      name.textContent = t.name;
      const desc = document.createElement("div");
      desc.textContent = t.description;
      desc.style.fontSize = "10.5px";
      desc.style.color = "var(--text-dim)";
      card.append(thumb, name, desc);
      card.addEventListener("click", () => {
        h.close();
        onPick(t);
      });
      grid.appendChild(card);
    }
    body.appendChild(grid);
  });
}

export interface ExportDialogResult {
  format: "png" | "svg" | "pdf" | "jpeg" | "webp";
  scope: "all" | "selection";
  scale: number;
  transparent: boolean;
  includeGrid: boolean;
  margin: number;
}

export function exportDialog(
  hasSelection: boolean,
  onExport: (r: ExportDialogResult) => void
): void {
  openDialog("Export diagram", (body, h) => {
    body.innerHTML = `
      <div class="insp-row"><label for="exp-format">Format</label>
        <select id="exp-format">
          <option value="png">PNG image</option>
          <option value="svg">SVG vector</option>
          <option value="pdf">PDF document</option>
          <option value="jpeg">JPEG image</option>
          <option value="webp">WebP image</option>
        </select></div>
      <div class="insp-row"><label for="exp-scope">Scope</label>
        <select id="exp-scope">
          <option value="all">Entire diagram</option>
          <option value="selection" ${hasSelection ? "" : "disabled"}>Selected objects</option>
        </select></div>
      <div class="insp-row"><label for="exp-scale">Scale</label>
        <select id="exp-scale">
          <option value="1">1× </option>
          <option value="2" selected>2× (recommended)</option>
          <option value="3">3×</option>
          <option value="4">4×</option>
        </select></div>
      <div class="insp-row"><label for="exp-margin">Margin</label>
        <input id="exp-margin" type="number" value="20" min="0" max="200" step="5"/></div>
      <div class="insp-row"><label></label>
        <label style="flex:1"><input type="checkbox" id="exp-transparent"/> Transparent background</label></div>
      <div class="insp-row"><label></label>
        <label style="flex:1"><input type="checkbox" id="exp-grid"/> Include grid</label></div>
    `;
    const actions = document.createElement("div");
    actions.className = "dialog-actions";
    const cancel = btn("Cancel", () => h.close());
    const ok = btn("Export", () => {
      const q = (id: string) => body.querySelector(`#${id}`) as HTMLInputElement | HTMLSelectElement;
      h.close();
      onExport({
        format: q("exp-format").value as ExportDialogResult["format"],
        scope: q("exp-scope").value as "all" | "selection",
        scale: Number(q("exp-scale").value),
        transparent: (q("exp-transparent") as HTMLInputElement).checked,
        includeGrid: (q("exp-grid") as HTMLInputElement).checked,
        margin: Number(q("exp-margin").value) || 0,
      });
    });
    ok.classList.add("primary");
    actions.append(cancel, ok);
    body.appendChild(actions);
  });
}
