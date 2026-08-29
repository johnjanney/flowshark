# FlowShark 🦈

**A fast, native-feeling flowchart application for Windows on ARM.**

FlowShark is a lightweight but comprehensive diagram editor for building
professional flowcharts — business process maps, decision trees, system flows,
swimlane diagrams, and more. It targets Windows 11 on ARM (with x64 builds
from the same codebase) and runs in any modern browser during development.

**Status: 0.1.0 MVP, not yet a release candidate.** The ARM targeting is
architectural — a native-ARM64 WebView2 shell, no emulation layer, no
Electron runtime — and the ARM64 installer is built in CI, but frame-time
and large-document performance have not yet been measured on real Windows
on ARM hardware, and no formal accessibility audit has been done. See
[Release readiness](#release-readiness) below.

![FlowShark dark mode](docs/images/flowshark-dark.png)

## Features

- **Complete flowchart shape library** — process, decision, terminator,
  input/output, document(s), manual input/operation, preparation, predefined
  process, database, internal/direct/sequential storage, display, delay,
  connectors, off-page connector, merge, extract, sort, collate, stored data,
  annotation, callout, swimlane and phase containers — plus general shapes
  (rectangle, ellipse, triangle, diamond, hexagon, cylinder, cloud, star,
  text box, image and icon placeholders).
- **Rich connectors** — straight, elbow, step, curved, and freeform routing;
  dynamic rerouting when shapes move; fixed or floating attachment points;
  eleven endpoint styles (arrows, diamonds, circles, squares, bar); dashed,
  dotted, and thick/thin lines; movable bend points; draggable text labels
  with background fill.
- **Text everywhere** — double-click to edit text in any shape, on any
  connector, or as standalone text boxes; font family/size/weight/style,
  color, alignment (horizontal + vertical), wrapping, padding, line spacing.
- **Professional layout tools** — snap-to-grid, snap-to-element with live
  alignment guides, align (left/center/right/top/middle/bottom), distribute
  (horizontal/vertical), match size, group/ungroup, z-ordering, lock/hide.
- **Solid editing** — 200-step undo/redo, cut/copy/paste/duplicate,
  copy/paste style, marquee and multi-select, keyboard nudging, full
  keyboard-shortcut set.
- **Files and export** — versioned JSON-based `.flowshark` project format
  with validation and forward migration; export to **PNG, SVG, PDF** (plus
  JPEG/WebP), scale/margin/transparency/grid options, export selection only,
  copy as image or SVG to clipboard; autosave with crash recovery; recent
  files.
- **Starter templates** — basic flowchart, decision tree, process map,
  swimlane, software logic, customer journey, approval workflow, incident
  response, sales funnel, project workflow.
- **Polish** — dark mode, zoom/pan/fit, infinite canvas, touch-friendly
  pointer events, ARIA-labeled controls and focus-visible styles (not yet
  validated by a formal accessibility audit — see Q17).

See [INSTRUCTIONS.md](INSTRUCTIONS.md) for the full user guide, and
[PROJECTBRIEF.md](PROJECTBRIEF.md) for the original product brief.

## Technology

FlowShark implements **Option C** from the project brief: a web-based desktop
shell chosen for development speed, small footprint, and first-class SVG
export fidelity.

| Layer | Technology |
| --- | --- |
| Desktop shell | [Tauri 2](https://tauri.app) + WebView2 (native ARM64 on Windows on ARM) |
| UI / editor | TypeScript, no framework — direct DOM + SVG rendering engine |
| Rendering | SVG scene graph; the same renderer drives the screen, SVG/PNG/PDF export |
| PDF export | jsPDF + svg2pdf.js (lazy-loaded) |
| Build | Vite 6, Rust (stable) for the shell |
| Tests | Vitest unit tests + Playwright end-to-end smoke test |

Everything in the document model is plain JSON; rendering, model, UI, and
export are separate modules (see `src/model`, `src/core`, `src/shapes`,
`src/connectors`, `src/canvas`, `src/ui`, `src/io`).

## Installing FlowShark (non-developers)

If you just want to run FlowShark rather than work on its code, see
**[INSTALLATION.md](INSTALLATION.md)** — a step-by-step guide that assumes
no prior developer tools are installed, written for Windows on ARM.

## Getting started (development)

Prerequisites: Node.js ≥ 20. For desktop builds: Rust (stable) and the
[Tauri prerequisites](https://tauri.app/start/prerequisites/) for your OS.

```bash
npm install
npm run dev          # browser dev server at http://localhost:1420
npm test             # unit tests (Vitest)
npm run typecheck    # TypeScript
npm run build        # typecheck + production bundle to dist/

npx playwright install chromium   # one-time, for the smoke test
node scripts/smoke.mjs            # end-to-end smoke test (run npm run build first)
```

The smoke test uses Playwright's own managed Chromium, so it needs the
one-time `npx playwright install chromium` above. Set `CHROMIUM_PATH` only
if you need to point it at a specific Chromium binary (for example a CI
image with browsers pre-installed at a fixed path).

The full editor runs in a plain browser during development — file dialogs
fall back to the File System Access API or downloads.

Dependency audits (also run in CI on every push/PR):

```bash
npm audit --omit=dev                    # shipped npm dependencies
cargo audit -f src-tauri/Cargo.lock     # Rust/Tauri dependencies (cargo install cargo-audit)
```

## Building for Windows on ARM

On a Windows ARM machine (or the `windows-11-arm` GitHub runner):

```powershell
rustup target add aarch64-pc-windows-msvc
npm ci
npx tauri build --target aarch64-pc-windows-msvc
```

The NSIS installer lands in
`src-tauri/target/aarch64-pc-windows-msvc/release/bundle/nsis/`.
For x64: substitute `x86_64-pc-windows-msvc`.

CI (`.github/workflows/ci.yml`) runs typecheck, unit tests, the Chromium
smoke test, and the npm + cargo dependency audits on every push/PR, and builds Windows ARM64 + x64 installers on
pushes to `main`, tags, and manual dispatch. Tagging `v*` attaches installers
to a draft GitHub release.

## Release readiness

FlowShark 0.1.0 is a complete, working MVP and is fine for internal use and
demos. Before distributing it to outside users, these remain open — they are
tracked in [OPENQUESTIONS.md](OPENQUESTIONS.md) and should be treated as
release blockers rather than nice-to-haves:

| Blocker | Why it blocks a public release | Tracked as |
| --- | --- | --- |
| Installers are unsigned | SmartScreen warnings; users get no provenance guarantee | Q4 |
| Windows-on-ARM performance unmeasured | The brief targets hundreds of elements; the renderer rebuilds SVG on each change and undo uses full-document snapshots. Both are deliberate MVP tradeoffs, but unprofiled on real hardware | Q16 |
| No accessibility audit | Controls are ARIA-labeled and keyboard-driven, but no screen-reader pass or contrast check has been run | Q17 |

These brief items are knowingly deferred rather than blocking, and are
tracked the same way: connector routing around obstacles (Q10),
equal-spacing snap guides (Q9), true swimlane/phase containment (Q12), an
on-canvas rotation handle (Q11), and reinstating SVG import behind a real
sanitizer (Q18).

Security fixes from the independent audit are applied and covered by
regression tests — see
[CODEX-REVIEW-RESPONSE.md](CODEX-REVIEW-RESPONSE.md).

## Project documents

| File | Purpose |
| --- | --- |
| [PROJECTBRIEF.md](PROJECTBRIEF.md) | The original product brief (verbatim) + version-management appendix |
| [INSTALLATION.md](INSTALLATION.md) | Step-by-step install guide, assuming no prerequisites |
| [INSTRUCTIONS.md](INSTRUCTIONS.md) | User guide: how to use the application |
| [CHANGELOG.md](CHANGELOG.md) | Version history (Keep a Changelog format) |
| [OPENQUESTIONS.md](OPENQUESTIONS.md) | Open and resolved questions/decisions |
| [VERSIONING.md](VERSIONING.md) | How versions, releases, and the file-format schema are managed |
| [CODEX-REVIEW.md](CODEX-REVIEW.md) | Independent quality/security audit |
| [CODEX-REVIEW-RESPONSE.md](CODEX-REVIEW-RESPONSE.md) | Verification of and response to that audit |

## Version management (summary)

- App versions follow **SemVer** (`MAJOR.MINOR.PATCH`), kept in sync across
  `package.json`, `src-tauri/tauri.conf.json`, and `src-tauri/Cargo.toml`.
- The `.flowshark` file format has its own integer **schema version** with
  forward migrations on load.
- All notable changes go to **CHANGELOG.md** under `[Unreleased]` first.
- Releases are cut by tagging `vX.Y.Z`; CI produces the Windows installers.

Full details and step-by-step release instructions: [VERSIONING.md](VERSIONING.md).

## License

No license has been chosen yet — see OPENQUESTIONS.md.
