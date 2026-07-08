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
    expect(parsed.schemaVersion).toBeUndefined; // field exists on doc
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
});
