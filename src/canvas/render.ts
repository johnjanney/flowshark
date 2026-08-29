import type { Connector, FlowDoc, Rect, Shape } from "../model/types";
import { getShapeDef } from "../shapes/registry";
import { capSVG, routeConnector } from "../connectors/routing";
import { escapeXML, lineHeightPx, measureTextWidth, textSVG, wrapText } from "../core/text";
import {
  inflateRect,
  pointAlongPolyline,
  shapeBounds,
  unionRects,
} from "../core/geometry";
import { LIMITS } from "../model/limits";

export function dashArray(style: "solid" | "dashed" | "dotted", width: number): string {
  switch (style) {
    case "dashed":
      return `${width * 4} ${width * 3}`;
    case "dotted":
      return `${Math.max(0.1, width)} ${width * 2.5}`;
    default:
      return "";
  }
}

function fmt(n: number): string {
  return String(Math.round(n * 100) / 100);
}

/** Full SVG markup for one shape (outline + decorations + text). */
export function shapeSVG(s: Shape, forExport = false): string {
  if (s.hidden && forExport) return "";
  const def = getShapeDef(s.type);
  const d = def.path(s.w, s.h, s.cornerRadius);
  const deco = def.decoration ? def.decoration(s.w, s.h) : "";
  const dash = dashArray(s.stroke.style, s.stroke.width);

  const transform =
    `translate(${fmt(s.x)},${fmt(s.y)})` +
    (s.rotation
      ? ` rotate(${fmt(s.rotation)},${fmt(s.w / 2)},${fmt(s.h / 2)})`
      : "");

  let body = `<path d="${d}" fill="${escapeXML(s.fill.color)}" fill-opacity="${s.fill.opacity}"`;
  if (s.stroke.width > 0) {
    body += ` stroke="${escapeXML(s.stroke.color)}" stroke-width="${s.stroke.width}"`;
    if (dash) body += ` stroke-dasharray="${dash}"`;
  } else {
    body += ` stroke="none"`;
  }
  body += ` stroke-linejoin="round"/>`;

  if (s.type === "image-placeholder" && s.imageSrc) {
    body += `<image href="${escapeXML(s.imageSrc)}" x="0" y="0" width="${fmt(
      s.w
    )}" height="${fmt(s.h)}" preserveAspectRatio="xMidYMid meet"/>`;
  } else if (deco && s.stroke.width > 0) {
    body += `<path d="${deco}" fill="none" stroke="${escapeXML(s.stroke.color)}" stroke-width="${s.stroke.width}"${
      dash ? ` stroke-dasharray="${dash}"` : ""
    }/>`;
  }

  if (s.text) {
    const inset = def.textInset
      ? def.textInset(s.w, s.h)
      : { x: 0, y: 0, w: s.w, h: s.h };
    if (s.type === "phase") {
      // vertical header label rotated -90° in the left band
      const style = s.textStyle;
      body += `<text transform="rotate(-90 16 ${fmt(s.h / 2)})" x="16" y="${fmt(
        s.h / 2 + style.fontSize * 0.35
      )}" font-family="${escapeXML(style.fontFamily)}" font-size="${style.fontSize}"${
        style.bold ? ' font-weight="700"' : ""
      } fill="${escapeXML(style.color)}" text-anchor="middle">${escapeXML(s.text)}</text>`;
    } else {
      body += textSVG(s.text, s.textStyle, inset, s.textPadding);
    }
  }

  return `<g data-id="${escapeXML(s.id)}" data-kind="shape" transform="${transform}"${
    s.hidden ? ' opacity="0.25"' : ""
  }>${body}</g>`;
}

