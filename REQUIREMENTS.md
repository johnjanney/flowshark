# Requirements traceability

Every requirement in [PROJECTBRIEF.md](PROJECTBRIEF.md), with its current
status and the evidence for that status. This exists so "MVP complete" is a
checkable claim rather than an assertion — see
[CODEX-REVIEW.md](CODEX-REVIEW.md) finding "Low 8".

Status values:

| Status | Meaning |
| --- | --- |
| **Implemented** | Present, exercised by a test or the smoke suite |
| **Partial** | Present but incomplete, or complete but unverified |
| **Deferred** | Deliberately not in 0.1.0; tracked in [OPENQUESTIONS.md](OPENQUESTIONS.md) |
| **N/A** | The brief marks it optional and it was not attempted |

Last reviewed: 2026-08-29 against FlowShark 0.1.0.

## §3 Platform and performance

| Requirement | Status | Evidence |
| --- | --- | --- |
| Windows 11 on ARM primary target | Implemented | Tauri 2 + native ARM64 WebView2; `windows-11-arm` CI job builds the NSIS installer |
| Windows 11 x64 secondary | Implemented | `x86_64-pc-windows-msvc` CI job |
| Fast startup | **Partial** | Not measured on ARM hardware (Q16) |
| Smooth pan and zoom | Implemented | Viewport transform only; no content rebuild on pan/zoom |
| Responsive drag/resize/connect/snap/text | **Partial** | Measured on x64 Chromium: 17-23 ms median drag frame at 500 elements (see README "Measured performance"). Not measured on ARM (Q16) |
| Efficient rendering with hundreds of elements | **Partial** | 500-element target met with margin on x64; degrades sharply by 2,000 (see benchmark) |
| Touch/pen/touchpad interactions | **Partial** | Pointer Events throughout, `touch-action: none`; no device testing (Q17) |

## §8.1 Canvas and workspace

| Requirement | Status | Evidence |
| --- | --- | --- |
| Infinite/expandable canvas | Implemented | Unbounded document coordinates (bounded only by the parse-time safety limit) |
| Optional visible grid | Implemented | `gridSVG`, toolbar toggle, `tests/limits.test.ts` |
| Toggleable snap-to-grid / snap-to-element | Implemented | `src/core/snap.ts`, `tests/snap.test.ts` |
| Zoom in/out, fit to screen, fit selection | Implemented | `Actions.zoomIn/zoomOut/fitToContent/fitSelection`; smoke test |
| Pan by mouse, trackpad, keyboard, scroll | Implemented | Middle-drag, space-drag, pan tool, wheel |
| Single / multi / marquee selection | Implemented | `tests/editor.test.ts`, smoke test |
| Drag, resize with handles | Implemented | Smoke test |
| Rotate objects | **Partial** | Model, renderer and inspector support rotation; no on-canvas handle (Q11) |
| Bring forward/backward, to front/back | Implemented | `Editor.order`, `tests/editor.test.ts` |
| Lock/unlock, hide/show | Implemented | `Editor.setLocked/setHidden` |
| Zoom percentage control | Implemented | Status bar |
| Minimap / rulers / page boundaries | Deferred | Brief marks optional (Q6) |
| Dark mode | Implemented | `main.ts` theme toggle; smoke screenshots |

## §8.2 Shape library

| Requirement | Status | Evidence |
| --- | --- | --- |
| All 27 required flowchart shapes | Implemented | `src/shapes/registry.ts`; `tests/render.test.ts` renders every registered type |
| General shapes incl. line and arrow | Implemented | Added in the previous review round |
| Drag-drop placement, resize, move, duplicate, delete, copy/paste | Implemented | Smoke test, `tests/editor.test.ts` |
| Style and text editing | Implemented | Inspector; smoke test |
| Connection points, snap targets | Implemented | `shapeAnchorPoints`, `tests/routing.test.ts` |
| Lock/unlock, group/ungroup | Implemented | `tests/editor.test.ts` |
| Auto-size to text / fixed-size mode | N/A | Brief marks both optional |

## §8.3 Connectors

| Requirement | Status | Evidence |
| --- | --- | --- |
| Straight, elbow, curved, step, freeform | Implemented | `src/connectors/routing.ts`, `tests/routing.test.ts` |
| Dynamic reroute on move | Implemented | Smoke test asserts the path changes when a shape moves |
| Fixed-anchor and floating attachment | Implemented | `resolveEnd`; `tests/routing.test.ts` |
| One-way / two-way / no-arrow | Implemented | `startCap` / `endCap` |
| Dashed, dotted, thick, thin | Implemented | `dashArray`, stroke width control |
| All 11 endpoint styles | Implemented | `CAPS` set + `capSVG` |
| Snap to boundary / connection points | Implemented | Anchor hover targets |
| Manual handles, add/remove bend points | Implemented | Overlay bend + bend-insert handles |
| Labels, multiple per connector, repositioning, background fill | Implemented | `ConnectorLabel`; smoke test adds one |
| Delete connector without deleting shapes | Implemented | `Editor.deleteSelection` |
| Route around elements | Deferred | Brief §15 sequences basic routing first (Q10) |

