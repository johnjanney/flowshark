import { describe, expect, it } from "vitest";
import { DocumentError, parseDoc, serializeDoc } from "../src/model/serialization";
import { LIMITS } from "../src/model/limits";
import { newConnector, newDoc, newLabel, newShape, freeEnd } from "../src/model/defaults";
import { gridSVG } from "../src/canvas/render";
import { ExportSizeError, rasterDimensions } from "../src/io/export";
import { wrapText } from "../src/core/text";
import { defaultTextStyle } from "../src/model/defaults";

/** Build a raw (unvalidated) document object for adversarial parse tests. */
function rawDoc(extra: Record<string, unknown> = {}): string {
  return JSON.stringify({
    app: "flowshark",
    schemaVersion: 1,
    id: "doc1",
    title: "Adversarial",
    canvas: {},
    shapes: [],
    connectors: [],
    groups: [],
    ...extra,
  });
}

describe("document resource limits", () => {
  it("refuses a file larger than the documented size limit before parsing it", () => {
    const oversized = "x".repeat(LIMITS.maxDocumentChars + 1);
    expect(() => parseDoc(oversized)).toThrow(DocumentError);
    // and the message tells the user what happened, not "invalid JSON"
    expect(() => parseDoc(oversized)).toThrow(/larger than the/i);
  });

  it("caps the number of shapes and connectors it will load", () => {
    const shapes = Array.from({ length: LIMITS.maxShapes + 25 }, (_, i) => ({
      id: `sh${i}`,
      type: "process",
      x: 0,
      y: 0,
      w: 10,
      h: 10,
    }));
    const doc = parseDoc(rawDoc({ shapes }));
    expect(doc.shapes).toHaveLength(LIMITS.maxShapes);
  });

  it("clamps extreme coordinates and dimensions", () => {
    const doc = parseDoc(
      rawDoc({
        shapes: [
          { id: "sh1", type: "process", x: 1e300, y: -1e300, w: 1e300, h: -5 },
        ],
      })
    );
    const s = doc.shapes[0];
    expect(s.x).toBe(LIMITS.maxCoordinate);
    expect(s.y).toBe(-LIMITS.maxCoordinate);
    expect(s.w).toBe(LIMITS.maxDimension);
    expect(s.h).toBe(1); // dimensions are always at least one unit
  });

  it("clamps styling numbers that drive rendering cost", () => {
    const doc = parseDoc(
      rawDoc({
        shapes: [
          {
            id: "sh1",
            type: "process",
            stroke: { color: "#000000", width: 1e9, style: "solid" },
            textStyle: { fontSize: 1e9, lineHeight: 1e9 },
            cornerRadius: 1e12,
            textPadding: 1e12,
            zIndex: 1e30,
          },
        ],
        canvas: { gridSize: 0.0001, snapTolerance: 1e9 },
      })
    );
    const s = doc.shapes[0];
    expect(s.stroke.width).toBe(LIMITS.maxStrokeWidth);
    expect(s.textStyle.fontSize).toBe(LIMITS.maxFontSize);
    expect(s.textStyle.lineHeight).toBe(LIMITS.maxLineHeight);
    expect(s.cornerRadius).toBe(LIMITS.maxCornerRadius);
    expect(s.textPadding).toBe(LIMITS.maxTextPadding);
    expect(s.zIndex).toBe(LIMITS.maxZIndex);
    expect(doc.canvas.gridSize).toBe(LIMITS.minGridSize);
    expect(doc.canvas.snapTolerance).toBe(LIMITS.maxSnapTolerance);
  });

  it("truncates oversized text, titles and font families", () => {
    const doc = parseDoc(
      rawDoc({
        title: "T".repeat(LIMITS.maxTitleLength + 500),
        shapes: [
          {
            id: "sh1",
            type: "process",
            text: "A".repeat(LIMITS.maxTextLength + 5000),
            textStyle: { fontFamily: "F".repeat(LIMITS.maxFontFamilyLength + 500) },
          },
        ],
      })
    );
    expect(doc.title).toHaveLength(LIMITS.maxTitleLength);
    expect(doc.shapes[0].text).toHaveLength(LIMITS.maxTextLength);
    expect(doc.shapes[0].textStyle.fontFamily).toHaveLength(LIMITS.maxFontFamilyLength);
  });

  it("caps connector bend points and labels", () => {
    const doc = parseDoc(
      rawDoc({
        connectors: [
          {
            id: "cn1",
            points: Array.from({ length: LIMITS.maxPointsPerConnector + 50 }, () => ({
              x: 1,
              y: 1,
            })),
            labels: Array.from({ length: LIMITS.maxLabelsPerConnector + 20 }, (_, i) => ({
              id: `lb${i}`,
              text: "x",
            })),
          },
        ],
      })
    );
    expect(doc.connectors[0].points).toHaveLength(LIMITS.maxPointsPerConnector);
    expect(doc.connectors[0].labels).toHaveLength(LIMITS.maxLabelsPerConnector);
  });

  it("normalizes an absurd rotation instead of carrying it into trig-heavy code", () => {
    const doc = parseDoc(
      rawDoc({ shapes: [{ id: "sh1", type: "process", rotation: 1e12 + 45 }] })
    );
    expect(Math.abs(doc.shapes[0].rotation)).toBeLessThan(360);
  });

  it("still round-trips a normal document unchanged", () => {
    const doc = newDoc("Normal");
    const a = newShape("process", 10, 20, 1);
    a.text = "Step";
    doc.shapes.push(a);
    const c = newConnector("elbow", freeEnd(0, 0), freeEnd(50, 50), 2);
    c.labels.push(newLabel("Yes"));
    doc.connectors.push(c);
    const parsed = parseDoc(serializeDoc(doc));
    expect(parsed.shapes[0].x).toBe(10);
    expect(parsed.shapes[0].text).toBe("Step");
    expect(parsed.connectors[0].labels[0].text).toBe("Yes");
  });
});

