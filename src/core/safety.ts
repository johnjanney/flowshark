/**
 * Sanitization helpers for values that originate from an untrusted
 * `.flowshark` file and later get interpolated into SVG markup.
 *
 * These are deliberately strict allowlists rather than blocklists: a
 * malformed/unexpected value falls back to a safe default instead of being
 * passed through. Used at the document-parse boundary (serialization.ts) as
 * defense in depth alongside XML-escaping every value at render time.
 */

const SAFE_COLOR_RE =
  /^(transparent|currentColor|#[0-9a-fA-F]{3,8}|rgba?\(\s*[\d.]+%?\s*,\s*[\d.]+%?\s*,\s*[\d.]+%?\s*(,\s*[\d.]+\s*)?\)|hsla?\(\s*[\d.]+\s*,\s*[\d.]+%\s*,\s*[\d.]+%\s*(,\s*[\d.]+\s*)?\)|[a-zA-Z]{3,20})$/;

/** Restrict a color-like string to safe CSS color syntax, or fall back. */
export function safeColor(input: unknown, fallback: string): string {
  if (typeof input !== "string") return fallback;
  const trimmed = input.trim();
  if (trimmed.length === 0 || trimmed.length > 64) return fallback;
  return SAFE_COLOR_RE.test(trimmed) ? trimmed : fallback;
}

const SAFE_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

/** True if a string is safe to use as an element id / data-id attribute. */
export function isSafeId(input: unknown): input is string {
  return typeof input === "string" && SAFE_ID_RE.test(input);
}

/**
 * Raster-only data: URL check, shared by the document sanitizer
 * (src/model/serialization.ts, for opened files) and by every live entry
 * point that creates an image-placeholder shape (import dialog, clipboard
 * paste), so an SVG can't reach the renderer through any of those paths.
 * SVG is excluded because sanitizing arbitrary attacker-controlled SVG
 * markup correctly needs a real XML/DOM sanitizer, which this app doesn't
 * bundle yet (see OPENQUESTIONS.md).
 */
const SAFE_IMAGE_DATA_URL_RE = /^data:image\/(png|jpe?g|gif|webp|bmp);base64,[A-Za-z0-9+/=]+$/;

export function isSafeImageDataUrl(input: unknown): input is string {
  return typeof input === "string" && input.length <= 8_000_000 && SAFE_IMAGE_DATA_URL_RE.test(input);
}
