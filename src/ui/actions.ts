import type { Editor } from "../core/editor";
import type { CanvasView } from "../canvas/view";
import type { Interactions } from "../canvas/interactions";
import { parseDoc, serializeDoc, DocumentError } from "../model/serialization";
import { contentBounds } from "../canvas/render";
import {
  addRecentFile,
  isTauri,
  openImageFile,
  openRecentFile,
  openTextFile,
  removeRecentFile,
  saveTextFile,
} from "../platform/fileio";
import {
  ExportSizeError,
  copyPNGToClipboard,
  copySVGToClipboard,
  runExport,
} from "../io/export";
import { confirmDialog, exportDialog, templateDialog, toast } from "./dialogs";
import { newDoc, newShape, nextZ } from "../model/defaults";
import { clearAutosave } from "./autosave";
import { isSafeImageDataUrl } from "../core/safety";
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

  /**
   * Human-readable text for an error surfaced in a toast. Errors we raise
   * ourselves already carry a message written for a user; anything else is
   * stringified, since a raw `[object Object]` helps nobody.
   */
  private describe(err: unknown): string {
    if (err instanceof DocumentError || err instanceof ExportSizeError) return err.message;
    if (err instanceof Error) return err.message || String(err);
    return String(err);
  }

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
      toast(
        err instanceof DocumentError
          ? err.message
          : `Could not open file: ${this.describe(err)}`,
        true
      );
    }
  }

  /**
   * Open a file straight from the recent list.
   *
   * The desktop build's persistent filesystem scope is `$DOCUMENT/**`; the
   * wider grant that an open dialog confers lasts only for the running
   * session. So a recent entry pointing outside Documents reads fine until
   * the app restarts and then fails. Rather than showing a raw permission
   * error, fall back to the open dialog for the same file (which re-grants
   * access), and drop the entry if the user declines or the file is gone.
   */
  async openRecent(path: string): Promise<void> {
    if (!(await this.confirmDiscard())) return;
    let file: Awaited<ReturnType<typeof openRecentFile>> = null;
    try {
      file = await openRecentFile(path);
      if (!file) return;
    } catch (err) {
      const reauthorized = await this.reopenViaDialog(path, err);
      if (!reauthorized) return;
      file = reauthorized;
    }
    try {
      const doc = parseDoc(file.content);
      this.editor.setDoc(doc, file.path);
      addRecentFile(file.path, file.name);
      this.fitToContent();
      toast(`Opened ${file.name}`);
    } catch (err) {
      toast(
        err instanceof DocumentError
          ? err.message
          : `Could not open file: ${this.describe(err)}`,
        true
      );
    }
  }

  /** Ask the user to re-pick an unreadable recent file through the dialog. */
  private async reopenViaDialog(
    path: string,
    err: unknown
  ): Promise<Awaited<ReturnType<typeof openTextFile>>> {
    const proceed = await confirmDialog(
      "Can't reopen this file",
      `FlowShark no longer has permission to read "${path}" directly. This happens ` +
        `for files stored outside your Documents folder, because the permission ` +
        `granted when you first opened them does not survive a restart. ` +
        `Choose the file again to reopen it?`
    );
    if (!proceed) {
      removeRecentFile(path);
      if (!isTauri()) toast(`Could not open file: ${this.describe(err)}`, true);
      return null;
    }
    try {
      const picked = await openTextFile();
      if (!picked) return null;
      if (picked.path !== path) removeRecentFile(path);
      return picked;
    } catch (pickErr) {
      toast(`Could not open file: ${this.describe(pickErr)}`, true);
      return null;
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
      this.editor.markSaved();
      addRecentFile(result.path, result.name);
      clearAutosave();
      // A download fallback (no File System Access API) writes a *new* file
      // each time and can't overwrite in place, so say so rather than
      // implying the original file was updated.
      toast(result.path === null ? `Downloaded ${result.name}` : `Saved ${result.name}`);
      return true;
    } catch (err) {
      toast(`Save failed: ${this.describe(err)}`, true);
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
        toast(`Export failed: ${this.describe(err)}`, true);
      }
    });
  }

  async quickExport(format: "png" | "svg" | "pdf"): Promise<void> {
    try {
      await runExport(this.editor.doc, { format, scale: 2, margin: 20 });
      toast(`Exported as ${format.toUpperCase()}`);
    } catch (err) {
      toast(`Export failed: ${this.describe(err)}`, true);
    }
  }

  async copyAsPNG(): Promise<void> {
    try {
      const ids = this.editor.selection.size > 0 ? new Set(this.editor.selection) : undefined;
      await copyPNGToClipboard(this.editor.doc, { ids, margin: 12 });
      toast("Copied image to clipboard");
    } catch (err) {
      toast(`Copy failed: ${this.describe(err)}`, true);
    }
  }

  async copyAsSVG(): Promise<void> {
    try {
      const ids = this.editor.selection.size > 0 ? new Set(this.editor.selection) : undefined;
      await copySVGToClipboard(this.editor.doc, { ids, margin: 12 });
      toast("Copied SVG to clipboard");
    } catch (err) {
      toast(`Copy failed: ${this.describe(err)}`, true);
    }
  }

  async importImage(): Promise<void> {
    const img = await openImageFile();
    if (!img) return;
    if (!isSafeImageDataUrl(img.dataUrl)) {
      toast("That image couldn't be imported (unsupported or oversized format).", true);
      return;
    }
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

  // Canvas settings are document content, so they go through the command
  // system (undoable, dirty-marking, autosave-eligible) like any other edit.
  toggleGrid(): void {
    const next = !this.editor.doc.canvas.gridVisible;
    this.editor.setCanvas({ gridVisible: next }, next ? "Show grid" : "Hide grid");
    this.view.refresh();
  }
  toggleSnapGrid(): void {
    this.editor.setCanvas(
      { snapToGrid: !this.editor.doc.canvas.snapToGrid },
      "Snap to grid"
    );
  }
  toggleSnapElement(): void {
    this.editor.setCanvas(
      { snapToElement: !this.editor.doc.canvas.snapToElement },
      "Snap to elements"
    );
  }
}
