import type { ConnectorType, FlowDoc, Shape, ShapeType } from "../model/types";
import {
  attachedEnd,
  newConnector,
  newDoc,
  newLabel,
  newShape,
} from "../model/defaults";

export interface Template {
  id: string;
  name: string;
  description: string;
  build: () => FlowDoc;
}

/** Small builder to keep template definitions compact. */
class T {
  doc: FlowDoc;
  private z = 1;
  constructor(title: string) {
    this.doc = newDoc(title);
  }
  shape(
    type: ShapeType,
    x: number,
    y: number,
    text: string,
    opts: Partial<Shape> = {}
  ): Shape {
    const s = newShape(type, x, y, this.z++, opts);
    s.text = text;
    this.doc.shapes.push(s);
    return s;
  }
  connect(
    from: Shape,
    to: Shape,
    label = "",
    type: ConnectorType = "elbow",
    fromAnchor: string | null = null,
    toAnchor: string | null = null
  ) {
    const c = newConnector(
      type,
      attachedEnd(from.id, fromAnchor),
      attachedEnd(to.id, toAnchor),
      this.z++
    );
    if (label) c.labels.push(newLabel(label));
    this.doc.connectors.push(c);
    return c;
  }
}

const FILLS = {
  start: { color: "#dcfce7", opacity: 1 },
  end: { color: "#fee2e2", opacity: 1 },
  decision: { color: "#fef9c3", opacity: 1 },
  process: { color: "#dbeafe", opacity: 1 },
  io: { color: "#f3e8ff", opacity: 1 },
};

function basicFlowchart(): FlowDoc {
  const t = new T("Basic flowchart");
  const start = t.shape("terminator", 240, 40, "Start", { fill: FILLS.start });
  const step1 = t.shape("process", 235, 150, "Do the first step", { fill: FILLS.process });
  const dec = t.shape("decision", 235, 270, "Did it work?", { fill: FILLS.decision });
  const fix = t.shape("process", 460, 282, "Fix the problem", { fill: FILLS.process });
  const end = t.shape("terminator", 240, 430, "End", { fill: FILLS.end });
  t.connect(start, step1);
  t.connect(step1, dec);
  t.connect(dec, end, "Yes", "elbow", "s", "n");
  t.connect(dec, fix, "No", "elbow", "e", "w");
  t.connect(fix, step1, "", "elbow", "n", "e");
  return t.doc;
}

function decisionTree(): FlowDoc {
  const t = new T("Decision tree");
  const root = t.shape("decision", 300, 40, "Is it urgent?", { fill: FILLS.decision });
  const l = t.shape("decision", 120, 220, "Can we do it today?", { fill: FILLS.decision });
  const r = t.shape("decision", 500, 220, "Is it important?", { fill: FILLS.decision });
  const a1 = t.shape("process", 20, 400, "Do it now", { fill: FILLS.process });
  const a2 = t.shape("process", 230, 400, "Schedule it", { fill: FILLS.process });
  const a3 = t.shape("process", 420, 400, "Plan this week", { fill: FILLS.process });
  const a4 = t.shape("process", 630, 400, "Backlog", { fill: FILLS.process });
  t.connect(root, l, "Yes", "elbow", "w", "n");
  t.connect(root, r, "No", "elbow", "e", "n");
  t.connect(l, a1, "Yes", "elbow", "s", "n");
  t.connect(l, a2, "No", "elbow", "s", "n");
  t.connect(r, a3, "Yes", "elbow", "s", "n");
  t.connect(r, a4, "No", "elbow", "s", "n");
  return t.doc;
}

function processMap(): FlowDoc {
  const t = new T("Process map");
  const s1 = t.shape("terminator", 40, 160, "Request received", { fill: FILLS.start });
  const s2 = t.shape("process", 230, 160, "Review request", { fill: FILLS.process });
  const s3 = t.shape("process", 420, 160, "Gather requirements", { fill: FILLS.process });
  const s4 = t.shape("decision", 610, 148, "Approved?", { fill: FILLS.decision });
  const s5 = t.shape("process", 820, 160, "Execute work", { fill: FILLS.process });
  const s6 = t.shape("terminator", 1010, 160, "Complete", { fill: FILLS.end });
  const s7 = t.shape("process", 610, 330, "Request changes", { fill: FILLS.process });
  t.connect(s1, s2);
  t.connect(s2, s3);
  t.connect(s3, s4);
  t.connect(s4, s5, "Yes", "elbow", "e", "w");
  t.connect(s5, s6);
  t.connect(s4, s7, "No", "elbow", "s", "n");
  t.connect(s7, s2, "", "elbow", "w", "s");
  return t.doc;
}

