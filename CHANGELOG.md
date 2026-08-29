# Changelog

All notable changes to FlowShark are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
See [VERSIONING.md](VERSIONING.md) for how versions, releases, and the
`.flowshark` document schema are managed.

## [Unreleased]

### Security

- **High**: fixed unescaped attribute interpolation that let a crafted
  `.flowshark` file break out of SVG attribute context (fill/stroke/text
  colors, element ids, connector caps, label background/border) and inject
  arbitrary attributes/elements into the live renderer and PDF export path,
  both of which render via `innerHTML`. Fixed by escaping every value at
  render time (`src/canvas/render.ts`, `src/connectors/routing.ts`,
  `src/core/text.ts`) and, as defense in depth, validating colors/ids
  against a strict allowlist at the document-parse boundary
  (`src/model/serialization.ts`, `src/core/safety.ts`). Regression tests
  added in `tests/render.test.ts` and `tests/serialization.test.ts`. Found
  by an independent Codex review — see
  [CODEX-REVIEW-RESPONSE.md](CODEX-REVIEW-RESPONSE.md).
- **Medium**: removed SVG as an accepted import/paste image format.
  `data:image/svg+xml` was accepted with no sanitization (brief §13
  requires sanitizing SVG imports); properly sanitizing arbitrary
  attacker-controlled SVG needs a real XML/DOM sanitizer this app doesn't
  bundle yet. `imageSrc` is now validated against a raster-only allowlist
  at every entry point (file import, clipboard paste, and document
  parsing), not just the file picker's extension filter.