describe("document relationship integrity", () => {
  it("keeps one global id namespace across shapes, connectors and groups", () => {
    const doc = parseDoc(
      rawDoc({
        shapes: [
          { id: "dup", type: "process" },
          { id: "dup", type: "decision" },
          { id: "sh2", type: "process" },
        ],
        connectors: [{ id: "dup" }],
        groups: [{ id: "dup", memberIds: ["dup", "sh2"] }],
      })
    );
    expect(doc.shapes).toHaveLength(2);
    expect(doc.shapes[0].type).toBe("process"); // first claimant wins
    expect(doc.connectors).toHaveLength(0); // id already taken by a shape
    expect(doc.groups).toHaveLength(0); // id already taken by a shape
  });

  it("deduplicates group membership", () => {
    const doc = parseDoc(
      rawDoc({
        shapes: [
          { id: "a", type: "process" },
          { id: "b", type: "process" },
        ],
        groups: [{ id: "g1", memberIds: ["a", "a", "b", "b", "a"] }],
      })
    );
    expect(doc.groups[0].memberIds).toEqual(["a", "b"]);
  });

  it("refuses to let two groups own the same element", () => {
    const doc = parseDoc(
      rawDoc({
        shapes: [
          { id: "a", type: "process" },
          { id: "b", type: "process" },
          { id: "c", type: "process" },
        ],
        groups: [
          { id: "g1", memberIds: ["a", "b"] },
          { id: "g2", memberIds: ["a", "b", "c"] },
        ],
      })
    );
    expect(doc.groups).toHaveLength(1);
    expect(doc.groups[0].id).toBe("g1");
    expect(doc.shapes.find((s) => s.id === "c")!.groupId).toBeNull();
  });

  it("rebuilds groupId from actual membership, ignoring what the file claimed", () => {
    const doc = parseDoc(
      rawDoc({
        shapes: [
          { id: "a", type: "process", groupId: "g9" },
          { id: "b", type: "process", groupId: null },
        ],
        groups: [{ id: "g1", memberIds: ["a", "b"] }],
      })
    );
    expect(doc.shapes.map((s) => s.groupId)).toEqual(["g1", "g1"]);
  });

  it("drops duplicate connector label ids", () => {
    const doc = parseDoc(
      rawDoc({
        connectors: [
          {
            id: "cn1",
            labels: [
              { id: "lb1", text: "first" },
              { id: "lb1", text: "second" },
            ],
          },
        ],
      })
    );
    expect(doc.connectors[0].labels).toHaveLength(1);
    expect(doc.connectors[0].labels[0].text).toBe("first");
  });

  it("rejects connector anchors that are not real connection points", () => {
    const doc = parseDoc(
      rawDoc({
        shapes: [{ id: "a", type: "process" }],
        connectors: [
          { id: "cn1", source: { shapeId: "a", anchor: "not-an-anchor" }, target: {} },
          { id: "cn2", source: { shapeId: "a", anchor: "ne" }, target: {} },
        ],
      })
    );
    expect(doc.connectors[0].source.anchor).toBeNull(); // falls back to floating
    expect(doc.connectors[0].source.shapeId).toBe("a");
    expect(doc.connectors[1].source.anchor).toBe("ne");
  });
});

