import type { TextStyle } from "../model/types";

/**
 * Text measurement. In the browser we use an offscreen canvas; in node
 * (unit tests) we fall back to a width heuristic so layout code stays
 * deterministic and testable.
 */

let ctx: CanvasRenderingContext2D | null = null;

function fontString(style: TextStyle): string {
  return `${style.italic ? "italic " : ""}${style.bold ? "700" : "400"} ${
    style.fontSize
  }px ${style.fontFamily}`;
}

export function measureTextWidth(text: string, style: TextStyle): number {
  if (typeof document !== "undefined") {
    if (!ctx) {
      const canvas = document.createElement("canvas");
      ctx = canvas.getContext("2d");
    }
    if (ctx) {
      ctx.font = fontString(style);
      return ctx.measureText(text).width;
    }
  }
  // Heuristic fallback: average glyph width ~0.55em, bold ~0.6em.
  return text.length * style.fontSize * (style.bold ? 0.6 : 0.55);
}

/** Wrap text into lines that fit maxWidth. Honors explicit newlines. */
export function wrapText(text: string, style: TextStyle, maxWidth: number): string[] {
  const out: string[] = [];
  for (const para of text.split("\n")) {
    if (para === "") {
      out.push("");
      continue;
    }
    const words = para.split(/(\s+)/).filter((w) => w.length > 0);
    let line = "";
    for (const word of words) {
      const candidate = line + word;
      if (line !== "" && measureTextWidth(candidate.trimEnd(), style) > maxWidth) {
        out.push(line.trimEnd());
        line = word.trimStart();
      } else {
        line = candidate;
      }
      // hard-break if the current line alone is too long (very long words).
      // The cut point is found by binary search rather than by walking back
      // one character at a time: a linear scan makes this O(n^2) text
      // measurements for a long unbroken run, which an untrusted document
      // (or a paste of machine-generated text) can turn into a hang.
      while (
        measureTextWidth(line.trimEnd(), style) > maxWidth &&
        line.trim().length > 1
      ) {
        let lo = 1;
        let hi = line.length - 1;
        let cut = 1;
        while (lo <= hi) {
          const mid = (lo + hi) >> 1;
          if (measureTextWidth(line.slice(0, mid), style) <= maxWidth) {
            cut = mid;
            lo = mid + 1;
          } else {
            hi = mid - 1;
          }
        }
        out.push(line.slice(0, cut));
        line = line.slice(cut);
      }
    }
    out.push(line.trimEnd());
  }
  return out;
}

export function lineHeightPx(style: TextStyle): number {
  return style.fontSize * style.lineHeight;
}

const XML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&apos;",
};

export function escapeXML(s: string): string {
  return s.replace(/[&<>"']/g, (c) => XML_ESCAPES[c]);
}

/**
 * Render wrapped text as SVG <text> markup inside the given box.
 */
export function textSVG(
  text: string,
  style: TextStyle,
  box: { x: number; y: number; w: number; h: number },
  padding = 0
): string {
  if (!text) return "";
  const inner = {
    x: box.x + padding,
    y: box.y + padding,
    w: Math.max(4, box.w - padding * 2),
    h: Math.max(4, box.h - padding * 2),
  };
  const lines = wrapText(text, style, inner.w);
  const lh = lineHeightPx(style);
  const totalH = lines.length * lh;

  let startY: number;
  switch (style.valign) {
    case "top":
      startY = inner.y + style.fontSize;
      break;
    case "bottom":
      startY = inner.y + inner.h - totalH + style.fontSize;
      break;
    default:
      startY = inner.y + (inner.h - totalH) / 2 + style.fontSize * 0.85;
  }

  let anchor: string;
  let tx: number;
  switch (style.align) {
    case "left":
      anchor = "start";
      tx = inner.x;
      break;
    case "right":
      anchor = "end";
      tx = inner.x + inner.w;
      break;
    default:
      anchor = "middle";
      tx = inner.x + inner.w / 2;
  }

  const decoration = style.underline ? ' text-decoration="underline"' : "";
  const weight = style.bold ? ' font-weight="700"' : "";
  const italic = style.italic ? ' font-style="italic"' : "";

  const spans = lines
    .map(
      (line, i) =>
        `<tspan x="${fmt(tx)}" y="${fmt(startY + i * lh)}">${
          line === "" ? " " : escapeXML(line)
        }</tspan>`
    )
    .join("");

  return (
    `<text font-family="${escapeXML(style.fontFamily)}" font-size="${style.fontSize}"` +
    `${weight}${italic}${decoration} fill="${escapeXML(style.color)}" text-anchor="${anchor}">` +
    spans +
    `</text>`
  );
}

function fmt(n: number): string {
  return String(Math.round(n * 100) / 100);
}
