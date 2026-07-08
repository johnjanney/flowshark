import type { Editor } from "../core/editor";
import { parseDoc, serializeDoc } from "../model/serialization";
import type { FlowDoc } from "../model/types";

const KEY = "flowshark.autosave";
const INTERVAL_MS = 15000;

interface AutosavePayload {
  when: string;
  filePath: string | null;
  content: string;
}

/**
 * Autosave to localStorage every INTERVAL_MS while the document is dirty.
 * This is best-effort recovery, not a substitute for saving — if it fails
 * (e.g. a large diagram with embedded images exceeds the browser's storage
 * quota), `onFailure` is called once so the caller can warn the user that
 * crash recovery is unavailable until they save manually, rather than
 * failing silently for the rest of the session.
 */
export function startAutosave(editor: Editor, onFailure?: (err: unknown) => void): void {
  let lastSaved = "";
  let warned = false;
  const tick = () => {
    if (!editor.dirty) return;
    try {
      const content = serializeDoc(editor.doc);
      if (content === lastSaved) return;
      const payload: AutosavePayload = {
        when: new Date().toISOString(),
        filePath: editor.filePath,
        content,
      };
      localStorage.setItem(KEY, JSON.stringify(payload));
      lastSaved = content;
    } catch (err) {
      if (!warned) {
        warned = true;
        onFailure?.(err);
      }
    }
  };
  setInterval(tick, INTERVAL_MS);
  window.addEventListener("beforeunload", tick);
}

export function clearAutosave(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}

/** Returns a recoverable document from a previous session, if any. */
export function checkRecovery(): { doc: FlowDoc; when: string; filePath: string | null } | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const payload = JSON.parse(raw) as AutosavePayload;
    const doc = parseDoc(payload.content);
    if (doc.shapes.length === 0 && doc.connectors.length === 0) return null;
    return { doc, when: payload.when, filePath: payload.filePath ?? null };
  } catch {
    return null;
  }
}
