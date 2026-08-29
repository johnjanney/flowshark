# FlowShark 🦈

**A fast, native-feeling flowchart application for Windows on ARM.**

FlowShark is a lightweight but comprehensive diagram editor for building
professional flowcharts — business process maps, decision trees, system flows,
swimlane diagrams, and more. It targets Windows 11 on ARM (with x64 builds
from the same codebase) and runs in any modern browser during development.

**Status: 0.1.0 functional internal MVP, not a release candidate.** The core
acceptance workflow works end to end, and [REQUIREMENTS.md](REQUIREMENTS.md)
tracks every brief requirement with its status and evidence. The ARM
targeting is architectural — a native-ARM64 WebView2 shell, no emulation
layer, no Electron runtime — and the ARM64 installer is built in CI, but
performance has only been measured on x64 (see
[Measured performance](#measured-performance)), never on real Windows on ARM
hardware, and no formal accessibility audit has been done. Three of the
brief's definition-of-done criteria are unmet. See
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
  with validation, forward migration and resource limits on untrusted files;
  export to **PNG, SVG, PDF** (plus JPEG/WebP), scale/margin/transparency/grid
  options, export selection only, copy as image or SVG to clipboard; autosave
  with crash recovery; recent files (see [the caveat](#recent-files)).
- **Starter templates** — basic flowchart, decision tree, process map,
  swimlane, software logic, customer journey, approval workflow, incident
  response, sales funnel, project workflow.
- **Polish** — dark mode, zoom/pan/fit, infinite canvas, touch-friendly
  pointer events.
- **Accessibility** — ARIA-labeled controls, visible focus rings (including
  on the canvas), keyboard traversal of diagram objects with `Tab`/`Shift+Tab`
  announced through a live region, modal focus trapping, `forced-colors` and
  `prefers-reduced-motion` support, and exported SVGs that carry a title and
  generated description. **Not yet validated by a formal accessibility
  audit** — see Q17 and [REQUIREMENTS.md](REQUIREMENTS.md) §8.14.

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
node scripts/bench.mjs            # performance benchmark (no build needed)
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

## Measured performance

`scripts/bench.mjs` builds synthetic diagrams and times the operations a user
waits on, against the real modules in a real browser:

```bash
node scripts/bench.mjs             # sizes 100, 500, 2000
node scripts/bench.mjs 500         # one size
BENCH_JSON=bench.json node scripts/bench.mjs
```

Baseline, **x64 Linux + headless Chromium, 15 repeats** (median / p95, ms):

| Operation | 100 elements | 500 elements | 2,000 elements |
| --- | --- | --- | --- |
| Open a saved file (`parse`) | 0.7 / 6.6 | 1.8 / 3.4 | 6.3 / 10.2 |
| Route every connector | 0.3 / 0.8 | 2.2 / 3.4 | 11.6 / 23.2 |
| Build the content SVG | 1.1 / 3.8 | 6.8 / 9.0 | 27.9 / 37.0 |
| Commit it to the DOM | 1.6 / 3.2 | 7.2 / 13.3 | 29.6 / 55.7 |
| Full refresh | 3.1 / 4.4 | 13.8 / 20.7 | 59.5 / 151.5 |
| Undo snapshot (document clone) | 0.6 / 0.9 | 2.7 / 4.1 | 10.9 / 13.6 |
| **One drag frame** | **3.9 / 8.9** | **17.4 / 23.8** | **76.8 / 110.6** |
| SVG export | 1.9 / 3.2 | 9.1 / 11.2 | 41.0 / 75.7 |

Run-to-run variance is significant on a shared machine — a busier run of the
same build measured 22.9 ms median / 75.2 ms p95 for the 500-element drag
frame. Treat the figures as an order of magnitude, not a contract.

Reading this against the brief's §8.15 minimum of 500 shapes and connectors:
the target is **met, with limited headroom** — a drag frame costs ~17–23 ms
median (≈43–58 fps) but reaches 24–75 ms at p95 (as low as ≈13 fps), so
occasional stutter is expected on a busy 500-element diagram. By 2,000
elements dragging is ~13 fps and no longer acceptable. Drag renders are
coalesced to animation
frames, so a high-polling-rate mouse no longer triggers several full rebuilds
per displayed frame, but the per-frame cost above is unchanged — the
architectural fixes for it (incremental keyed SVG updates instead of a full
`innerHTML` rebuild, delta-based undo instead of whole-document clones) are
not in 0.1.0.

**These numbers are not the acceptance run.** Windows on ARM uses WebView2 on
different hardware; Q16 is closed only by running this script there.

## Recent files

On the desktop build the app's persistent filesystem permission is scoped to
`$DOCUMENT/**` (`src-tauri/capabilities/default.json`). Opening a file
elsewhere through the file dialog grants access for that session only, so a
recent-files entry outside Documents will fail to open after a restart.
FlowShark detects this and offers to reopen the file through the dialog
(which restores access), removing the entry if you decline. Keeping projects
under Documents avoids the prompt entirely.

## Browser support

FlowShark's primary target is the desktop build. It also runs in a browser,
where file handling degrades by engine:

| Capability | Chromium (Edge, Chrome) | Firefox | Safari |
| --- | --- | --- | --- |
| Open a file | File System Access API | `<input type=file>` fallback | `<input type=file>` fallback |
| Save in place | Yes | **No** — each save downloads a new file | **No** — each save downloads a new file |
| Recent files | Not persisted (handles aren't serializable) | Not persisted | Not persisted |
| Copy as image (PNG) | Yes | Depends on version/permission | Depends on version/permission |
| Copy as SVG (text) | Yes | Yes | Yes |
| Export PNG/SVG/PDF/JPEG/WebP | Yes | Yes | Yes (WebP depends on version) |

Where saving in place is unavailable the app says "Downloaded <name>" rather
than "Saved", so it is clear a new file was written. Automated browser
coverage currently runs in Chromium only; Firefox and Safari behavior above
is from capability detection in the code, not from a test run.

## Limits on opened files

A `.flowshark` file is ordinary JSON that can arrive from anywhere, so the
parser bounds what it will accept (`src/model/limits.ts`). Files over 32 MB
are refused with a clear message; shape/connector counts, bend points,
labels, text lengths, coordinates, dimensions, font sizes and stroke widths
are capped or clamped; grid rendering and raster export sizes are bounded so
a hostile or corrupt document degrades instead of hanging the app. The
ceilings are far above anything a real diagram reaches — a 20,000-element
document is well past the point where the editor is usable anyway.

## Release readiness

FlowShark 0.1.0 is a functional internal MVP: it implements the brief's core
acceptance workflow and is fine for internal use and demos, but it does not
satisfy the brief's definition of done. Before distributing it to outside
users, these remain open — they are tracked in
[OPENQUESTIONS.md](OPENQUESTIONS.md) and should be treated as release
blockers rather than nice-to-haves:

| Blocker | Why it blocks a public release | Tracked as |
| --- | --- | --- |
| Installers are unsigned | SmartScreen warnings; users get no provenance guarantee | Q4 |
| Windows-on-ARM performance unmeasured | Now measured on x64 (above) — adequate at 500 elements with limited headroom — but never run on ARM hardware | Q16 |
| No accessibility audit | Controls are labeled, the canvas is keyboard-traversable and focus is visible, but no screen-reader pass, contrast check or high-contrast test has been run | Q17 |
| Third-party GitHub Actions not pinned by commit SHA | A compromised or retagged action would run in the release pipeline | Q20 |

These brief items are knowingly deferred rather than blocking, and are
tracked the same way: connector routing around obstacles (Q10),
equal-spacing snap guides (Q9), true swimlane/phase containment (Q12), an
on-canvas rotation handle (Q11), and reinstating SVG import behind a real
sanitizer (Q18).

Findings from the independent audits are verified, prioritised and either
fixed or explicitly tracked, with regression tests for each fix — see
[CODEX-REVIEW-RESPONSE.md](CODEX-REVIEW-RESPONSE.md).

## Project documents

| File | Purpose |
| --- | --- |
| [PROJECTBRIEF.md](PROJECTBRIEF.md) | The original product brief (verbatim) + version-management appendix |
| [REQUIREMENTS.md](REQUIREMENTS.md) | Requirement-by-requirement traceability matrix with status and evidence |
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
