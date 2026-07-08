import { describe, expect, it } from "vitest";
import { parseDoc, serializeDoc, DocumentError, SCHEMA_VERSION } from "../src/model/serialization";
import { attachedEnd, newConnector, newDoc, newLabel, newShape } from "../src/model/defaults";

function sampleDoc() {
  const doc = newDoc("Test diagram");
  const a = newShape("process", 100, 100, 1);
  a.text = "Step A";
  const b = newShape("decision", 300, 100, 2);
  b.text = "Choice?";
  doc.shapes.push(a, b);
  const c = newConnector("elbow", attachedEnd(a.id, "e"), attachedEnd(b.id, "w"), 3);
  c.labels.push(newLabel("Yes"));
  doc.connectors.push(c);
  return { doc, a, b, c };
}

describe("serialization", () => {
  it("round-trips a document", () => {
    const { doc, a, b, c } = sampleDoc();
    const json = serializeDoc(doc);
    const parsed = parseDoc(json);
    expect(parsed.title).toBe("Test diagram");
    expect(parsed.schemaVersion).toBe(SCHEMA_VERSION);
    expect(parsed.shapes).toHaveLength(2);
    expect(parsed.connectors).toHaveLength(1);
    expect(parsed.shapes[0].id).toBe(a.id);
    expect(parsed.shapes[1].type).toBe("decision");
    expect(parsed.connectors[0].source.shapeId).toBe(a.id);
    expect(parsed.connectors[0].source.anchor).toBe("e");
    expect(parsed.connectors[0].labels[0].text).toBe("Yes");
    expect(parsed.shapes[0].text).toBe("Step A");
  });

  it("rejects non-JSON input", () => {
    expect(() => parseDoc("not json at all")).toThrow(DocumentError);
  });

  it("rejects files without the app marker", () => {
    expect(() => parseDoc(JSON.stringify({ foo: 1 }))).toThrow(DocumentError);
  });

  it("rejects documents from a newer schema", () => {
    const { doc } = sampleDoc();
    const raw = JSON.parse(serializeDoc(doc));
    raw.schemaVersion = SCHEMA_VERSION + 1;
    expect(() => parseDoc(JSON.stringify(raw))).toThrow(/schema version/);
  });

  it("drops connectors pointing at unknown shapes gracefully", () => {
    const { doc, c } = sampleDoc();
    const raw = JSON.parse(serializeDoc(doc));
    raw.connectors[0].source.shapeId = "sh_missing";
    const parsed = parseDoc(JSON.stringify(raw));
    // connector kept but detached
    expect(parsed.connectors).toHaveLength(1);
    expect(parsed.connectors[0].source.shapeId).toBeNull();
  });

  it("sanitizes malformed shapes instead of crashing", () => {
    const { doc } = sampleDoc();
    const raw = JSON.parse(serializeDoc(doc));
    raw.shapes.push({ id: "bad1", type: "not-a-real-shape" });
    raw.shapes.push({ nonsense: true });
    raw.shapes.push({ id: "bad2", type: "process", w: -5, h: "x" });
    const parsed = parseDoc(JSON.stringify(raw));
    const bad2 = parsed.shapes.find((s) => s.id === "bad2");
    expect(parsed.shapes.find((s) => s.id === "bad1")).toBeUndefined();
    expect(bad2).toBeDefined();
    expect(bad2!.w).toBeGreaterThan(0);
    expect(bad2!.h).toBeGreaterThan(0);
  });

  it("strips dangerous imageSrc values", () => {
    const { doc } = sampleDoc();
    const raw = JSON.parse(serializeDoc(doc));
    raw.shapes[0].imageSrc = "javascript:alert(1)";
    const parsed = parseDoc(JSON.stringify(raw));
    expect(parsed.shapes[0].imageSrc).toBeNull();
  });

  it("rejects SVG data URLs as imageSrc (no SVG sanitizer available yet)", () => {
    const { doc } = sampleDoc();
    const raw = JSON.parse(serializeDoc(doc));
    raw.shapes[0].imageSrc =
      "data:image/svg+xml;base64," + btoa("<svg onload='alert(1)'></svg>");
    const parsed = parseDoc(JSON.stringify(raw));
    expect(parsed.shapes[0].imageSrc).toBeNull();
  });

  it("accepts a well-formed raster data URL as imageSrc", () => {
    const { doc } = sampleDoc();
    const raw = JSON.parse(serializeDoc(doc));
    const pngDataUrl =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
    raw.shapes[0].imageSrc = pngDataUrl;
    const parsed = parseDoc(JSON.stringify(raw));
    expect(parsed.shapes[0].imageSrc).toBe(pngDataUrl);
  });

  it("drops shapes/connectors whose id would break out of an SVG attribute", () => {
    const { doc } = sampleDoc();
    const raw = JSON.parse(serializeDoc(doc));
    raw.shapes[0].id = 'sh_1" onmouseover="alert(1)';
    raw.connectors[0].id = 'cn_1"><script>alert(1)</script>';
    const parsed = parseDoc(JSON.stringify(raw));
    // the malicious shape is dropped outright (fails the safe-id check)
    expect(parsed.shapes.map((s) => s.id)).not.toContain('sh_1" onmouseover="alert(1)');
    expect(parsed.shapes).toHaveLength(1);
    // the connector referencing it is also gone (bad id itself, independent of the dangling reference)
    expect(parsed.connectors).toHaveLength(0);
  });

  it("replaces malicious color/style values with a safe default instead of preserving them", () => {
    const { doc } = sampleDoc();
    const raw = JSON.parse(serializeDoc(doc));
    const payload = 'red" onmouseover="alert(document.cookie)';
    raw.shapes[1].fill.color = payload;
    raw.shapes[1].stroke.color = payload;
    raw.shapes[1].textStyle.color = payload;
    raw.canvas.background = payload;
    const parsed = parseDoc(JSON.stringify(raw));
    for (const value of [
      parsed.shapes[1].fill.color,
      parsed.shapes[1].stroke.color,
      parsed.shapes[1].textStyle.color,
      parsed.canvas.background,
    ]) {
      expect(value).not.toContain('"');
      expect(value).not.toBe(payload);
    }
  });

  it("accepts ordinary hex, rgb(), and named colors unchanged", () => {
    const { doc } = sampleDoc();
    const raw = JSON.parse(serializeDoc(doc));
    raw.shapes[1].fill.color = "#a1b2c3";
    raw.shapes[1].stroke.color = "rgba(10, 20, 30, 0.5)";
    raw.shapes[1].textStyle.color = "steelblue";
    const parsed = parseDoc(JSON.stringify(raw));
    expect(parsed.shapes[1].fill.color).toBe("#a1b2c3");
    expect(parsed.shapes[1].stroke.color).toBe("rgba(10, 20, 30, 0.5)");
    expect(parsed.shapes[1].textStyle.color).toBe("steelblue");
  });
});
