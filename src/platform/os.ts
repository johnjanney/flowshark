/**
 * Platform detection and platform-aware shortcut labels. FlowShark binds
 * every "Ctrl" shortcut to Ctrl *or* Cmd (see ui/shortcuts.ts), so on macOS
 * the UI should advertise the Cmd variants with the conventional symbols.
 */

export const isMac: boolean =
  typeof navigator !== "undefined" &&
  /mac/i.test(
    (navigator as { userAgentData?: { platform?: string } }).userAgentData
      ?.platform ??
      navigator.platform ??
      ""
  );

const MAC_SYMBOLS: Record<string, string> = {
  Ctrl: "⌃",
  Alt: "⌥",
  Shift: "⇧",
  Mod: "⌘",
};

/** Apple's canonical modifier display order: Control, Option, Shift, Command. */
const MAC_ORDER = ["Ctrl", "Alt", "Shift", "Mod"];

/**
 * Format a shortcut spec for a given platform. Specs use "Mod" for the
 * primary modifier, e.g. "Mod+Shift+S" → "Ctrl+Shift+S" on Windows/Linux,
 * "⇧⌘S" on macOS. Exported for tests; app code uses `shortcut()`.
 */
export function formatShortcut(spec: string, mac: boolean): string {
  const mods: string[] = [];
  let key = spec;
  for (;;) {
    const m = /^(Mod|Ctrl|Shift|Alt)\+(.+)$/.exec(key);
    if (!m) break;
    mods.push(m[1]);
    key = m[2];
  }
  if (!mac) {
    return [...mods.map((m) => (m === "Mod" ? "Ctrl" : m)), key].join("+");
  }
  const symbols = MAC_ORDER.filter((m) => mods.includes(m)).map(
    (m) => MAC_SYMBOLS[m]
  );
  return symbols.join("") + (key.length === 1 ? key.toUpperCase() : key);
}

/** Format a shortcut spec for the current platform. */
export function shortcut(spec: string): string {
  return formatShortcut(spec, isMac);
}

/** Redo is Ctrl+Y on Windows/Linux but conventionally ⇧⌘Z on macOS. */
export function redoShortcut(): string {
  return isMac ? shortcut("Mod+Shift+Z") : shortcut("Mod+Y");
}
