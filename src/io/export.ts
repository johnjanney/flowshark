import type { FlowDoc } from "../model/types";
import { exportSVG, type ExportSVGOptions } from "../canvas/render";
import { saveBinaryFile } from "../platform/fileio";
import { LIMITS } from "../model/limits";

/** Raised when an export would exceed the supported raster size. */
export class ExportSizeError extends Error {}

/**
 * Pixel dimensions for a raster export, refused if they exceed what a browser
 * canvas can hold. Without this check an oversized diagram (or one whose
 * coordinates came from an untrusted file) silently produces a blank or
 * null-blob export, because canvas allocation fails without throwing.
 */
export function rasterDimensions(
  boundsW: number,
  boundsH: number,
  scale: number
): { width: number; height: number } {
  const width = Math.max(1, Math.round(boundsW * scale));
  const height = Math.max(1, Math.round(boundsH * scale));
  if (
    width > LIMITS.maxExportEdge ||
    height > LIMITS.maxExportEdge ||
    width * height > LIMITS.maxExportPixels
  ) {
    throw new ExportSizeError(
      `This export would be ${width}×${height} pixels, which is larger than FlowShark can ` +
        `render (limit ${LIMITS.maxExportEdge} px per side, ` +
        `${Math.round(LIMITS.maxExportPixels / 1e6)} megapixels total). ` +
        `Export a smaller selection or reduce the scale.`
    );
  }
  return { width, height };
}

export interface ExportOptions extends ExportSVGOptions {
  format: "png" | "svg" | "pdf" | "jpeg" | "webp";
  fileName?: string;
}

function baseName(doc: FlowDoc): string {
  return (doc.title || "flowchart").replace(/[\\/:*?"<>|]+/g, "_");
}

/** Render the export SVG to a raster blob via an offscreen canvas. */
export async function rasterize(
  doc: FlowDoc,
  opts: ExportSVGOptions,
  mime: "image/png" | "image/jpeg" | "image/webp"
): Promise<Blob> {
  const scale = opts.scale ?? 2;
  const { svg, bounds } = exportSVG(doc, { ...opts, scale: 1 });
  const { width, height } = rasterDimensions(bounds.w, bounds.h, scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");
  if (mime !== "image/png" && !opts.transparent) {
    ctx.fillStyle = doc.canvas.background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Failed to render SVG for export"));
      img.src = url;
    });
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  } finally {
    URL.revokeObjectURL(url);
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Export failed"))),
      mime,
      0.95
    );
  });
}

export async function exportToPDF(doc: FlowDoc, opts: ExportSVGOptions): Promise<Blob> {
  const { svg, bounds } = exportSVG(doc, { ...opts, scale: 1 });
  const { jsPDF } = await import("jspdf");
  await import("svg2pdf.js");
  const pdf = new jsPDF({
    orientation: bounds.w >= bounds.h ? "landscape" : "portrait",
    unit: "pt",
    format: [bounds.w, bounds.h],
  });
  const holder = document.createElement("div");
  holder.innerHTML = svg;
  const el = holder.firstElementChild as SVGSVGElement;
  // svg2pdf needs the element in the DOM for text measurement
  holder.style.position = "fixed";
  holder.style.left = "-10000px";
  document.body.appendChild(holder);
  try {
    await (pdf as any).svg(el, { x: 0, y: 0, width: bounds.w, height: bounds.h });
  } finally {
    holder.remove();
  }
  return pdf.output("blob");
}

/** Run a full export and save the result to disk. */
export async function runExport(doc: FlowDoc, opts: ExportOptions): Promise<void> {
  const name = opts.fileName ?? baseName(doc);
  switch (opts.format) {
    case "svg": {
      const { svg } = exportSVG(doc, opts);
      await saveBinaryFile(
        new Blob([svg], { type: "image/svg+xml" }),
        `${name}.svg`,
        "SVG image",
        "svg"
      );
      break;
    }
    case "png": {
      const blob = await rasterize(doc, opts, "image/png");
      await saveBinaryFile(blob, `${name}.png`, "PNG image", "png");
      break;
    }
    case "jpeg": {
      const blob = await rasterize(doc, { ...opts, transparent: false }, "image/jpeg");
      await saveBinaryFile(blob, `${name}.jpg`, "JPEG image", "jpg");
      break;
    }
    case "webp": {
      const blob = await rasterize(doc, opts, "image/webp");
      await saveBinaryFile(blob, `${name}.webp`, "WebP image", "webp");
      break;
    }
    case "pdf": {
      const blob = await exportToPDF(doc, opts);
      await saveBinaryFile(blob, `${name}.pdf`, "PDF document", "pdf");
      break;
    }
  }
}

export async function copyPNGToClipboard(doc: FlowDoc, opts: ExportSVGOptions): Promise<void> {
  const blob = await rasterize(doc, { scale: 2, ...opts }, "image/png");
  await navigator.clipboard.write([
    new ClipboardItem({ "image/png": blob }),
  ]);
}

export async function copySVGToClipboard(doc: FlowDoc, opts: ExportSVGOptions): Promise<void> {
  const { svg } = exportSVG(doc, opts);
  await navigator.clipboard.writeText(svg);
}
