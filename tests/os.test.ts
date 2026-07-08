import { describe, expect, it } from "vitest";
import { formatShortcut } from "../src/platform/os";

describe("shortcut label formatting", () => {
  it("renders Mod as Ctrl on Windows/Linux", () => {
    expect(formatShortcut("Mod+N", false)).toBe("Ctrl+N");
    expect(formatShortcut("Mod+Shift+S", false)).toBe("Ctrl+Shift+S");
    expect(formatShortcut("Mod+Shift+]", false)).toBe("Ctrl+Shift+]");
  });

  it("renders Mod as ⌘ with Apple modifier ordering on macOS", () => {
    expect(formatShortcut("Mod+N", true)).toBe("⌘N");
    expect(formatShortcut("Mod+Shift+S", true)).toBe("⇧⌘S");
    expect(formatShortcut("Shift+Mod+S", true)).toBe("⇧⌘S");
    expect(formatShortcut("Mod+Shift+]", true)).toBe("⇧⌘]");
  });

  it("uppercases single letter keys on macOS", () => {
    expect(formatShortcut("Mod+z", true)).toBe("⌘Z");
  });

  it("handles punctuation keys, including a literal plus", () => {
    expect(formatShortcut("Mod++", false)).toBe("Ctrl++");
    expect(formatShortcut("Mod++", true)).toBe("⌘+");
    expect(formatShortcut("Mod+-", true)).toBe("⌘-");
    expect(formatShortcut("Mod+'", true)).toBe("⌘'");
    expect(formatShortcut("Mod+0", true)).toBe("⌘0");
  });

  it("leaves multi-character keys untouched", () => {
    expect(formatShortcut("F2", true)).toBe("F2");
    expect(formatShortcut("Esc", true)).toBe("Esc");
  });
});
