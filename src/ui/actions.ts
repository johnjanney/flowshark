import type { Editor } from "../core/editor";
import type { CanvasView } from "../canvas/view";
import type { Interactions } from "../canvas/interactions";
import { parseDoc, serializeDoc, DocumentError } from "../model/serialization";
import { contentBounds } from "../canvas/render";
import {
  addRecentFile,
  openImageFile,
  openRecentFile,
  openTextFile,
  saveTextFile,
} from "../platform/fileio";
import {
  copyPNGToClipboard,
  copySVGToClipboard,
  runExport,
} from "../io/export";
import { confirmDialog, exportDialog, templateDialog, toast } from "./dialogs";
import { newDoc, newShape, nextZ } from "../model/defaults";
import { clearAutosave } from "./autosave";
import type { Template } from "../templates";

/**
 * All top-level application commands. UI chrome (toolbar, menus, shortcuts)
 * dispatches through this object so behavior lives in one place.
 */
export class Actions {
  constructor(
    public editor: Editor,
    public view: CanvasView,
    public interactions: Interactions
  ) {}

  private async confirmDiscard(): Promise<boolean> {
    if (!this.editor.dirty) return true;
    return confirmDialog(
      "Unsaved changes",
      "You have unsaved changes that will be lost. Continue anyway?"
    );
  }

  async newFile(): Promise<void> {
    if (!(await this.confirmDiscard())) return;
    this.editor.setDoc(newDoc(), null);
    clearAutosave();
    this.view.refresh();
  }

  async newFromTemplate(): Promise<void> {
    if (!(await this.confirmDiscard())) return;
    templateDialog((t: Template) => {
      this.editor.setDoc(t.build(), null);
      clearAutosave();
      this.fitToContent();
      toast(`Created "${t.name}" template`);
    });
  }

  async open(): Promise<void> {
    if (!(await this.confirmDiscard())) return;
    try {
      const file = await openTextFile();
      if (!file) return;
      const doc = parseDoc(file.content);
      this.editor.setDoc(doc, file.path);
      addRecentFile(file.path, file.name);
      this.fitToContent();
      toast(`Opened ${file.name}`);
    } catch (err) {
      toast(err instanceof DocumentError ? err.message : `Could not open file: ${err}`, true);
    }
  }

  async openRecent(path: string): Promise<void> {
    if (!(await this.confirmDiscard())) return;
    try {
      const file = await openRecentFile(path);
      if (!file) return;
      const doc = parseDoc(file.content);
      this.editor.setDoc(doc, file.path);
      addRecentFile(file.path, file.name);
      this.fitToContent();
    } catch (err) {
      toast(`Could not open file: ${err}`, true);
    }
  }

  async save(forcePrompt = false): Promise<boolean> {
    try {
      const content = serializeDoc(this.editor.doc);
      const result = await saveTextFile(
        content,
        this.editor.doc.title || "flowchart",
        this.editor.filePath,
        forcePrompt
      );
      if (!result) return false;
      this.editor.filePath = result.path;
      this.editor.dirty = false;
      addRecentFile(result.path, result.name);
      clearAutosave();
      this.editor.notify();
      toast(`Saved ${result.name}`);
      return true;
    } catch (err) {
      toast(`Save failed: ${err}`, true);
      return false;
    }
  }

  saveAs(): Promise<boolean> {
    return this.save(true);
  }

  showExportDialog(): void {
    exportDialog(this.editor.selection.size > 0, async (r) => {
      try {
        const ids = r.scope === "selection" ? new Set(this.editor.selection) : undefined;
        await runExport(this.editor.doc, {
          format: r.format,
          ids,
          transparent: r.transparent,
          includeGrid: r.includeGrid,
          margin: r.margin,
          scale: r.scale,
        });
        toast(`Exported as ${r.format.toUpperCase()}`);
      } catch (err) {
        toast(`Export failed: ${err}`, true);
      }
    });
  }

  async quickExport(format: "png" | "svg" | "pdf"): Promise<void> {
    try {
      await runExport(this.editor.doc, { format, scale: 2, margin: 20 });
      toast(`Exported as ${format.toUpperCase()}`);
    } catch (err) {
      toast(`Export failed: ${err}`, true);
    }
  }

  async copyAsPNG(): Promise<void> {
    try {
      const ids = this.editor.selection.size > 0 ? new Set(this.editor.selection) : undefined;
      await copyPNGToClipboard(this.editor.doc, { ids, margin: 12 });
      toast("Copied image to clipboard");
    } catch (err) {
      toast(`Copy failed: ${err}`, true);
    }
  }

  async copyAsSVG(): Promise<void> {
    try {
      const ids = this.editor.selection.size > 0 ? new Set(this.editor.selection) : undefined;
      await copySVGToClipboard(this.editor.doc, { ids, margin: 12 });
      toast("Copied SVG to clipboard");
    } catch (err) {
      toast(`Copy failed: ${err}`, true);
    }
  }

  async importImage(): Promise<void> {
    const img = await openImageFile();
    if (!img) return;
    const view = this.view.visibleDocRect();
    this.editor.apply("Import image", (doc) => {
      const s = newShape(
        "image-placeholder",
        view.x + view.w / 2 - 80,
        view.y + view.h / 2 - 60,
        nextZ(doc)
      );
      s.w = 160;
      s.h = 120;
      s.imageSrc = img.dataUrl;
      s.stroke.width = 0;
      doc.shapes.push(s);
      this.editor.selection = new Set([s.id]);
    });
    this.view.refresh();
  }

  // ----- view ----------------------------------------------------------------

  zoomIn(): void {
    this.view.setZoom(this.editor.viewport.zoom * 1.25);
  }
  zoomOut(): void {
    this.view.setZoom(this.editor.viewport.zoom / 1.25);
  }
  zoomReset(): void {
    this.view.setZoom(1);
  }
  fitToContent(): void {
    this.view.fitRect(contentBounds(this.editor.doc));
  }
  fitSelection(): void {
    const b = this.editor.selectionBounds();
    if (b) this.view.fitRect(b);
    else this.fitToContent();
  }

  toggleGrid(): void {
    this.editor.doc.canvas.gridVisible = !this.editor.doc.canvas.gridVisible;
    this.editor.notify();
    this.view.refresh();
  }
  toggleSnapGrid(): void {
    this.editor.doc.canvas.snapToGrid = !this.editor.doc.canvas.snapToGrid;
    this.editor.notify();
  }
  toggleSnapElement(): void {
    this.editor.doc.canvas.snapToElement = !this.editor.doc.canvas.snapToElement;
    this.editor.notify();
  }
}