function swimlaneFlow(): FlowDoc {
  const t = new T("Cross-functional flowchart");
  const laneW = 260;
  const lanes = ["Customer", "Sales", "Fulfillment"];
  lanes.forEach((name, i) => {
    const lane = t.shape("swimlane", 40 + i * laneW, 40, name, {
      w: laneW,
      h: 560,
    });
    lane.locked = true;
  });
  const a = t.shape("terminator", 105, 110, "Place order", { fill: FILLS.start });
  const b = t.shape("process", 365, 110, "Validate order", { fill: FILLS.process });
  const c = t.shape("decision", 365, 230, "In stock?", { fill: FILLS.decision });
  const d = t.shape("process", 625, 242, "Pick and pack", { fill: FILLS.process });
  const e = t.shape("process", 625, 360, "Ship order", { fill: FILLS.process });
  const f = t.shape("process", 365, 372, "Notify customer", { fill: FILLS.process });
  const g = t.shape("terminator", 105, 480, "Receive order", { fill: FILLS.end });
  t.connect(a, b);
  t.connect(b, c);
  t.connect(c, d, "Yes", "elbow", "e", "w");
  t.connect(c, f, "No", "elbow", "s", "n");
  t.connect(d, e);
  t.connect(e, g, "", "elbow", "s", "e");
  t.connect(f, g, "", "elbow", "s", "n");
  return t.doc;
}

function softwareLogic(): FlowDoc {
  const t = new T("Software logic flow");
  const s1 = t.shape("terminator", 240, 30, "main()", { fill: FILLS.start });
  const s2 = t.shape("io", 232, 130, "Read input", { fill: FILLS.io });
  const s3 = t.shape("preparation", 230, 240, "Initialize state", { fill: FILLS.process });
  const s4 = t.shape("decision", 235, 350, "Valid input?", { fill: FILLS.decision });
  const s5 = t.shape("predefined-process", 470, 362, "handleError()", { fill: FILLS.process });
  const s6 = t.shape("process", 235, 490, "Process data", { fill: FILLS.process });
  const s7 = t.shape("database", 480, 485, "Save results", { fill: FILLS.io });
  const s8 = t.shape("terminator", 240, 610, "Exit", { fill: FILLS.end });
  t.connect(s1, s2);
  t.connect(s2, s3);
  t.connect(s3, s4);
  t.connect(s4, s5, "No", "elbow", "e", "w");
  t.connect(s4, s6, "Yes", "elbow", "s", "n");
  t.connect(s6, s7, "", "elbow", "e", "w");
  t.connect(s6, s8);
  t.connect(s5, s8, "", "elbow", "s", "e");
  return t.doc;
}

function customerJourney(): FlowDoc {
  const t = new T("Customer journey flow");
  const steps = [
    ["Awareness", "Sees an ad or referral"],
    ["Consideration", "Compares options"],
    ["Purchase", "Buys the product"],
    ["Onboarding", "First-run experience"],
    ["Retention", "Repeat usage"],
    ["Advocacy", "Recommends to others"],
  ];
  let prev: Shape | null = null;
  steps.forEach(([title, sub], i) => {
    const s = t.shape("rounded-rectangle", 40 + i * 190, 120, `${title}\n${sub}`, {
      w: 160,
      h: 90,
      fill: { color: i % 2 ? "#dbeafe" : "#e0e7ff", opacity: 1 },
    });
    if (prev) t.connect(prev, s, "", "straight", "e", "w");
    prev = s;
  });
  return t.doc;
}

function approvalWorkflow(): FlowDoc {
  const t = new T("Approval workflow");
  const s1 = t.shape("terminator", 240, 30, "Submit request", { fill: FILLS.start });
  const s2 = t.shape("process", 235, 130, "Manager review", { fill: FILLS.process });
  const d1 = t.shape("decision", 235, 240, "Manager approves?", { fill: FILLS.decision });
  const s3 = t.shape("process", 235, 390, "Finance review", { fill: FILLS.process });
  const d2 = t.shape("decision", 235, 500, "Finance approves?", { fill: FILLS.decision });
  const ok = t.shape("terminator", 240, 660, "Approved", { fill: FILLS.start });
  const rej = t.shape("terminator", 520, 400, "Rejected", { fill: FILLS.end });
  t.connect(s1, s2);
  t.connect(s2, d1);
  t.connect(d1, s3, "Yes", "elbow", "s", "n");
  t.connect(d1, rej, "No", "elbow", "e", "n");
  t.connect(s3, d2);
  t.connect(d2, ok, "Yes", "elbow", "s", "n");
  t.connect(d2, rej, "No", "elbow", "e", "s");
  return t.doc;
}