describe("render and export bounds", () => {
  it("bounds the grid line count no matter how large the area is", () => {
    const doc = newDoc();
    doc.canvas.gridSize = 2;
    const svg = gridSVG(doc, { x: 0, y: 0, w: 1e7, h: 1e7 });
    const segments = (svg.match(/M/g) ?? []).length;
    expect(segments).toBeLessThanOrEqual(LIMITS.maxGridLines);
    expect(segments).toBeGreaterThan(0);
  });

  it("still draws an exact grid at ordinary sizes", () => {
    const doc = newDoc();
    doc.canvas.gridSize = 20;
    const svg = gridSVG(doc, { x: 0, y: 0, w: 100, h: 40 });
    // 6 vertical (0..100) + 3 horizontal (0..40)
    expect((svg.match(/M/g) ?? []).length).toBe(9);
  });

  it("refuses a raster export bigger than the canvas limit", () => {
    expect(() => rasterDimensions(50_000, 50_000, 2)).toThrow(ExportSizeError);
    expect(() => rasterDimensions(100, 100, 4)).not.toThrow();
    expect(rasterDimensions(100, 50, 2)).toEqual({ width: 200, height: 100 });
  });

  it("names the limit in the export error so the user can act on it", () => {
    expect(() => rasterDimensions(50_000, 50_000, 2)).toThrow(/megapixels|per side/i);
  });
});

describe("text wrapping performance", () => {
  it("hard-breaks a long unbroken run without quadratic measurement", () => {
    const style = defaultTextStyle();
    const start = Date.now();
    const lines = wrapText("W".repeat(20_000), style, 100);
    expect(lines.length).toBeGreaterThan(1);
    // The old linear back-off took seconds for this input; the binary search
    // is comfortably under a tenth of that even on a slow machine.
    expect(Date.now() - start).toBeLessThan(2000);
  });

  it("still wraps ordinary text at word boundaries", () => {
    const style = defaultTextStyle();
    const lines = wrapText("alpha beta gamma delta", style, 60);
    expect(lines.join(" ").replace(/\s+/g, " ")).toBe("alpha beta gamma delta");
  });
});

describe("exported SVG accessibility", () => {
  it("carries an accessible name and a description of the content", async () => {
    const { exportSVG } = await import("../src/canvas/render");
    const doc = newDoc("Approval flow");
    const a = newShape("process", 0, 0, 1);
    a.text = "Submit request";
    const b = newShape("decision", 200, 0, 2);
    b.text = "Approved?";
    doc.shapes.push(a, b);
    doc.connectors.push(newConnector("elbow", freeEnd(0, 0), freeEnd(10, 10), 3));
    const { svg } = exportSVG(doc);
    expect(svg).toContain('role="img"');
    expect(svg).toContain('aria-labelledby="fs-title fs-desc"');
    expect(svg).toContain("<title id=\"fs-title\">Approval flow</title>");
    expect(svg).toMatch(/<desc id="fs-desc">Flowchart with 2 shapes and 1 connector\./);
    expect(svg).toContain("Submit request");
    expect(svg).toContain("Approved?");
  });

  it("escapes document-controlled text in the description", async () => {
    const { exportSVG } = await import("../src/canvas/render");
    const doc = newDoc('</desc><script>alert(1)</script>');
    const s = newShape("process", 0, 0, 1);
    s.text = '</desc><script>x</script>';
    doc.shapes.push(s);
    const { svg } = exportSVG(doc);
    expect(svg).not.toContain("<script>");
    expect(svg).toContain("&lt;script&gt;");
  });
});
