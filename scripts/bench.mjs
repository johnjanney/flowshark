/**
 * Reproducible performance benchmark for the brief's "efficient rendering of
 * diagrams with hundreds of elements" target (PROJECTBRIEF.md §3).
 *
 * It generates synthetic documents of a given size and times the operations a
 * user actually waits on, in a real browser against the real source modules:
 *
 *   parse          opening a saved file
 *   route           re-routing every connector (runs inside every refresh)
 *   buildContentSVG the renderer's string build for the whole document
 *   commitToDOM     handing that string to the live SVG layer
 *   fullRefresh     build + commit, i.e. one CanvasView.refreshContent()
 *   undoSnapshot    structuredClone of the document — the drag hot path,
 *                   since every pointermove restores from a fresh clone
 *   dragFrame       undoSnapshot + snapMove + fullRefresh, one drag frame
 *   exportSVG       full SVG export
 *   serialize       saving
 *
 * Usage:
 *   node scripts/bench.mjs                 # sizes 100, 500, 2000
 *   node scripts/bench.mjs 500             # one size
 *   BENCH_REPEATS=15 BENCH_JSON=bench.json node scripts/bench.mjs
 *
 * No build step is needed: it runs against the Vite dev server so the numbers
 * come from the actual modules, not a copy. Results are hardware-specific —
 * record the machine with them. The Windows-on-ARM acceptance run
 * (OPENQUESTIONS.md Q16) means this script against WebView2 on ARM64
 * hardware, not a developer laptop.
 *
 * Needs `npx playwright install chromium` once (same as the smoke test).
 */
import { chromium } from "playwright";
import { createServer } from "vite";
import { writeFileSync } from "node:fs";

const requested = process.argv.slice(2).map(Number).filter(Number.isFinite);
const sizes = requested.length > 0 ? requested : [100, 500, 2000];
const repeats = Number(process.env.BENCH_REPEATS ?? 9);
const PORT = 4175;

/**
 * A grid of shapes joined by elbow connectors, roughly the shape of a real
 * large flowchart. Every connector is attached at both ends so the router
 * does the work it would do in practice.
 */
function buildDoc(elements) {
  const shapeCount = Math.ceil(elements / 2);
  const connectorCount = elements - shapeCount;
  const cols = Math.max(1, Math.ceil(Math.sqrt(shapeCount)));
  const textStyle = {
    fontFamily: "Segoe UI, system-ui, sans-serif",
    fontSize: 13,
    bold: false,
    italic: false,
    underline: false,
    color: "#1f2937",
    align: "center",
    valign: "middle",
    lineHeight: 1.3,
  };
  const shapes = Array.from({ length: shapeCount }, (_, i) => ({
    id: `sh${i}`,
    kind: "shape",
    type: i % 5 === 0 ? "decision" : "process",
    x: (i % cols) * 220,
    y: Math.floor(i / cols) * 140,
    w: 160,
    h: 80,
    rotation: 0,
    fill: { color: "#ffffff", opacity: 1 },
    stroke: { color: "#4b5563", width: 1.5, style: "solid" },
    cornerRadius: 6,
    text: `Step ${i + 1}`,
    textStyle,
    textPadding: 6,
    locked: false,
    hidden: false,
    zIndex: i + 1,
    groupId: null,
    imageSrc: null,
  }));
  const connectors = Array.from({ length: connectorCount }, (_, i) => ({
    id: `cn${i}`,
    kind: "connector",
    type: "elbow",
    source: { shapeId: `sh${i % shapeCount}`, anchor: "e", x: 0, y: 0 },
    target: { shapeId: `sh${(i + 1) % shapeCount}`, anchor: "w", x: 0, y: 0 },
    points: [],
    stroke: { color: "#4b5563", width: 1.5, style: "solid" },
    opacity: 1,
    startCap: "none",
    endCap: "filled-arrow",
    labels:
      i % 10 === 0
        ? [{ id: `lb${i}`, text: "yes", t: 0.5, offset: 0, style: textStyle, background: "#ffffff", border: null }]
        : [],
    locked: false,
    hidden: false,
    zIndex: shapeCount + i + 1,
    groupId: null,
  }));
  return {
    app: "flowshark",
    schemaVersion: 1,
    id: "bench",
    title: `Benchmark ${elements}`,
    createdAt: new Date().toISOString(),
    modifiedAt: new Date().toISOString(),
    canvas: {
      gridVisible: true,
      gridSize: 20,
      snapToGrid: true,
      snapToElement: true,
      snapTolerance: 6,
      background: "#ffffff",
    },
    shapes,
    connectors,
    groups: [],
  };
}

