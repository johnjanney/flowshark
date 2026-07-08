import { beforeEach, describe, expect, it } from "vitest";
import { Editor } from "../src/core/editor";
import { attachedEnd, newConnector, newShape } from "../src/model/defaults";
import type { Shape } from "../src/model/types";

function addShape(ed: Editor, x = 0, y = 0, w = 100, h = 50): Shape {
  const s = newShape("process", x, y, ed.doc.shapes.length + 1);
  s.w = w;
  s.h = h;
  ed.doc.shapes.push(s);
  return s;
}

describe("undo/redo", () => {
  let ed: Editor;
  beforeEach(() => {
    ed = new Editor();
  });

  it("undoes and redoes a mutation", () => {
    ed.apply("Add", (doc) => {
      doc.shapes.push(newShape("process", 10, 10, 1));
    });
    expect(ed.doc.shapes).toHaveLength(1);
    ed.undo();
    expect(ed.doc.shapes).toHaveLength(0);
    ed.redo();
    expect(ed.doc.shapes).toHaveLength(1);
  });

  it("clears the redo stack on new mutations", () => {
    ed.apply("A", (doc) => doc.shapes.push(newShape("process", 0, 0, 1)));
    ed.undo();
    ed.apply("B", (doc) => doc.shapes.push(newShape("decision", 0, 0, 1)));
    expect(ed.canRedo()).toBe(false);
    expect(ed.doc.shapes[0].type).toBe("decision");
  });

  it("cancel() restores the pre-drag state", () => {
    const s = addShape(ed, 10, 10);
    ed.begin("Move");
    s.x = 500;
    ed.cancel();
    expect(ed.doc.shapes[0].x).toBe(10);
    expect(ed.canUndo()).toBe(false);
  });

  it("supports at least 100 undo steps", () => {
    for (let i = 0; i < 120; i++) {
      ed.apply("Add", (doc) => doc.shapes.push(newShape("process", i, i, i)));
    }
    let undone = 0;
    while (ed.canUndo()) {
      ed.undo();
      undone++;
    }
    expect(undone).toBeGreaterThanOrEqual(100);
  });
});

describe("clipboard", () => {
  it("copy/paste duplicates shapes and remaps connector references", () => {
    const ed = new Editor();
    const a = addShape(ed, 0, 0);
    const b = addShape(ed, 200, 0);
    ed.doc.connectors.push(
      newConnector("straight", attachedEnd(a.id), attachedEnd(b.id), 3)
    );
    ed.select([a.id, b.id, ed.doc.connectors[0].id]);
    ed.copy();
    ed.paste();
    expect(ed.doc.shapes).toHaveLength(4);
    expect(ed.doc.connectors).toHaveLength(2);
    const pasted = ed.doc.connectors[1];
    const newIds = ed.doc.shapes.slice(2).map((s) => s.id);
    expect(newIds).toContain(pasted.source.shapeId);
    expect(newIds).toContain(pasted.target.shapeId);
    // ids must be unique
    const ids = new Set([
      ...ed.doc.shapes.map((s) => s.id),
      ...ed.doc.connectors.map((c) => c.id),
    ]);
    expect(ids.size).toBe(6);
  });

  it("duplicate offsets the copy", () => {
    const ed = new Editor();
    const a = addShape(ed, 50, 50);
    ed.select([a.id]);
    ed.duplicate();
    expect(ed.doc.shapes).toHaveLength(2);
    expect(ed.doc.shapes[1].x).not.toBe(50);
  });
});