/** Full SVG markup for one connector (path + caps + labels). */
export function connectorSVG(doc: FlowDoc, c: Connector, forExport = false): string {
  if (c.hidden && forExport) return "";
  const route = routeConnector(doc, c);
  const dash = dashArray(c.stroke.style, c.stroke.width);
  const poly = route.polyline;

  let body =
    `<path d="${route.d}" fill="none" stroke="${escapeXML(c.stroke.color)}" ` +
    `stroke-width="${c.stroke.width}"${dash ? ` stroke-dasharray="${dash}"` : ""} ` +
    `stroke-linecap="round" stroke-linejoin="round"/>`;
  // invisible wide path for easy hit-testing on screen
  if (!forExport) {
    body += `<path d="${route.d}" fill="none" stroke="transparent" stroke-width="${Math.max(
      12,
      c.stroke.width + 8
    )}" data-hit="1"/>`;
  }

  if (poly.length >= 2) {
    if (c.endCap !== "none") {
      const a = poly[poly.length - 2];
      const b = poly[poly.length - 1];
      body += capSVG(
        b,
        { x: b.x - a.x, y: b.y - a.y },
        c.endCap,
        c.stroke.color,
        c.stroke.width
      );
    }
    if (c.startCap !== "none") {
      const a = poly[1];
      const b = poly[0];
      body += capSVG(
        b,
        { x: b.x - a.x, y: b.y - a.y },
        c.startCap,
        c.stroke.color,
        c.stroke.width
      );
    }
  }

  for (const label of c.labels) {
    if (!label.text) continue;
    const { point, dir } = pointAlongPolyline(poly, label.t);
    const perp = { x: -dir.y, y: dir.x };
    const cx = point.x + perp.x * label.offset;
    const cy = point.y + perp.y * label.offset;
    const lines = wrapText(label.text, label.style, 220);
    const lh = lineHeightPx(label.style);
    const wMax = Math.max(...lines.map((l) => measureTextWidth(l, label.style)), 8);
    const totalH = lines.length * lh;
    const pad = 3;
    const labelId = escapeXML(label.id);
    if (label.background) {
      body += `<rect data-label-id="${labelId}" x="${fmt(cx - wMax / 2 - pad)}" y="${fmt(
        cy - totalH / 2 - pad
      )}" width="${fmt(wMax + pad * 2)}" height="${fmt(totalH + pad * 2)}" rx="3" fill="${escapeXML(
        label.background
      )}"${label.border ? ` stroke="${escapeXML(label.border)}" stroke-width="1"` : ""}/>`;
    } else if (label.border) {
      body += `<rect data-label-id="${labelId}" x="${fmt(cx - wMax / 2 - pad)}" y="${fmt(
        cy - totalH / 2 - pad
      )}" width="${fmt(wMax + pad * 2)}" height="${fmt(totalH + pad * 2)}" rx="3" fill="none" stroke="${escapeXML(
        label.border
      )}" stroke-width="1"/>`;
    }
    body += `<g data-label-id="${labelId}">${textSVG(
      label.text,
      { ...label.style, align: "center", valign: "middle" },
      { x: cx - wMax / 2, y: cy - totalH / 2, w: wMax, h: totalH },
      0
    )}</g>`;
  }

  return `<g data-id="${escapeXML(c.id)}" data-kind="connector" opacity="${c.opacity}"${
    c.hidden ? ' style="opacity:0.25"' : ""
  }>${body}</g>`;
}

/** All document content sorted by z-index, as SVG markup (no outer <svg>). */
export function docContentSVG(doc: FlowDoc, forExport = false, onlyIds?: Set<string>): string {
  const items: Array<{ z: number; seq: number; svg: () => string }> = [];
  let seq = 0;
  for (const s of doc.shapes) {
    if (onlyIds && !onlyIds.has(s.id)) continue;
    if (s.hidden && forExport) continue;
    items.push({ z: s.zIndex, seq: seq++, svg: () => shapeSVG(s, forExport) });
  }
  for (const c of doc.connectors) {
    if (onlyIds && !onlyIds.has(c.id)) continue;
    if (c.hidden && forExport) continue;
    items.push({ z: c.zIndex, seq: seq++, svg: () => connectorSVG(doc, c, forExport) });
  }
  items.sort((a, b) => a.z - b.z || a.seq - b.seq);
  return items.map((i) => i.svg()).join("\n");
}

/** Bounding box of document content (or a subset). */
export function contentBounds(doc: FlowDoc, onlyIds?: Set<string>): Rect {
  const rects: Rect[] = [];
  for (const s of doc.shapes) {
    if (onlyIds && !onlyIds.has(s.id)) continue;
    if (s.hidden) continue;
    rects.push(shapeBounds(s));
  }
  for (const c of doc.connectors) {
    if (onlyIds && !onlyIds.has(c.id)) continue;
    if (c.hidden) continue;
    const route = routeConnector(doc, c);
    for (const p of route.polyline) rects.push({ x: p.x, y: p.y, w: 0, h: 0 });
  }
  if (rects.length === 0) return { x: 0, y: 0, w: 800, h: 600 };
  return unionRects(rects);
}

/**
 * One-sentence description of a diagram's content, used as the exported
 * SVG's accessible description. Lists the first few labelled shapes so the
 * description says something about *this* diagram rather than just counting.
 */
