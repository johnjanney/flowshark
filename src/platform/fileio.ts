/**
 * File I/O abstraction. Uses Tauri dialogs + fs when running inside the
 * Tauri shell (Windows ARM / x64 desktop builds); falls back to the File
 * System Access API or plain downloads when running in a browser.
 */

export function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export interface OpenedFile {
  content: string;
  path: string | null;
  name: string;
}

export interface SaveResult {
  path: string | null;
  name: string;
}

const EXT = "flowshark";

// Browser-only: keep FileSystemFileHandles so "Save" can overwrite in place.
const handles = new Map<string, FileSystemFileHandle>();
let handleCounter = 0;

export async function openTextFile(): Promise<OpenedFile | null> {
  if (isTauri()) {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const { readTextFile } = await import("@tauri-apps/plugin-fs");
    const path = await open({
      multiple: false,
      filters: [
        { name: "FlowShark diagram", extensions: [EXT, "json"] },
      ],
    });
    if (!path || typeof path !== "string") return null;
    const content = await readTextFile(path);
    return { content, path, name: basename(path) };
  }
  if ("showOpenFilePicker" in window) {
    try {
      const [handle] = await (window as any).showOpenFilePicker({
        types: [
          {
            description: "FlowShark diagram",
            accept: { "application/json": [`.${EXT}`, ".json"] },
          },
        ],
      });
      const file = await handle.getFile();
      const key = `handle:${handleCounter++}`;
      handles.set(key, handle);
      return { content: await file.text(), path: key, name: file.name };
    } catch {
      return null;
    }
  }
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = `.${EXT},.json`;
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      resolve({ content: await file.text(), path: null, name: file.name });
    };
    input.oncancel = () => resolve(null);
    input.click();
  });
}

/** Save text to a known path (Save) or prompt (Save As). Returns null if cancelled. */
export async function saveTextFile(
  content: string,
  suggestedName: string,
  existingPath: string | null,
  forcePrompt = false
): Promise<SaveResult | null> {
  if (isTauri()) {
    const { save } = await import("@tauri-apps/plugin-dialog");
    const { writeTextFile } = await import("@tauri-apps/plugin-fs");
    let path = existingPath;
    if (!path || forcePrompt) {
      path = await save({
        defaultPath: suggestedName.endsWith(`.${EXT}`)
          ? suggestedName
          : `${suggestedName}.${EXT}`,
        filters: [{ name: "FlowShark diagram", extensions: [EXT] }],
      });
    }
    if (!path) return null;
    await writeTextFile(path, content);
    return { path, name: basename(path) };
  }

  // Browser with File System Access API
  if ("showSaveFilePicker" in window) {
    let handle = existingPath && !forcePrompt ? handles.get(existingPath) : undefined;
    if (!handle) {
      try {
        handle = await (window as any).showSaveFilePicker({
          suggestedName: suggestedName.endsWith(`.${EXT}`)
            ? suggestedName
            : `${suggestedName}.${EXT}`,
          types: [
            {
              description: "FlowShark diagram",
              accept: { "application/json": [`.${EXT}`] },
            },
          ],
        });
      } catch {
        return null;
      }
    }
    if (!handle) return null;
    const writable = await handle.createWritable();
    await writable.write(content);
    await writable.close();
    const key = existingPath && handles.has(existingPath) && !forcePrompt
      ? existingPath
      : `handle:${handleCounter++}`;
    handles.set(key, handle);
    return { path: key, name: handle.name };
  }

  // Last resort: download
  downloadBlob(
    new Blob([content], { type: "application/json" }),
    suggestedName.endsWith(`.${EXT}`) ? suggestedName : `${suggestedName}.${EXT}`
  );
  return { path: null, name: suggestedName };
}

/** Save binary data (exports). Returns true unless cancelled. */
export async function saveBinaryFile(
  data: Uint8Array | Blob,
  suggestedName: string,
  filterName: string,
  extension: string
): Promise<boolean> {
  if (isTauri()) {
    const { save } = await import("@tauri-apps/plugin-dialog");
    const { writeFile } = await import("@tauri-apps/plugin-fs");
    const path = await save({
      defaultPath: suggestedName,
      filters: [{ name: filterName, extensions: [extension] }],
    });
    if (!path) return false;
    const bytes =
      data instanceof Blob ? new Uint8Array(await data.arrayBuffer()) : data;
    await writeFile(path, bytes);
    return true;
  }
  const blob = data instanceof Blob ? data : new Blob([data as BlobPart]);
  downloadBlob(blob, suggestedName);
  return true;
}

export async function openImageFile(): Promise<{ dataUrl: string; name: string } | null> {
  const toDataUrl = (file: File | Blob): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  if (isTauri()) {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const { readFile } = await import("@tauri-apps/plugin-fs");
    const path = await open({
      multiple: false,
      filters: [
        { name: "Images", extensions: ["png", "jpg", "jpeg", "webp", "svg"] },
      ],
    });
    if (!path || typeof path !== "string") return null;
    const bytes = await readFile(path);
    const ext = path.split(".").pop()?.toLowerCase() ?? "png";
    const mime =
      ext === "svg" ? "image/svg+xml" : ext === "jpg" ? "image/jpeg" : `image/${ext}`;
    const blob = new Blob([bytes as unknown as BlobPart], { type: mime });
    return { dataUrl: await toDataUrl(blob), name: basename(path) };
  }
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/png,image/jpeg,image/webp,image/svg+xml";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      resolve({ dataUrl: await toDataUrl(file), name: file.name });
    };
    input.oncancel = () => resolve(null);
    input.click();
  });
}

function downloadBlob(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

function basename(path: string): string {
  return path.split(/[\\/]/).pop() ?? path;
}

// ----- recent files ---------------------------------------------------------

export interface RecentFile {
  path: string;
  name: string;
  when: string;
}

const RECENT_KEY = "flowshark.recentFiles";

export function getRecentFiles(): RecentFile[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list.slice(0, 10) : [];
  } catch {
    return [];
  }
}

export function addRecentFile(path: string | null, name: string): void {
  if (!path || path.startsWith("handle:")) return; // browser handles aren't persistable
  const list = getRecentFiles().filter((r) => r.path !== path);
  list.unshift({ path, name, when: new Date().toISOString() });
  localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, 10)));
}

export async function openRecentFile(path: string): Promise<OpenedFile | null> {
  if (!isTauri()) return null;
  const { readTextFile } = await import("@tauri-apps/plugin-fs");
  const content = await readTextFile(path);
  return { content, path, name: basename(path) };
}