- **Moderate**: bumped `dompurify` (bundled through jsPDF's optional
  `html()` support, and present in `dist/` as a lazily-loaded chunk) from
  3.4.11 to 3.4.14, clearing two DOMPurify XSS advisories
  ([GHSA-c2j3-45gr-mqc4](https://github.com/advisories/GHSA-c2j3-45gr-mqc4),
  [GHSA-55q2-fjhq-7xh7](https://github.com/advisories/GHSA-55q2-fjhq-7xh7)).
  `npm audit --omit=dev` is clean again; PDF export re-verified via the
  smoke test.
- **Defense in depth**: escaped the document-derived element ids that the
  selection-overlay layer interpolates into SVG attributes
  (`src/canvas/view.ts`, which also renders via `innerHTML`). The parse
  boundary already restricts ids to `[A-Za-z0-9_-]`, so this was not
  exploitable, but it was the one remaining `innerHTML` path in the app
  that trusted upstream validation instead of escaping at the point of
  output — the same pattern that produced the High-severity finding.
- **Medium**: narrowed the Tauri filesystem capability scope from
  `$HOME/**` plus five other broad directories down to just
  `$DOCUMENT/**`. Every file operation (open/save/export/import) goes
  through the dialog plugin, which grants scope for the user-picked path
  regardless of static scope; the narrower scope only affects reopening a
  "recent file" that was last saved outside Documents on a new app launch,
  which now needs File → Open instead of one click.

### Fixed

- `Editor.undo()`/`redo()` marked the document dirty unconditionally, so
  undoing back to exactly the last-saved state still showed "unsaved
  changes" and kept autosaving. Dirty is now computed from whether the
  undo-stack position matches the position at last save, correctly
  handling the case where a new edit branches off after undoing past the
  save point (the old save point becomes unreachable and dirty stays true).
- `scripts/smoke.mjs` hardcoded a sandbox-specific Chromium path as its
  default, breaking `node scripts/smoke.mjs` on any other machine unless
  `CHROMIUM_PATH` was set. Now defaults to Playwright's own managed
  browser resolution (works after a plain `npx playwright install
  chromium`) and only overrides the executable when `CHROMIUM_PATH` is
  explicitly set.
- Autosave failures (e.g. a large diagram with embedded images exceeding
  the browser's storage quota) were silently swallowed forever. Now warns
  the user once per session via a toast so they know to save manually.
- Documentation drift left by the SVG-import removal: INSTRUCTIONS.md still
  advertised SVG as an importable format. It now lists the raster formats
  that are actually accepted and explains why SVG is excluded.
- README's smoke-test instructions omitted the one-time `npx playwright
  install chromium` step, so `node scripts/smoke.mjs` still failed on a
  fresh clone even after the script's hardcoded Chromium path was removed.
- README described the app as "optimized for Windows 11 on ARM" and its
  controls as "accessible" without evidence for either. Both claims are now
  stated as design intent with the validation gaps named (Q16/Q17).
- `tests/serialization.test.ts` had a no-op assertion
  (`expect(x).toBeUndefined` missing its call parens) that silently
  validated nothing.
- The document-title field bypassed undo/redo entirely, which could also
  leave it out of sync with the new dirty-tracking fix above. Routed
  through `editor.apply()` like every other edit — title changes are now
  undoable too.

### Added

- A `Dependency audit (npm + cargo)` CI job running `npm audit --omit=dev
  --audit-level=moderate` and `cargo audit` on every push and PR. The
  original review could not audit the Rust/Tauri dependency tree at all
  (no `cargo` on the reviewer's machine); it has now been run — 0
  vulnerabilities, 17 unmaintained/unsound warnings, 11 of which are the
  GTK3 stack that only compiles on Linux and never ships in the Windows
  builds, and 6 the unmaintained `unic-*` crates pulled in transitively by
  `tauri-utils` via `urlpattern`. CI keeps both audits from silently
  drifting again.
- A **Release readiness** section in README.md naming the three things that
  block a public release (unsigned installers, unmeasured Windows-on-ARM
  performance, no accessibility audit) and the brief items that are
  knowingly deferred, so "MVP" and "release candidate" aren't conflated.
- Two general shapes from the brief (§8.2) that were missing from the
  shape library: **Line** and **Arrow**.
- A **Connectors** category in the left shape panel (brief §8.13), between
  General and Containers — click a connector type there to arm the
  connector tool with it, same as the existing toolbar dropdown.
- `INSTALLATION.md` — a step-by-step installation guide for Windows on ARM
  that assumes no prerequisites are already installed (Git, Node.js, Rust,
  and the Visual C++ Build Tools with the ARM64 target component), based on
  the exact sequence needed on a real, fresh Windows on ARM machine.
  Linked from README.md.

### Fixed

- Overrode `rollup` to `@rollup/wasm-node` (the official WASM build) to work
  around `@rollup/rollup-win32-arm64-msvc` failing to load on a Windows on
  ARM development machine (`Error: ... is not a valid Win32 application`)
  even after clean reinstalls with a correctly-sized downloaded binary —
  consistent with the native binary being blocked/altered by endpoint
  security software rather than a corrupted download. The WASM build sidesteps
  native binary loading entirely and produces an identical build output
  (verified via the full test suite and smoke test). See
  [OPENQUESTIONS.md](OPENQUESTIONS.md) Q14 for when this override can be
  revisited.

### Security

- Upgraded `jspdf` from ^3.0.1 to ^4.2.1 and `svg2pdf.js` from ^2.5.0 to
  ^2.7.0, resolving a critical advisory affecting jsPDF ≤4.2.0 (path
  traversal, PDF/JS injection, and DoS issues; see
  [GHSA-f8cm-6447-x5h2](https://github.com/advisories/GHSA-f8cm-6447-x5h2)
  and related advisories). Verified PDF export renders correctly against the
  new major version via the Playwright smoke test.

## [0.1.0] - 2026-07-08

Initial MVP implementation of the FlowShark flowchart editor per
[PROJECTBRIEF.md](PROJECTBRIEF.md).

### Added

- **Editor core**
  - Infinite SVG canvas with zoom (10%–800%), pan (mouse/trackpad/space/tool),
    fit-to-screen and fit-selection.
  - Selection: single, shift/ctrl multi-select, marquee, select all;
    selection expands over groups.
  - Snapshot-based undo/redo (200 steps), cut/copy/paste/duplicate/delete,
    copy style / paste style, nudge and large-nudge with arrow keys.
  - Group/ungroup, bring to front/forward/backward/send to back,
    lock/unlock, hide/show.
- **Shape library** — all 27 flowchart shapes from the brief (process,
  decision, terminator, input/output, document, multiple documents, manual
  input, manual operation, preparation, predefined process, database,
  internal storage, direct access storage, sequential access storage,
  display, delay, connector circle, off-page connector, merge, extract,
  sort, collate, stored data, annotation, callout, swimlane, phase) plus 12
  general shapes (rectangle, rounded rectangle, ellipse, triangle, diamond,
  hexagon, cylinder, cloud, star, text box, image placeholder, icon
  placeholder). Searchable shape panel with categories and recently used.
- **Connectors** — straight, elbow, step, curved, and freeform types;
  attached (fixed anchor or floating) and free endpoints; dynamic rerouting
  when shapes move; manual bend points (insert by dragging segment
  midpoints, remove with Alt+click); endpoint reconnection by dragging;
  eleven cap styles; solid/dashed/dotted lines with adjustable width, color,
  opacity; reverse-direction and clear-bends commands.
- **Text** — inline plain-text editing in every shape (double-click or F2),
  standalone text boxes, connector labels (double-click a connector) with
  position/offset controls and background fill; font family/size,
  bold/italic/underline, color, horizontal + vertical alignment, wrapping,
  padding, line spacing.
- **Styling** — fill color + opacity, border color/width/style, corner
  radius, contextual properties inspector, per-canvas background color.
- **Layout tools** — snap-to-grid (toggle, adjustable size), snap-to-element
  with live alignment guides and adjustable tolerance, Alt to bypass
  snapping; align left/center/right/top/middle/bottom; distribute
  horizontally/vertically; match width/height/size.
- **Files** — versioned JSON `.flowshark` format (schema v1) with strict
  validation, sanitization, and forward-migration hooks; new/open/save/save
  as; recent files (desktop); autosave every 15 s with crash-recovery
  banner; unsaved-changes guards.
- **Import/export** — PNG, SVG, PDF export (plus JPEG and WebP) with scale,
  margin, transparent-background, include-grid, and export-selection
  options; copy as PNG or SVG to the clipboard; import images
  (PNG/JPEG/WebP/SVG) as image objects; paste images from the clipboard.
- **Templates** — 10 editable starter templates: basic flowchart, decision
  tree, process map, cross-functional swimlane, software logic flow,
  customer journey, approval workflow, incident response, sales funnel,
  project workflow (+ blank), with live preview gallery.
- **Keyboard shortcuts** — full set per brief §8.12 (Ctrl+N/O/S/Shift+S,
  Z/Y, X/C/V/D, A, G/Shift+G, +/−/0, Delete, arrows) plus tool keys
  (V/H/T/C), F2, Ctrl+E export, Ctrl+[/] ordering, Ctrl+Shift+C/V style.
- **UI** — top toolbar with File/Edit/View menus, left shape panel, central
  canvas, right contextual inspector, status bar (cursor position, selection
  count, zoom, unsaved indicator); dark mode with saved preference;
  ARIA-labeled controls and keyboard-focus styles.
- **Windows ARM shell** — Tauri 2 application shell targeting
  `aarch64-pc-windows-msvc` (primary) and `x86_64-pc-windows-msvc`
  (secondary), native file dialogs, NSIS installer bundling, generated app
  icons.
- **Quality** — 56 unit tests (serialization, undo/redo, clipboard,
  grouping, alignment/distribution, z-order, snapping, routing, rendering,
  templates, text layout) and a 16-step Playwright smoke test that drives
  the real UI in Chromium; GitHub Actions CI with Windows ARM64/x64
  installer builds and tag-driven draft releases.

[Unreleased]: https://github.com/johnjanney/flowshark/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/johnjanney/flowshark/releases/tag/v0.1.0