/** Runs inside the page: imports the real modules and times them. */
async function measureInPage({ json, repeats }) {
  const [{ parseDoc, serializeDoc }, render, { routeConnector }, { snapMove }] =
    await Promise.all([
      import("/src/model/serialization.ts"),
      import("/src/canvas/render.ts"),
      import("/src/connectors/routing.ts"),
      import("/src/core/snap.ts"),
    ]);

  const doc = parseDoc(json);
  const layer = document.createElementNS("http://www.w3.org/2000/svg", "g");
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("width", "1400");
  svg.setAttribute("height", "900");
  svg.appendChild(layer);
  document.body.appendChild(svg);

  const time = (fn) => {
    const t0 = performance.now();
    fn();
    return performance.now() - t0;
  };
  const samples = {};
  const record = (name, fn) => {
    (samples[name] ??= []).push(time(fn));
  };

  const movingIds = new Set(doc.shapes.slice(0, 1).map((s) => s.id));
  const origBounds = { x: doc.shapes[0].x, y: doc.shapes[0].y, w: doc.shapes[0].w, h: doc.shapes[0].h };

  // one untimed pass so JIT warm-up doesn't land in the first sample
  layer.innerHTML = render.docContentSVG(doc, false);

  for (let i = 0; i < repeats; i++) {
    record("parse", () => parseDoc(json));
    record("serialize", () => serializeDoc(doc));
    record("route", () => {
      for (const c of doc.connectors) routeConnector(doc, c);
    });
    let markup = "";
    record("buildContentSVG", () => {
      markup = render.docContentSVG(doc, false);
    });
    record("commitToDOM", () => {
      layer.innerHTML = markup;
    });
    record("fullRefresh", () => {
      layer.innerHTML = render.docContentSVG(doc, false);
    });
    record("undoSnapshot", () => structuredClone(doc));
    record("exportSVG", () => render.exportSVG(doc, { margin: 20 }));
    record("dragFrame", () => {
      const clone = structuredClone(doc);
      snapMove(clone, movingIds, 7, 5, origBounds, false);
      layer.innerHTML = render.docContentSVG(clone, false);
    });
  }

  svg.remove();

  const stats = (arr) => {
    const sorted = [...arr].sort((a, b) => a - b);
    const at = (p) => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
    return {
      median: +at(0.5).toFixed(2),
      p95: +at(0.95).toFixed(2),
      max: +sorted[sorted.length - 1].toFixed(2),
    };
  };
  const timings = {};
  for (const [name, arr] of Object.entries(samples)) timings[name] = stats(arr);
  return {
    shapes: doc.shapes.length,
    connectors: doc.connectors.length,
    svgChars: render.docContentSVG(doc, false).length,
    timings,
  };
}

const server = await createServer({
  server: { port: PORT, strictPort: true },
  logLevel: "error",
});
await server.listen();
const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}
);
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
page.on("pageerror", (err) => {
  console.error(`pageerror: ${err.message}`);
  process.exitCode = 1;
});

const results = [];
try {
  await page.goto(`http://localhost:${PORT}/`);
  await page.waitForSelector("#canvas-svg");
  console.log(`FlowShark benchmark — ${repeats} repeats per operation\n`);

  for (const size of sizes) {
    const json = JSON.stringify(buildDoc(size));
    const measured = await page.evaluate(measureInPage, { json, repeats });
    results.push({ size, ...measured });
    console.log(
      `${size} elements — ${measured.shapes} shapes, ${measured.connectors} connectors, ` +
        `${(measured.svgChars / 1024).toFixed(0)} KB of SVG`
    );
    for (const [name, s] of Object.entries(measured.timings)) {
      console.log(
        `  ${name.padEnd(16)} median ${String(s.median).padStart(9)} ms` +
          `   p95 ${String(s.p95).padStart(9)} ms   max ${String(s.max).padStart(9)} ms`
      );
    }
    console.log("");
  }
} finally {
  await browser.close();
  await server.close();
}

if (process.env.BENCH_JSON) {
  writeFileSync(
    process.env.BENCH_JSON,
    JSON.stringify({ when: new Date().toISOString(), repeats, results }, null, 2)
  );
  console.log(`Wrote ${process.env.BENCH_JSON}`);
}
