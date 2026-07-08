# Changelog

All notable changes to FlowShark are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
See [VERSIONING.md](VERSIONING.md) for how versions, releases, and the
`.flowshark` document schema are managed.

## [Unreleased]

### Added

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