function summarizeContent(
  doc: FlowDoc,
  ids: Set<string> | undefined,
  shapeCount: number,
  connectorCount: number
): string {
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
  const labels = doc.shapes
    .filter((s) => (!ids || ids.has(s.id)) && !s.hidden && s.text.trim())
    .slice(0, 8)
    .map((s) => s.text.trim().replace(/\s+/g, " ").slice(0, 40));
  const head = `Flowchart with ${plural(shapeCount, "shape")} and ${plural(
    connectorCount,
    "connector"
  )}.`;
  if (labels.length === 0) return head;
  const more = shapeCount > labels.length ? ", and others" : "";
  return `${head} Labelled shapes: ${labels.join("; ")}${more}.`;
}

export interface ExportSVGOptions {
  /** export only these element ids (default: everything) */
  ids?: Set<string>;
  transparent?: boolean;
  includeGrid?: boolean;
  margin?: number;
  /** multiply output dimensions (viewBox stays in doc units) */
  scale?: number;
}

/**
 * Grid lines covering `area`. The line count is a function of area size over
 * grid size, and `area` can come from document content — a shape parked at a
 * far-away coordinate produces a bounding box millions of units wide, which
 * at a 2-unit grid would be millions of path segments. The step is widened
 * until the grid fits LIMITS.maxGridLines, so a hostile or accidental
 * document degrades to a coarser grid instead of hanging the renderer.
 */
export function gridSVG(doc: FlowDoc, area: Rect): string {
  let size = doc.canvas.gridSize;
  const needed = (step: number) => area.w / step + area.h / step + 2;
  if (!Number.isFinite(size) || size <= 0) size = 20;
  if (needed(size) > LIMITS.maxGridLines) {
    size = (area.w + area.h) / Math.max(1, LIMITS.maxGridLines - 2);
  }
  if (!Number.isFinite(size) || size <= 0) return "";
  let lines = "";
  const x0 = Math.floor(area.x / size) * size;
  const y0 = Math.floor(area.y / size) * size;
  for (let x = x0; x <= area.x + area.w; x += size) {
    lines += `M${fmt(x)},${fmt(area.y)} L${fmt(x)},${fmt(area.y + area.h)} `;
  }
  for (let y = y0; y <= area.y + area.h; y += size) {
    lines += `M${fmt(area.x)},${fmt(y)} L${fmt(area.x + area.w)},${fmt(y)} `;
  }
  return `<path d="${lines.trim()}" stroke="#94a3b8" stroke-opacity="0.25" stroke-width="1" fill="none"/>`;
}

/** Produce a standalone SVG string for export. */
export function exportSVG(
  doc: FlowDoc,
  opts: ExportSVGOptions = {}
): { svg: string; width: number; height: number; bounds: Rect } {
  const margin = opts.margin ?? 20;
  const scale = opts.scale ?? 1;
  const bounds = inflateRect(contentBounds(doc, opts.ids), margin);
  const width = Math.max(1, Math.round(bounds.w * scale));
  const height = Math.max(1, Math.round(bounds.h * scale));

  let inner = "";
  if (!opts.transparent) {
    inner += `<rect x="${fmt(bounds.x)}" y="${fmt(bounds.y)}" width="${fmt(
      bounds.w
    )}" height="${fmt(bounds.h)}" fill="${escapeXML(doc.canvas.background)}"/>`;
  }
  if (opts.includeGrid) inner += gridSVG(doc, bounds);
  inner += docContentSVG(doc, true, opts.ids);

  // An exported diagram is a standalone document that someone may open in a
  // browser or embed in a page, so give it an accessible name and description
  // (brief §8.14, "alt text for exported diagrams"). role="img" plus
  // aria-labelledby is what assistive technology actually reads.
  const shapeCount = opts.ids
    ? doc.shapes.filter((s) => opts.ids!.has(s.id) && !s.hidden).length
    : doc.shapes.filter((s) => !s.hidden).length;
  const connectorCount = opts.ids
    ? doc.connectors.filter((c) => opts.ids!.has(c.id) && !c.hidden).length
    : doc.connectors.filter((c) => !c.hidden).length;
  const described = summarizeContent(doc, opts.ids, shapeCount, connectorCount);

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" ` +
    `viewBox="${fmt(bounds.x)} ${fmt(bounds.y)} ${fmt(bounds.w)} ${fmt(bounds.h)}" ` +
    `role="img" aria-labelledby="fs-title fs-desc">` +
    `<title id="fs-title">${escapeXML(doc.title)}</title>` +
    `<desc id="fs-desc">${escapeXML(described)}</desc>` +
    inner +
    `</svg>`;
  return { svg, width, height, bounds };
}
