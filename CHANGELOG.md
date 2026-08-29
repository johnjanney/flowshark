# Changelog

All notable changes to FlowShark are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
See [VERSIONING.md](VERSIONING.md) for how versions, releases, and the
`.flowshark` document schema are managed.

## [Unreleased]

### Security

- **Untrusted documents are now bounded** (`src/model/limits.ts`). A
  `.flowshark` file is ordinary JSON that can come from anywhere; previously
  the parser checked numbers for finiteness but imposed no upper bounds, so a
  crafted or corrupt file could exhaust memory/CPU through unlimited element
  counts, extreme coordinates, million-character strings, or a two-unit grid
  spanning millions of document units. Files over 32 MB are now refused
  before `JSON.parse` with an explanatory `DocumentError`; shape, connector,
  group, bend-point and label counts are capped; coordinates, dimensions,
  rotation, font size, stroke width, corner radius, padding, z-index, grid
  size and snap tolerance are clamped; text, titles and font-family strings
  are truncated. Grid generation widens its step rather than emitting
  unbounded path segments, and raster export refuses sizes above 80 MP /
  20,000 px per side with a message naming the limit instead of failing
  opaquely inside the canvas allocator. Adversarial tests in
  `tests/limits.test.ts`.
- **Hardened document relationship validation.** Ids are now unique across
  one global namespace (shapes, connectors *and* groups — previously a group
  could reuse an element's id), group membership is deduplicated, an element
  can belong to only one group, each element's `groupId` is rebuilt from the
  authoritative membership lists rather than trusted from the file, duplicate
  connector-label ids are dropped, and connector anchors are validated
  against the real connection-point names instead of accepting any string.
  Malformed files are repaired deterministically rather than producing
  ambiguous selection/ungroup behavior.
- **Least-privilege CI token.** `.github/workflows/ci.yml` now declares
  `permissions: contents: read` at the workflow level; only the release job
  opts into `contents: write`.

### Fixed

- **Canvas settings were lost silently and could not be undone.** Grid size,
  grid visibility, snap-to-grid, snap-to-element, snap tolerance and the
  diagram background were mutated directly by the inspector and the toolbar
  toggles, bypassing the command system: they left `dirty` false, pushed no
  undo entry, and were skipped by autosave (which only runs for dirty
  documents), so changing the background and then opening another file
  discarded the change with no warning. All six now go through a new
  `Editor.setCanvas()` command — undoable, dirty-marking, autosave-eligible,
  and covered by the unsaved-changes confirmation. Regression tests in
  `tests/editor.test.ts` and `scripts/smoke.mjs`.
- **Dismissing a confirmation dialog wedged the command that opened it.**
  `confirmDialog()` only settled its promise when a button was clicked, so
  closing the unsaved-changes prompt with Escape or a backdrop click left the
  promise pending forever and New / Open / New-from-template silently did
  nothing, with no error and no way to tell what happened. `openDialog()`
  now takes an `onDismiss` callback and `confirmDialog()` resolves `false` on
  any dismissal. Covered by the smoke test.
- **Recovered work could be silently re-marked as saved.** The crash-recovery
  banner set `editor.dirty = true` directly, but `savedDepth` still pointed at
  the (empty) undo stack, so undoing an edit made after restoring recomputed
  `dirty` back to false — the never-saved recovered diagram then had no
  unsaved-changes guard. Added `Editor.markUnsaved()`, which marks the saved
  state permanently unreachable.
- **A failed recent-files write turned a successful save into "Save failed".**
  `addRecentFile()` ran inside `Actions.save()`'s try block and could throw on
  a full or disabled `localStorage`, after the file had already been written
  and the document marked clean. It is now best-effort and swallows storage
  errors, and also validates entries it reads back so a corrupt record can't
  render as an `undefined` menu item.
- **Recent files outside Documents failed with a raw permission error.** The
  desktop build's persistent filesystem scope is `$DOCUMENT/**` and the wider
  grant an open dialog confers does not survive a restart. FlowShark now
  detects the failure, offers to reopen the file through the dialog (which
  restores access), and removes the entry if the user declines. Documented in
  README and INSTRUCTIONS; tracked as Q21.
- **CI never attached installers to a release.** `actions/upload-artifact@v4`
  roots an artifact at the least common ancestor of its input paths, so the
  NSIS installers landed under `bundle/nsis/` inside the artifact while the
  release job globbed `nsis/*.exe`. Tagged releases were therefore created
  empty, silently. Fixed the glob and set `fail_on_unmatched_files: true` so
  the job fails loudly if it ever regresses.
- **Long unbroken text could hang the renderer.** `wrapText()`'s hard-break
  path walked back one character at a time, making it O(n²) text measurements
  for a long run; it now binary-searches the break point.
- **The canvas had no visible focus indicator.** `#canvas-svg:focus { outline:
  none }` suppressed it entirely, leaving keyboard users unable to tell where
  focus was on the app's main interactive surface. Replaced with a
  `:focus-visible` ring.

### Added

- **Keyboard traversal of the diagram.** With the canvas focused, `Tab` and
  `Shift+Tab` step through every shape and connector in painting order,
  selecting each and announcing it through a polite ARIA live region;
  `Enter` edits the selected shape's text. Previously a keyboard-only user
  could reach the toolbar and panels but never an individual diagram object.
  Traversal stops at the ends rather than wrapping, so Tab still leaves the
  canvas for the inspector and the canvas never becomes a keyboard trap
  (WCAG 2.1.2), and it tracks its own cursor rather than deriving one from
  the selection — the selection group-expands, which would otherwise stall
  traversal inside a group forever.
- **Accessibility improvements.** Modal dialogs are `aria-modal`, trap Tab
  focus and restore focus to the invoking control on close; the canvas is
  `role="application"` with an instructional label; `forced-colors` (Windows
  high contrast) and `prefers-reduced-motion` are honoured; exported SVGs
  carry `role="img"`, a `<title>` and a generated `<desc>` describing the
  diagram's content (brief §8.14, "alt text for exported diagrams").
- **`scripts/bench.mjs`** — a reproducible performance benchmark that
  generates 100/500/2,000-element fixtures and times parsing, routing, SVG
  build, DOM commit, undo snapshots, drag frames and export against the real
  modules in a real browser. The x64 baseline is recorded in README; the
  Windows-on-ARM acceptance run (Q16) is this script on that hardware.
- **[REQUIREMENTS.md](REQUIREMENTS.md)** — a requirement-by-requirement
  traceability matrix (Implemented / Partial / Deferred / N/A with evidence)
  covering every section of the brief, so "MVP complete" is checkable rather
  than asserted.

### Changed

- **Drag rendering is coalesced to animation frames.** Pointer devices deliver
  moves faster than the display refreshes, and each drag frame deep-clones the
  document and rebuilds the whole SVG (~23 ms at 500 elements), so several
  full rebuilds could run per displayed frame. State is still computed from
  the latest pointer position and flushed synchronously on pointer-up, so undo
  entries still match where the pointer stopped.
- **README no longer calls 0.1.0 a "complete, working MVP"** — it is a
  functional internal MVP with three unmet definition-of-done criteria. Added
  measured performance figures, a browser-support matrix documenting degraded
  save/clipboard behavior, the recent-files limitation, and the document
  resource limits.
- Error toasts now show an error's message rather than its stringified form,
  and a browser save that could only download says "Downloaded…" rather than
  "Saved…".

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
