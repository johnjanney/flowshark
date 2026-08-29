/**
 * End-to-end smoke test: drives the built app in headless Chromium and
 * verifies the core editing loop works. Run `npx vite build` first, then
 * `node scripts/smoke.mjs`.
 *
 * By default this uses Playwright's own managed browser — run
 * `npx playwright install chromium` once and it just works. Only set
 * CHROMIUM_PATH if you need to point at a specific Chromium binary (e.g. a
 * sandboxed CI image with browsers pre-installed at a fixed, non-default
 * path).
 */
import { chromium } from "playwright";
import { preview } from "vite";
import { mkdirSync } from "node:fs";

const OUT = process.env.SMOKE_OUT ?? "smoke-artifacts";
mkdirSync(OUT, { recursive: true });

const server = await preview({ preview: { port: 4173, strictPort: true } });
const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}
);
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

const errors = [];
page.on("pageerror", (err) => errors.push(`pageerror: ${err.message}`));
page.on("console", (msg) => {
  if (msg.type() === "error") errors.push(`console: ${msg.text()}`);
});

function fail(msg) {
  console.error(`✗ ${msg}`);
  process.exitCode = 1;
}
function ok(msg) {
  console.log(`✓ ${msg}`);
}

try {
  await page.goto("http://localhost:4173/");
  await page.waitForSelector("#canvas-svg");
  ok("app loads");

  // 1. Place two shapes by arming from the shape panel and clicking canvas
  await page.click('.shape-item[aria-label="Add Process shape"]');
  await page.mouse.click(600, 300);
  await page.click('.shape-item[aria-label="Add Decision shape"]');
  await page.mouse.click(600, 520);
  const shapeCount = await page.locator('#canvas-svg g[data-kind="shape"]').count();
  if (shapeCount !== 2) fail(`expected 2 shapes, got ${shapeCount}`);
  else ok("shapes placed from panel");

  // 2. Double-click first shape and type text
  await page.mouse.dblclick(600, 300);
  await page.keyboard.type("Review request");
  await page.keyboard.press("Enter");
  const hasText = await page.locator('#canvas-svg text:has-text("Review request")').count();
  if (!hasText) fail("shape text editing failed");
  else ok("text edited inside shape");

  // 3. Connect the two shapes: deselect, hover first shape to reveal anchors,
  //    drag from its south anchor to the second shape
  await page.mouse.click(1000, 750); // empty canvas: clears selection
  await page.mouse.move(600, 300);
  await page.waitForSelector("#canvas-svg [data-anchor]");
  const anchor = await page.locator('#canvas-svg [data-anchor="s"]').first().boundingBox();
  await page.mouse.move(anchor.x + anchor.width / 2, anchor.y + anchor.height / 2);
  await page.mouse.down();
  await page.mouse.move(600, 470, { steps: 8 });
  await page.mouse.move(600, 515, { steps: 4 });
  await page.mouse.up();
  const connCount = await page.locator('#canvas-svg g[data-kind="connector"]').count();
  if (connCount !== 1) fail(`expected 1 connector, got ${connCount}`);
  else ok("connector drawn between shapes");

  // 4. Label the connector
  await page.mouse.dblclick(600, 420);
  await page.keyboard.type("Yes");
  await page.keyboard.press("Enter");
  const hasLabel = await page.locator('#canvas-svg text:has-text("Yes")').count();
  if (!hasLabel) fail("connector label failed");
  else ok("connector label added");

  // 5. Drag the decision shape and confirm the connector follows
  const before = await page
    .locator('#canvas-svg g[data-kind="connector"] path')
    .first()
    .getAttribute("d");
  await page.mouse.click(950, 200); // deselect
  await page.mouse.move(600, 520);
  await page.mouse.down();
  await page.mouse.move(800, 560, { steps: 10 });
  await page.mouse.up();
  const after = await page
    .locator('#canvas-svg g[data-kind="connector"] path')
    .first()
    .getAttribute("d");
  if (before === after) fail("connector did not reroute after moving shape");
  else ok("dynamic connector reroutes when shape moves");

  // 6. Undo the move, then redo
  await page.keyboard.press("Control+z");
  const undone = await page
    .locator('#canvas-svg g[data-kind="connector"] path')
    .first()
    .getAttribute("d");
  if (undone !== before) fail("undo did not restore connector path");
  else ok("undo restores state");
  await page.keyboard.press("Control+y");

  // 7. Duplicate the selected shape
  await page.mouse.click(800, 560);
  await page.keyboard.press("Control+d");
  const afterDup = await page.locator('#canvas-svg g[data-kind="shape"]').count();
  if (afterDup !== 3) fail(`expected 3 shapes after duplicate, got ${afterDup}`);
  else ok("duplicate works");
  await page.keyboard.press("Control+z");

  // 8. Marquee select all + group
  await page.keyboard.press("Control+a");
  await page.keyboard.press("Control+g");
  ok("select all + group executed");

  // 9. Zoom controls
  await page.keyboard.press("Control+0");
  ok("fit to screen");

  // 10. Export SVG via File menu (browser fallback = download)
  const downloadPromise = page.waitForEvent("download", { timeout: 10000 });
  await page.click('#toolbar .menu-wrap:first-child button');
  await page.click('.menu-item:has-text("Export SVG")');
  const download = await downloadPromise;
  const svgPath = `${OUT}/export.svg`;
  await download.saveAs(svgPath);
  ok(`SVG exported to ${svgPath}`);

  // 10b. Export PDF (jsPDF + svg2pdf.js) and confirm a real PDF comes out
  const pdfDownloadPromise = page.waitForEvent("download", { timeout: 15000 });
  await page.click('#toolbar .menu-wrap:first-child button');
  await page.click('.menu-item:has-text("Export PDF")');
  const pdfDownload = await pdfDownloadPromise;
  const pdfPath = `${OUT}/export.pdf`;
  await pdfDownload.saveAs(pdfPath);
  const { readFileSync, statSync } = await import("node:fs");
  const pdfBytes = readFileSync(pdfPath);
  const pdfHeaderOk = pdfBytes.subarray(0, 5).toString("ascii") === "%PDF-";
  const pdfSizeOk = statSync(pdfPath).size > 500;
  if (!pdfHeaderOk || !pdfSizeOk) {
    fail(`PDF export produced an invalid file (header ok: ${pdfHeaderOk}, size: ${statSync(pdfPath).size}b)`);
  } else {
    ok(`PDF exported to ${pdfPath} (valid %PDF header, ${statSync(pdfPath).size}b)`);
  }

  // 11. Screenshots, light and dark
  await page.mouse.click(950, 150);
  await page.screenshot({ path: `${OUT}/light.png` });
  await page.click('#toolbar button[aria-label="Toggle dark mode"]');
  await page.screenshot({ path: `${OUT}/dark.png` });
  ok("screenshots captured");

  // 12. Template gallery opens
  await page.click('#toolbar .menu-wrap:first-child button');
  await page.click('.menu-item:has-text("New from template")');
  // unsaved-changes confirmation appears first
  const discard = page.locator('.dialog button:has-text("Continue")');
  if (await discard.count()) {
    await discard.click();
    ok("unsaved-changes guard prompted before discarding");
  }
  await page.waitForSelector(".template-card");
  const cards = await page.locator(".template-card").count();
  if (cards < 10) fail(`expected at least 10 template cards, got ${cards}`);
  else ok(`template gallery shows ${cards} templates`);
  await page.click('.template-card:has-text("Basic flowchart")');
  await page.waitForSelector(".dialog", { state: "detached" }).catch(() => {});
  // confirm dialog may appear for unsaved changes
  const confirmBtn = page.locator('.dialog button:has-text("Continue")');
  if (await confirmBtn.count()) await confirmBtn.click();
  await page.screenshot({ path: `${OUT}/template.png` });
  ok("template loads");

  // 13. Canvas settings are undoable and mark the document dirty
  //     (regression: they used to mutate the document outside the command
  //     system, so they were silently lost on New/Open with no warning).
  await page.keyboard.press("Control+z"); // clear any pending state
  const dirtyBefore = await page.locator("#statusbar").innerText();
  await page.click('#toolbar button[aria-label^="Toggle grid"]');
  const dirtyAfter = await page.locator("#statusbar").innerText();
  if (!dirtyAfter.includes("Unsaved changes")) {
    fail(`toggling the grid did not mark the document dirty (status: "${dirtyAfter.trim()}")`);
  } else {
    ok("canvas settings mark the document dirty");
  }
  const gridBefore = await page.locator("#canvas-svg g").first().innerHTML();
  await page.keyboard.press("Control+z");
  const gridAfter = await page.locator("#canvas-svg g").first().innerHTML();
  if (gridBefore === gridAfter) fail("undo did not revert the grid toggle");
  else ok("canvas settings are undoable");
  void dirtyBefore;

  // 14. Escape dismisses a confirmation dialog and settles its promise
  //     (regression: Escape left the promise pending forever, so the command
  //     that opened it silently did nothing and could never be retried).
  await page.click("#canvas-svg");
  await page.mouse.dblclick(500, 400); // make the document dirty again
  await page.keyboard.press("Escape");
  await page.keyboard.press("Control+n");
  await page.waitForSelector('.dialog button:has-text("Continue")');
  await page.keyboard.press("Escape");
  await page.waitForSelector(".dialog", { state: "detached", timeout: 3000 });
  await page.keyboard.press("Control+n");
  const reprompted = await page
    .waitForSelector('.dialog button:has-text("Continue")', { timeout: 3000 })
    .then(() => true)
    .catch(() => false);
  if (!reprompted) fail("dismissing the unsaved-changes dialog left the command wedged");
  else ok("Escape dismisses the confirmation and the command can be retried");
  await page.keyboard.press("Escape");
  await page.waitForSelector(".dialog", { state: "detached", timeout: 3000 }).catch(() => {});

  // 15. Keyboard-only traversal of diagram objects
  await page.click('#toolbar .menu-wrap:first-child button');
  await page.click('.menu-item:has-text("New from template")');
  const discard2 = page.locator('.dialog button:has-text("Continue")');
  if (await discard2.count()) await discard2.click();
  await page.waitForSelector(".template-card");
  await page.click('.template-card:has-text("Basic flowchart")');
  await page.waitForSelector('#canvas-svg g[data-kind="shape"]');
  await page.locator("#canvas-svg").focus();
  await page.keyboard.press("Tab");
  const announced = await page.locator("#canvas-host [aria-live]").innerText();
  if (!announced.trim()) fail("Tab on the canvas announced nothing to assistive tech");
  else ok(`keyboard traversal announces objects ("${announced.trim().slice(0, 48)}")`);
  const selectedAfterTab = await page.locator("#statusbar").innerText();
  if (!selectedAfterTab.includes("1 selected")) {
    fail(`Tab on the canvas did not select an object (status: "${selectedAfterTab.trim()}")`);
  } else {
    ok("Tab selects a diagram object");
  }

  const errFatal = errors.filter(
    (e) => !e.includes("favicon") && !e.includes("Autofill")
  );
  if (errFatal.length) {
    fail(`console/page errors:\n  ${errFatal.join("\n  ")}`);
  } else {
    ok("no console errors");
  }
} catch (err) {
  fail(`smoke test crashed: ${err.stack ?? err}`);
  await page.screenshot({ path: `${OUT}/failure.png` }).catch(() => {});
} finally {
  await browser.close();
  await new Promise((r) => server.httpServer.close(r));
}

console.log(process.exitCode ? "SMOKE TEST FAILED" : "SMOKE TEST PASSED");
