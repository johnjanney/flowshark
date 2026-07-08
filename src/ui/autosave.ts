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

export function startAutosave(editor: Editor): void {
  let lastSaved = "";
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
    } catch {
      // best-effort only
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