## §8.4–8.5 Text and styling

| Requirement | Status | Evidence |
| --- | --- | --- |
| Text in shapes, on connectors, standalone boxes | Implemented | Smoke test |
| Font family/size/weight/style/colour/alignment/wrap/padding/line spacing | Implemented | Inspector; `src/core/text.ts` |
| Fill, border colour/width/style, corner radius, opacity | Implemented | Inspector |
| Copy/paste style | Implemented | `tests/editor.test.ts` |
| Bulleted/numbered lists, auto-fit text | Deferred | Brief §15 sequences plain text first (R2) |

## §8.6–8.8 Layout, object management, editing

| Requirement | Status | Evidence |
| --- | --- | --- |
| Snap-to-grid with configurable size | Implemented | `tests/snap.test.ts` |
| Snap-to-element with live guides | Implemented | `tests/snap.test.ts` |
| Equal-spacing guides | Deferred | Q9 |
| Align (6 ops), distribute (2 ops), match size | Implemented | `tests/editor.test.ts` |
| Group/ungroup, z-order, lock, hide | Implemented | `tests/editor.test.ts` |
| Undo/redo ≥ 100 actions | Implemented | 200-step stack; `tests/editor.test.ts` |
| Cut/copy/paste/duplicate/delete/select all | Implemented | Smoke test |
| Swimlane/phase containment | Deferred | Containers are ordinary shapes (Q12) |

## §8.9–8.10 Templates and files

| Requirement | Status | Evidence |
| --- | --- | --- |
| All required starter templates | Implemented | 11 templates; smoke test counts them |
| Versioned JSON project format | Implemented | `.flowshark`, schema v1 with forward migration |
| New / Open / Save / Save As | Implemented | Smoke test |
| Recent files | **Partial** | Works; entries outside Documents need re-authorization after a restart, which the app now detects and offers to fix through the open dialog (see README "Recent files") |
| Autosave | Implemented | `src/ui/autosave.ts`, with a user-visible warning when it fails |
| Recover unsaved work | Implemented | Recovery banner; the recovered document is now permanently marked unsaved |

## §8.11 Import and export

| Requirement | Status | Evidence |
| --- | --- | --- |
| PNG, SVG, PDF export | Implemented | Smoke test verifies a real `%PDF-` file |
| JPEG, WebP export | Implemented | `runExport` |
| Copy as image / SVG to clipboard | **Partial** | Implemented; depends on browser clipboard support (see README "Browser support") |
| Export whole canvas or selection | Implemented | Export dialog scope |
| Transparent background, grid toggle, scale, margins | Implemented | Export dialog |
| Export visible page only, page size | Deferred | Not in 0.1.0 |
| Markdown image reference export | N/A | Brief marks recommended |
| Import PNG/JPEG/WebP, paste from clipboard | Implemented | `openImageFile`, paste handler |
| Import native JSON | Implemented | `parseDoc` |
| Import SVG | Deferred | Removed pending a real XML sanitizer (Q18) |
| Visio / Mermaid / draw.io | N/A | Brief marks "future consideration" |

## §8.12 Keyboard shortcuts

All 19 required shortcuts are implemented in `src/ui/shortcuts.ts` and listed
in [INSTRUCTIONS.md](INSTRUCTIONS.md) §10. **Implemented.**

## §8.13 User interface

| Requirement | Status | Evidence |
| --- | --- | --- |
| Command bar, left shape panel, canvas, right inspector, status bar | Implemented | `index.html` layout |
| Shape search, flowchart/general/connector categories, recently used | Implemented | `src/ui/shapePanel.ts` |
| Contextual properties panel | Implemented | `src/ui/inspector.ts` |
| Toolbar tools and controls | Implemented | `src/ui/toolbar.ts` |
| Layers panel, minimap, favourites | N/A | Brief marks optional (Q6, Q7) |

## §8.14 Accessibility

| Requirement | Status | Evidence |
| --- | --- | --- |
| Keyboard navigability for major functions | Implemented | Full shortcut set; Tab/Shift+Tab now traverses diagram objects on the canvas |
| Visible focus states | Implemented | `:focus-visible` rings on controls **and** on the canvas |
| High contrast support | **Partial** | `forced-colors` block added; not tested on Windows high-contrast themes (Q17) |
| Screen reader labels for controls | Implemented | ARIA labels throughout; canvas selection announced via a live region |
| Scalable UI text | **Partial** | Layout is flexible, but no browser-zoom/OS-scaling test run (Q17) |
| Colour contrast compliance | **Unverified** | No contrast audit run (Q17) |
| Colour-blind-safe default palette | **Unverified** | Q17 |
| Diagram accessibility checker | Deferred | Q17 |
| Alt text for exported diagrams | Implemented | Exported SVG carries `role="img"`, `<title>` and a generated `<desc>` |

