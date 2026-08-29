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

  it("dirty is false after undoing back to the saved state", () => {
    ed.apply("Add", (doc) => doc.shapes.push(newShape("process", 0, 0, 1)));
    ed.markSaved();
    expect(ed.dirty).toBe(false);
    ed.apply("Move", (doc) => (doc.shapes[0].x = 50));
    expect(ed.dirty).toBe(true);
    ed.undo();
    expect(ed.dirty).toBe(false); // back to exactly what's on disk
  });

  it("dirty stays true after undoing past a save and branching to a new edit", () => {
    ed.apply("A", (doc) => doc.shapes.push(newShape("process", 0, 0, 1)));
    ed.apply("B", (doc) => (doc.shapes[0].x = 10));
    ed.markSaved(); // saved state = after A and B
    ed.undo(); // back to just after A
    ed.apply("C", (doc) => (doc.shapes[0].x = 99)); // new branch; B is now unreachable
    expect(ed.dirty).toBe(true);
    ed.undo(); // back to just after A again
    expect(ed.dirty).toBe(true); // saved state (after B) no longer exists on this branch
    ed.redo();
    expect(ed.dirty).toBe(true); // redoing replays C, still not what was saved
  });

  it("redo back to the saved state clears dirty", () => {
    ed.apply("A", (doc) => doc.shapes.push(newShape("process", 0, 0, 1)));
    ed.markSaved();
    ed.apply("B", (doc) => (doc.shapes[0].x = 10));
    ed.undo();
    expect(ed.dirty).toBe(false);
    ed.redo();
    expect(ed.dirty).toBe(true);
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

describe("canvas settings participate in the command system", () => {
  let ed: Editor;
  beforeEach(() => {
    ed = new Editor();
    ed.markSaved();
  });

  it("marks the document dirty", () => {
    expect(ed.dirty).toBe(false);
    ed.setCanvas({ background: "#112233" });
    expect(ed.dirty).toBe(true);
  });

  it("is undoable and redoable", () => {
    const before = ed.doc.canvas.gridSize;
    ed.setCanvas({ gridSize: 40 });
    expect(ed.doc.canvas.gridSize).toBe(40);
    expect(ed.canUndo()).toBe(true);
    ed.undo();
    expect(ed.doc.canvas.gridSize).toBe(before);
    ed.redo();
    expect(ed.doc.canvas.gridSize).toBe(40);
  });

  it("returns to a clean state when undone back to the saved point", () => {
    ed.setCanvas({ snapToGrid: !ed.doc.canvas.snapToGrid });
    expect(ed.dirty).toBe(true);
    ed.undo();
    expect(ed.dirty).toBe(false);
  });

  it("ignores a no-op change so it does not push empty undo steps", () => {
    ed.setCanvas({ gridVisible: ed.doc.canvas.gridVisible });
    expect(ed.canUndo()).toBe(false);
    expect(ed.dirty).toBe(false);
  });

  it("survives serialization as part of the document", () => {
    ed.setCanvas({ background: "#0a0a0a", gridSize: 33 });
    expect(ed.doc.canvas.background).toBe("#0a0a0a");
    expect(ed.doc.canvas.gridSize).toBe(33);
  });
});

describe("recovered documents stay unsaved", () => {
  it("cannot be marked clean again by undoing an edit made after recovery", () => {
    const ed = new Editor();
    ed.markUnsaved();
    expect(ed.dirty).toBe(true);
    ed.apply("Add", (doc) => doc.shapes.push(newShape("process", 0, 0, 1)));
    expect(ed.dirty).toBe(true);
    ed.undo();
    // Before the fix this reported false: savedDepth still pointed at the
    // empty undo stack, so the never-saved recovered work looked saved.
    expect(ed.dirty).toBe(true);
  });

  it("becomes clean once actually saved", () => {
    const ed = new Editor();
    ed.markUnsaved();
    ed.markSaved();
    expect(ed.dirty).toBe(false);
  });
});

describe("keyboard traversal of the diagram", () => {
  it("steps forward and backward through elements in painting order", () => {
    const ed = new Editor();
    const a = addShape(ed);
    const b = addShape(ed);
    const c = addShape(ed);
    expect(ed.selectAdjacent(1)!.id).toBe(a.id);
    expect(ed.selectAdjacent(1)!.id).toBe(b.id);
    expect(ed.selectAdjacent(1)!.id).toBe(c.id);
    expect(ed.selectAdjacent(-1)!.id).toBe(b.id);
    expect(ed.selectAdjacent(-1)!.id).toBe(a.id);
  });

  it("stops at the ends instead of wrapping, so Tab can leave the canvas", () => {
    // A wrapping Tab would make the canvas a keyboard trap: focus could never
    // reach the inspector or status bar that follow it in DOM order.
    const ed = new Editor();
    const a = addShape(ed);
    const b = addShape(ed);
    expect(ed.selectAdjacent(1)!.id).toBe(a.id);
    expect(ed.selectAdjacent(1)!.id).toBe(b.id);
    expect(ed.selectAdjacent(1)).toBeNull(); // past the last object
    expect(ed.selectAdjacent(-1)!.id).toBe(a.id);
    expect(ed.selectAdjacent(-1)).toBeNull(); // past the first object
  });

  it("advances past a group instead of stalling inside it", () => {
    // Selecting a grouped element expands the selection to the whole group,
    // so a position derived from the selection would always find the group's
    // first member and traversal would oscillate between its members forever.
    const ed = new Editor();
    const a = addShape(ed);
    const b = addShape(ed);
    const c = addShape(ed);
    ed.doc.groups.push({ id: "g1", memberIds: [a.id, b.id] });
    a.groupId = "g1";
    b.groupId = "g1";
    expect(ed.selectAdjacent(1)!.id).toBe(a.id);
    expect(ed.selectAdjacent(1)!.id).toBe(b.id);
    expect(ed.selectAdjacent(1)!.id).toBe(c.id);
    expect(ed.selectAdjacent(1)).toBeNull();
  });

  it("resumes from whatever the user last selected by other means", () => {
    const ed = new Editor();
    const a = addShape(ed);
    const b = addShape(ed);
    const c = addShape(ed);
    void a;
    ed.select([b.id]); // e.g. a click
    expect(ed.selectAdjacent(1)!.id).toBe(c.id);
  });

  it("includes connectors and skips hidden elements", () => {
    const ed = new Editor();
    const a = addShape(ed);
    const b = addShape(ed);
    b.hidden = true;
    const conn = newConnector("straight", attachedEnd(a.id), attachedEnd(b.id), 9);
    ed.doc.connectors.push(conn);
    const ids = ed.documentOrder().map((e) => e.id);
    expect(ids).toEqual([a.id, conn.id]);
  });

  it("returns null for an empty document", () => {
    expect(new Editor().selectAdjacent(1)).toBeNull();
  });
});