describe("delete", () => {
  it("detaches connectors from deleted shapes instead of corrupting them", () => {
    const ed = new Editor();
    const a = addShape(ed, 0, 0);
    const b = addShape(ed, 300, 0);
    ed.doc.connectors.push(
      newConnector("straight", attachedEnd(a.id), attachedEnd(b.id), 3)
    );
    ed.select([a.id]);
    ed.deleteSelection();
    expect(ed.doc.shapes).toHaveLength(1);
    expect(ed.doc.connectors).toHaveLength(1);
    expect(ed.doc.connectors[0].source.shapeId).toBeNull();
    expect(ed.doc.connectors[0].target.shapeId).toBe(b.id);
  });

  it("does not delete locked elements", () => {
    const ed = new Editor();
    const a = addShape(ed);
    a.locked = true;
    ed.selection = new Set([a.id]);
    ed.deleteSelection();
    expect(ed.doc.shapes).toHaveLength(1);
  });
});

describe("grouping", () => {
  it("groups and ungroups, and selection expands to the group", () => {
    const ed = new Editor();
    const a = addShape(ed, 0, 0);
    const b = addShape(ed, 200, 0);
    ed.select([a.id, b.id]);
    ed.group();
    expect(ed.doc.groups).toHaveLength(1);
    ed.deselect();
    ed.select([a.id]);
    expect(ed.selection.has(b.id)).toBe(true);
    ed.ungroup();
    expect(ed.doc.groups).toHaveLength(0);
    expect(ed.doc.shapes[0].groupId).toBeNull();
  });
});

describe("alignment and distribution", () => {
  function three(ed: Editor): [Shape, Shape, Shape] {
    return [
      addShape(ed, 0, 0, 50, 40),
      addShape(ed, 120, 60, 80, 40),
      addShape(ed, 400, 130, 60, 40),
    ];
  }

  it("aligns left edges", () => {
    const ed = new Editor();
    const [a, b, c] = three(ed);
    ed.select([a.id, b.id, c.id]);
    ed.align("left");
    expect(b.x).toBe(0);
    expect(c.x).toBe(0);
  });

  it("aligns vertical centers", () => {
    const ed = new Editor();
    const [a, b, c] = three(ed);
    ed.select([a.id, b.id, c.id]);
    ed.align("vcenter");
    const cy = (s: Shape) => s.y + s.h / 2;
    expect(cy(a)).toBeCloseTo(cy(b));
    expect(cy(b)).toBeCloseTo(cy(c));
  });

  it("distributes horizontally with equal gaps", () => {
    const ed = new Editor();
    const [a, b, c] = three(ed);
    ed.select([a.id, b.id, c.id]);
    ed.distribute("horizontal");
    const gap1 = b.x - (a.x + a.w);
    const gap2 = c.x - (b.x + b.w);
    expect(gap1).toBeCloseTo(gap2);
    // outer edges preserved
    expect(a.x).toBe(0);
    expect(c.x + c.w).toBe(460);
  });

  it("matches sizes", () => {
    const ed = new Editor();
    const [a, b, c] = three(ed);
    ed.select([a.id, b.id, c.id]);
    ed.matchSize("both");
    expect(b.w).toBe(a.w);
    expect(c.h).toBe(a.h);
  });
});

describe("z-order", () => {
  it("bring to front puts selection above everything", () => {
    const ed = new Editor();
    const a = addShape(ed);
    const b = addShape(ed);
    const c = addShape(ed);
    ed.select([a.id]);
    ed.order("front");
    const za = ed.doc.shapes.find((s) => s.id === a.id)!.zIndex;
    expect(za).toBeGreaterThan(ed.doc.shapes.find((s) => s.id === b.id)!.zIndex);
    expect(za).toBeGreaterThan(ed.doc.shapes.find((s) => s.id === c.id)!.zIndex);
  });
});

describe("style clipboard", () => {
  it("copies fill/stroke from one shape to another", () => {
    const ed = new Editor();
    const a = addShape(ed);
    a.fill.color = "#ff0000";
    a.stroke.width = 4;
    const b = addShape(ed);
    ed.select([a.id]);
    ed.copyStyle();
    ed.select([b.id]);
    ed.pasteStyle();
    expect(ed.doc.shapes[1].fill.color).toBe("#ff0000");
    expect(ed.doc.shapes[1].stroke.width).toBe(4);
  });
});