**No formal accessibility audit has been performed.** The items above
describe what the code does, not what a screen-reader or contrast audit
would conclude. Q17 remains a release blocker.

## §8.15 Performance

| Requirement | Status | Evidence |
| --- | --- | --- |
| 500 shapes and connectors on one canvas | **Partial** | Measured on x64 Chromium — 17-23 ms median / 24-75 ms p95 per drag frame. Not measured on ARM (Q16) |
| Smooth drag at common zoom levels | **Partial** | Same; drag renders are now coalesced to animation frames |
| Undo/redo stack ≥ 100 actions | Implemented | 200 steps |

## §12 Acceptance criteria

All 15 acceptance criteria are **implemented**. Coverage of them is uneven,
which is the substance of CODEX-REVIEW.md finding "Low 7":

| # | Criterion | Automated coverage |
| --- | --- | --- |
| 1 | Create a new document | Smoke test |
| 2 | Add standard shapes | Smoke test |
| 3 | Text inside a shape | Smoke test |
| 4 | Straight / elbow / curved connectors | `tests/routing.test.ts`; smoke test draws an elbow |
| 5 | Connector labels | Smoke test |
| 6 | Shape fill / border colour / thickness | Unit-covered via the parser and renderer; **no UI-level test** |
| 7 | Connector colour / thickness / style / arrowheads | `tests/render.test.ts`; **no UI-level test** |
| 8 | Move, resize, duplicate, delete, group, ungroup | `tests/editor.test.ts`; smoke test covers duplicate + group |
| 9 | Snap to grid and to elements | `tests/snap.test.ts`; **no UI-level test** |
| 10 | Align by edge or centre | `tests/editor.test.ts`; **no UI-level test** |
| 11 | Distribute evenly | `tests/editor.test.ts`; **no UI-level test** |
| 12 | Save and reopen a project file | Round-tripped in `tests/serialization.test.ts`; **the real file dialogs are not exercised** in any automated test, on desktop or in the browser |
| 13 | Export PNG, SVG, PDF | Smoke test (SVG + a byte-verified PDF); PNG only via `rasterize` unit coverage |
| 14 | Undo / redo | `tests/editor.test.ts`; smoke test |
| 15 | Diagram from a starter template | Smoke test |

The gaps worth closing next are #12 (no test ever opens or saves through a
real dialog) and the several inspector controls that are only covered
through the model layer beneath them.

## §13 Non-functional requirements

| Requirement | Status | Evidence |
| --- | --- | --- |
| Robust saves, no data loss | Implemented | Unsaved-changes guard on New/Open/template (and the guard now settles correctly when dismissed); canvas settings are part of the dirty state; download-fallback saves are labelled as downloads |
| Autosave and crash recovery | Implemented | `src/ui/autosave.ts`; recovered documents stay marked unsaved |
| Invalid files fail gracefully with useful messages | Implemented | `DocumentError` with human-readable text; `tests/limits.test.ts` |
| Versioned document schema | Implemented | `SCHEMA_VERSION` + `migrate()` |
| Modular rendering / model / UI / export | Implemented | `src/model`, `src/core`, `src/canvas`, `src/ui`, `src/io` |
| Tests for serialization, routing, undo/redo | Implemented | `tests/serialization.test.ts`, `tests/routing.test.ts`, `tests/editor.test.ts` |
| No telemetry | Implemented | No `fetch`/`XMLHttpRequest`/`WebSocket`/`sendBeacon` anywhere in `src/`; CSP `connect-src` allows only Tauri IPC |

## §17 Definition of done

| Criterion | Status |
| --- | --- |
| All MVP functional requirements implemented | **Partial** — see the Deferred rows above |
| Runs natively/smoothly on Windows ARM | **Partial** — builds and installs; smoothness unmeasured (Q16) |
| Core editing stable and undoable | Implemented |
| Save/reopen/export reliable | Implemented |
| Standard shapes and connectors available | Implemented |
| Styling controls work | Implemented |
| Snap/align/distribute predictable | Implemented |
| Basic templates included | Implemented |
| Performance acceptable on real ARM hardware | **Not done** — Q16 |
| Accessibility and keyboard usability reviewed | **Not done** — Q17 |
| Installer ready for distribution | **Not done** — unsigned, Q4 |

Three definition-of-done criteria are unmet. FlowShark 0.1.0 is therefore a
functional internal MVP, not a completed MVP release.

## §13 Security

| Requirement | Status | Evidence |
| --- | --- | --- |
| Sanitize imported SVG | Deferred | SVG import removed rather than shipped unsanitized (Q18) |
| No unsafe evaluation of file content | Implemented | `parseDoc` validates against an allowlist; no `eval`/`Function` anywhere |
| Local-only, no telemetry | Implemented | No network calls in the app; CSP restricts `connect-src` to Tauri IPC |
| Bounded resource use from untrusted files | Implemented | `src/model/limits.ts`, `tests/limits.test.ts` |
| Signed installers | Deferred | Needs a certificate decision (Q4) — release blocker |
