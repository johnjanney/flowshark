import { describe, expect, it } from "vitest";
import { exportSVG, shapeSVG, contentBounds } from "../src/canvas/render";
import { newDoc, newShape, newConnector, attachedEnd, newLabel } from "../src/model/defaults";
import { wrapText } from "../src/core/text";
import { defaultTextStyle } from "../src/model/defaults";
import { SHAPE_DEFS } from "../src/shapes/registry";
import { TEMPLATES } from "../src/templates";
import type { ShapeType } from "../src/model/types";

describe("SVG rendering", () => {
  it("renders every registered shape type without crashing", () => {
    for (const type of Object.keys(SHAPE_DEFS) as ShapeType[]) {
      const s = newShape(type, 10, 10, 1);
      s.text = "Label";
      const svg = shapeSVG(s);
      expect(svg).toContain(`data-id="${s.id}"`);
      expect(svg).toContain("<path");
    }
  });

  it("escapes XML in text content", () => {
    const s = newShape("process", 0, 0, 1);
    s.text = `<script>alert("x")</script> & more`;
    const svg = shapeSVG(s);
    expect(svg).not.toContain("<script>");
    expect(svg).toContain("&lt;script&gt;");
    expect(svg).toContain("&amp; more");
  });

  it("escapes attribute-breaking payloads in fill/stroke/id even if they bypass the sanitizer", () => {
    // Render-layer defense in depth: shapeSVG() must not trust that its
    // caller already validated these fields (see src/model/serialization.ts
    // for the sanitizer that normally prevents this input from occurring).
    // A safe render neutralizes the payload into inert attribute text (the
    // raw `"` becomes `&quot;`) rather than stripping it — so the assertion
    // is "no unescaped quote reopens attribute context", not "the words are
    // gone".
    const s = newShape("process", 0, 0, 1);
    const payload = 'red" onmouseover="alert(document.cookie)';
    s.fill.color = payload;
    s.stroke.color = payload;
    s.id = 'sh_1" x="0';
    const svg = shapeSVG(s);
    expect(svg).not.toContain(payload);
    expect(svg).not.toContain('sh_1" x="0');
    expect(svg).toContain("red&quot; onmouseover=&quot;alert(document.cookie)");
    expect(svg).toContain("sh_1&quot; x=&quot;0");
  });

  it("escapes attribute-breaking payloads in connector labels", () => {
    const doc = newDoc();
    const a = newShape("process", 0, 0, 1);
    const b = newShape("process", 300, 0, 2);
    doc.shapes.push(a, b);
    const c = newConnector("straight", attachedEnd(a.id, "e"), attachedEnd(b.id, "w"), 3);
    const label = newLabel('Yes" onclick="alert(1)');
    label.background = 'white" onload="alert(1)';
    c.labels.push(label);
    doc.connectors.push(c);
    const { svg } = exportSVG(doc, {});
    expect(svg).not.toContain('white" onload="alert(1)');
    expect(svg).toContain("white&quot; onload=&quot;alert(1)");
  });

  it("escapes attribute-breaking connector stroke colors and endpoint caps", () => {
    const doc = newDoc();
    const a = newShape("process", 0, 0, 1);
    const b = newShape("process", 300, 0, 2);
    doc.shapes.push(a, b);
    const c = newConnector("straight", attachedEnd(a.id, "e"), attachedEnd(b.id, "w"), 3);
    c.stroke.color = 'red" onmouseover="alert(1)';
    c.endCap = "filled-arrow";
    doc.connectors.push(c);
    const { svg } = exportSVG(doc, {});
    expect(svg).not.toContain('red" onmouseover="alert(1)');
    expect(svg).toContain("red&quot; onmouseover=&quot;alert(1)");
  });

  it("produces a standalone SVG document with correct bounds", () => {
    const doc = newDoc();
    const s = newShape("process", 100, 200, 1);
    doc.shapes.push(s);
    const { svg, width, height } = exportSVG(doc, { margin: 10 });
    expect(svg.startsWith("<svg xmlns=")).toBe(true);
    expect(width).toBe(Math.round(s.w + 20));
    expect(height).toBe(Math.round(s.h + 20));
    expect(svg).toContain("viewBox=\"90 190");
  });

  it("respects transparent background option", () => {
    const doc = newDoc();
    doc.shapes.push(newShape("process", 0, 0, 1));
    const opaque = exportSVG(doc, {}).svg;
    const transparent = exportSVG(doc, { transparent: true }).svg;
    expect(opaque).toContain(`fill="${doc.canvas.background}"`);
    // the background rect is the only ffffff-filled rect at doc level
    expect(transparent.match(/<rect/g)?.length ?? 0).toBeLessThan(
      opaque.match(/<rect/g)?.length ?? 0
    );
  });

  it("exports only selected ids when requested", () => {
    const doc = newDoc();
    const a = newShape("process", 0, 0, 1);
    const b = newShape("decision", 500, 0, 2);
    doc.shapes.push(a, b);
    const { svg } = exportSVG(doc, { ids: new Set([a.id]) });
    expect(svg).toContain(`data-id="${a.id}"`);
    expect(svg).not.toContain(`data-id="${b.id}"`);
  });

  it("renders connector labels", () => {
    const doc = newDoc();
    const a = newShape("process", 0, 0, 1);
    const b = newShape("process", 300, 0, 2);
    doc.shapes.push(a, b);
    const c = newConnector("straight", attachedEnd(a.id, "e"), attachedEnd(b.id, "w"), 3);
    c.labels.push(newLabel("Yes"));
    doc.connectors.push(c);
    const { svg } = exportSVG(doc, {});
    expect(svg).toContain("Yes");
  });

  it("computes content bounds including connectors", () => {
    const doc = newDoc();
    const a = newShape("process", 0, 0, 1);
    doc.shapes.push(a);
    const b = contentBounds(doc);
    expect(b.x).toBe(0);
    expect(b.w).toBe(a.w);
  });
});

describe("all templates build valid documents", () => {
  for (const t of TEMPLATES) {
    it(`template "${t.name}" renders`, () => {
      const doc = t.build();
      const { svg } = exportSVG(doc, {});
      expect(svg).toContain("<svg");
      // every connector endpoint that references a shape must resolve
      const ids = new Set(doc.shapes.map((s) => s.id));
      for (const c of doc.connectors) {
        if (c.source.shapeId) expect(ids.has(c.source.shapeId)).toBe(true);
        if (c.target.shapeId) expect(ids.has(c.target.shapeId)).toBe(true);
      }
    });
  }
});

describe("text wrapping", () => {
  it("wraps long text into multiple lines", () => {
    const style = defaultTextStyle();
    const lines = wrapText(
      "This is a fairly long sentence that will need wrapping",
      style,
      100
    );
    expect(lines.length).toBeGreaterThan(1);
  });

  it("honors explicit newlines", () => {
    const style = defaultTextStyle();
    const lines = wrapText("one\ntwo\nthree", style, 1000);
    expect(lines).toEqual(["one", "two", "three"]);
  });

  it("hard-breaks single words that are too long", () => {
    const style = defaultTextStyle();
    const lines = wrapText("Supercalifragilisticexpialidocious", style, 50);
    expect(lines.length).toBeGreaterThan(1);
  });
});