function incidentResponse(): FlowDoc {
  const t = new T("Incident response workflow");
  const s1 = t.shape("terminator", 240, 30, "Incident detected", { fill: FILLS.end });
  const s2 = t.shape("process", 235, 130, "Triage severity", { fill: FILLS.process });
  const d1 = t.shape("decision", 235, 240, "Critical?", { fill: FILLS.decision });
  const s3 = t.shape("process", 470, 252, "Page on-call", { fill: FILLS.process });
  const s4 = t.shape("process", 235, 390, "Investigate root cause", { fill: FILLS.process });
  const s5 = t.shape("process", 235, 500, "Apply fix", { fill: FILLS.process });
  const d2 = t.shape("decision", 235, 610, "Resolved?", { fill: FILLS.decision });
  const s6 = t.shape("document", 500, 600, "Write postmortem", { fill: FILLS.io });
  const end = t.shape("terminator", 240, 770, "Close incident", { fill: FILLS.start });
  t.connect(s1, s2);
  t.connect(s2, d1);
  t.connect(d1, s3, "Yes", "elbow", "e", "w");
  t.connect(d1, s4, "No", "elbow", "s", "n");
  t.connect(s3, s4, "", "elbow", "s", "e");
  t.connect(s4, s5);
  t.connect(s5, d2);
  t.connect(d2, s4, "No", "elbow", "w", "w");
  t.connect(d2, s6, "Yes", "elbow", "e", "w");
  t.connect(s6, end, "", "elbow", "s", "e");
  return t.doc;
}

function salesFunnel(): FlowDoc {
  const t = new T("Sales funnel workflow");
  const s1 = t.shape("process", 200, 40, "Lead captured", { fill: FILLS.process, w: 240 });
  const s2 = t.shape("process", 215, 150, "Qualify lead", { fill: FILLS.process, w: 210 });
  const d1 = t.shape("decision", 235, 260, "Qualified?", { fill: FILLS.decision });
  const s3 = t.shape("process", 228, 410, "Demo / proposal", { fill: FILLS.process, w: 184 });
  const d2 = t.shape("decision", 235, 520, "Deal won?", { fill: FILLS.decision });
  const won = t.shape("terminator", 245, 680, "Customer!", { fill: FILLS.start, w: 130 });
  const lost = t.shape("terminator", 500, 530, "Nurture list", { fill: FILLS.end });
  t.connect(s1, s2);
  t.connect(s2, d1);
  t.connect(d1, s3, "Yes", "elbow", "s", "n");
  t.connect(d1, lost, "No", "elbow", "e", "n");
  t.connect(s3, d2);
  t.connect(d2, won, "Yes", "elbow", "s", "n");
  t.connect(d2, lost, "No", "elbow", "e", "w");
  return t.doc;
}

function projectWorkflow(): FlowDoc {
  const t = new T("Project workflow");
  const phases = ["Initiate", "Plan", "Execute", "Review", "Close"];
  let prev: Shape | null = null;
  phases.forEach((p, i) => {
    const s = t.shape("process", 40 + i * 190, 120, p, {
      w: 150,
      h: 70,
      fill: FILLS.process,
    });
    if (prev) t.connect(prev, s, "", "straight", "e", "w");
    prev = s;
  });
  const gate = t.shape("decision", 425, 280, "Gate passed?", { fill: FILLS.decision });
  const rework = t.shape("process", 180, 292, "Address findings", { fill: FILLS.process });
  t.connect(t.doc.shapes[3], gate, "", "elbow", "s", "n");
  t.connect(gate, t.doc.shapes[4], "Yes", "elbow", "e", "s");
  t.connect(gate, rework, "No", "elbow", "w", "e");
  t.connect(rework, t.doc.shapes[2], "", "elbow", "n", "s");
  return t.doc;
}

export const TEMPLATES: Template[] = [
  { id: "blank", name: "Blank", description: "Start from an empty canvas", build: () => newDoc() },
  { id: "basic", name: "Basic flowchart", description: "Start, process, decision, end", build: basicFlowchart },
  { id: "decision-tree", name: "Decision tree", description: "Branching yes/no decisions", build: decisionTree },
  { id: "process-map", name: "Process map", description: "Linear process with approval loop", build: processMap },
  { id: "swimlane", name: "Cross-functional (swimlane)", description: "Lanes per team or role", build: swimlaneFlow },
  { id: "software", name: "Software logic flow", description: "Program flow with I/O and data", build: softwareLogic },
  { id: "journey", name: "Customer journey", description: "Stages from awareness to advocacy", build: customerJourney },
  { id: "approval", name: "Approval workflow", description: "Two-stage approval with rejection", build: approvalWorkflow },
  { id: "incident", name: "Incident response", description: "Detect, triage, fix, postmortem", build: incidentResponse },
  { id: "sales-funnel", name: "Sales funnel", description: "Lead to customer pipeline", build: salesFunnel },
  { id: "project", name: "Project workflow", description: "Phases with a review gate", build: projectWorkflow },
];
