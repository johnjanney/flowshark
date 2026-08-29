/**
 * Resource limits for untrusted `.flowshark` documents and for export.
 *
 * A `.flowshark` file is ordinary JSON that a user can receive from anyone,
 * so the parser must not let a hostile or corrupt file exhaust memory or CPU.
 * Finiteness checks alone are not enough: a shape at x = 1e300, a 500 MB
 * document, a 40-million-character label, or a connector with a million bend
 * points all parse cleanly and then wedge the renderer, the routing code, the
 * 200-entry undo stack (which deep-clones the whole document), or the export
 * canvas allocator.
 *
 * The caps below are deliberately far above anything a real diagram needs —
 * they exist to turn "the app hangs" into "the app opens a slightly repaired
 * document, or refuses the file with a clear message".
 */
export const LIMITS = {
  /** Largest `.flowshark` file accepted, in UTF-16 code units of JSON text. */
  maxDocumentChars: 32 * 1024 * 1024,
  maxShapes: 20_000,
  maxConnectors: 20_000,
  maxGroups: 5_000,
  maxGroupMembers: 20_000,
  maxPointsPerConnector: 2_000,
  maxLabelsPerConnector: 100,
  /** Longest text body on a shape or connector label. */
  maxTextLength: 20_000,
  maxTitleLength: 1_000,
  maxFontFamilyLength: 200,
  /** Absolute bound on any document coordinate. */
  maxCoordinate: 1e7,
  /** Absolute bound on a shape width/height. */
  maxDimension: 1e6,
  minFontSize: 1,
  maxFontSize: 2_000,
  maxStrokeWidth: 1_000,
  maxCornerRadius: 1e5,
  maxTextPadding: 1e4,
  minGridSize: 2,
  maxGridSize: 1_000,
  minSnapTolerance: 1,
  maxSnapTolerance: 500,
  maxZIndex: 1e9,
  minLineHeight: 0.5,
  maxLineHeight: 20,
  maxLabelOffset: 1e5,
  /**
   * Largest raster export, in pixels. Browsers cap canvas area anyway
   * (Chromium ~268 MP, Safari far lower); refusing above 80 MP turns an
   * opaque allocation failure into a clear message.
   */
  maxExportPixels: 80_000_000,
  /** Largest single raster export edge, in pixels. */
  maxExportEdge: 20_000,
  /** Largest number of grid lines drawn in one pass. */
  maxGridLines: 4_000,
} as const;

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/** Clamp a document coordinate into the supported range. */
export function clampCoord(v: number): number {
  return clamp(v, -LIMITS.maxCoordinate, LIMITS.maxCoordinate);
}

/** Clamp a shape width/height (always at least 1 unit). */
export function clampDimension(v: number): number {
  return clamp(v, 1, LIMITS.maxDimension);
}

export function clampFontSize(v: number): number {
  return clamp(v, LIMITS.minFontSize, LIMITS.maxFontSize);
}

export function clampStrokeWidth(v: number): number {
  return clamp(v, 0, LIMITS.maxStrokeWidth);
}

export function clampGridSize(v: number): number {
  return clamp(v, LIMITS.minGridSize, LIMITS.maxGridSize);
}

export function clampSnapTolerance(v: number): number {
  return clamp(v, LIMITS.minSnapTolerance, LIMITS.maxSnapTolerance);
}

export function clampZIndex(v: number): number {
  return clamp(v, -LIMITS.maxZIndex, LIMITS.maxZIndex);
}

export function clampLineHeight(v: number): number {
  return clamp(v, LIMITS.minLineHeight, LIMITS.maxLineHeight);
}

export function clampRotation(v: number): number {
  // normalize to (-360, 360) so a huge value can't blow up trig-heavy paths
  const r = v % 360;
  return Number.isFinite(r) ? r : 0;
}

/** Truncate an untrusted string to a maximum length. */
export function clampText(v: string, max: number): string {
  return v.length > max ? v.slice(0, max) : v;
}

/** Non-negative clamp with an upper bound (radii, padding, offsets). */
export function clampNonNegative(v: number, max: number): number {
  return clamp(v, 0, max);
}

export function clampSigned(v: number, max: number): number {
  return clamp(v, -max, max);
}
