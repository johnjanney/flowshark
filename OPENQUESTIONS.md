# Open Questions

This file tracks open questions for the project and records how past
questions were resolved. Add new questions at the top of the *Open* section;
when a question is answered, move it to *Resolved* with the decision and
date.

## Open

| # | Question | Context | Raised |
| --- | --- | --- | --- |
| Q14 | Can the `rollup` → `@rollup/wasm-node` override in `package.json` be removed? | Added because `@rollup/rollup-win32-arm64-msvc` failed to load ("not a valid Win32 application") on a real Windows on ARM dev machine even after clean reinstalls with a correctly-sized file — consistent with endpoint security software (antivirus / Smart App Control) blocking or altering the native binary, not a corrupted download. The `windows-11-arm` CI runner has not shown this failure. Revisit if: (a) the affected machine's security team confirms/denies a block event for that file, or (b) rollup ships a newer win32-arm64-msvc build and someone can confirm the native binary loads cleanly there. Until then, the WASM override is the safer default for Windows ARM contributors generally, since it produces an identical build (verified via the full test suite + smoke test) at a small build-time cost. | 2026-07-08 |
| Q13 | Which license should the project use? | README currently says "no license chosen". MIT/Apache-2.0 are the usual candidates. | 2026-07-08 |
| Q12 | Should swimlane/phase containers *own* their children (move lane → move contents, auto-assign shapes dropped inside)? | Currently containers are ordinary big shapes (lock them to use as backdrops, as the swimlane template does). True containment affects the data model. | 2026-07-08 |
| Q11 | Interactive rotation handle? | Rotation is fully supported in the model, renderer, and inspector (degrees field), but there is no on-canvas rotate handle yet. | 2026-07-08 |
| Q10 | Route connectors *around* obstacles? | Brief §8.3 lists "route around elements where feasible". Current elbow router uses exit-direction heuristics but does not avoid intersecting third shapes. Deferred per brief §15 ("basic reliable implementation should come before advanced auto-routing"). | 2026-07-08 |
| Q9 | Equal-spacing snap guides and snap-to-connection-points while dragging shapes? | Edge/center snapping with guides is implemented; equal-spacing guides (brief §8.6, listed under snap-to-element) are not. | 2026-07-08 |
| Q8 | Group resize and apply-style-to-group? | Brief marks both "optional". Groups currently move/delete/duplicate as one; resizing applies to individual shapes only. | 2026-07-08 |
| Q7 | Layers panel (named layers, lock/hide per layer)? | Brief lists it as "recommended", not required. Z-order + per-element lock/hide cover the minimum. | 2026-07-08 |
| Q6 | Minimap / page overview? | Brief: "optional but recommended". Not implemented in 0.1.0. | 2026-07-08 |
| Q5 | Should the desktop app associate the `.flowshark` extension and support double-click-to-open? | Needs Tauri file-association config + single-instance handling; test on real Windows ARM hardware. | 2026-07-08 |
| Q4 | Signing the Windows installers | Unsigned NSIS installers trigger SmartScreen. Needs a code-signing certificate decision (standard vs EV, or Azure Trusted Signing). | 2026-07-08 |

## Resolved

| # | Question | Decision | Date |
| --- | --- | --- | --- |
| R6 | Where should the version-management instructions requested in the task live, given PROJECTBRIEF.md should stay a faithful copy of the brief? | Kept PROJECTBRIEF.md verbatim and appended a clearly marked "Appendix A: Version Management (added during implementation)"; the full instructions live in VERSIONING.md and are summarized in README.md. | 2026-07-08 |
| R5 | Native file extension | `.flowshark` (brand-consistent; brief suggested `.flowarm`/`.flowchart`/`.wfc` only as examples). JSON content, schema v1. | 2026-07-08 |
| R4 | Tech stack: WinUI 3 (A) vs Avalonia (B) vs Tauri/WebView2 (C)? | **Option C — Tauri 2 + TypeScript + SVG.** Rationale: WebView2 is native ARM64 on Windows on ARM; small footprint vs Electron; the SVG scene graph gives pixel-identical screen/SVG/PDF export (brief §15 "export fidelity"); the editor is fully testable headlessly in CI; x64 comes from the same codebase (secondary goal). Risk noted in brief (§9C performance/native feel) is mitigated by hardware-accelerated WebView2 rendering and must be validated on real ARM hardware before release (brief §15). | 2026-07-08 |
| R3 | Undo architecture: command objects vs snapshots? | Snapshot-per-action (deep clone of the JSON document, 200-step stack) behind a command-style `begin/commit/cancel` API. Simpler and safer than per-command inverse logic at this document scale; the API leaves room to swap in granular commands later if profiling demands it. | 2026-07-08 |
| R2 | Rich text (bullets, mixed runs) inside shapes in MVP? | Plain text + per-shape formatting only, per brief §15 ("start with plain text plus basic formatting, then expand"). Bullet/numbered lists (§8.4 "optional but recommended") deferred. | 2026-07-08 |
| R1 | How do resize handles and connection anchors coexist on a selected shape? | On a **selected** shape, side handles resize (they sit exactly on the side anchors). To draw a connector, hover any **unselected** shape and drag from its anchor dots, or use the Connector tool (C) and drag from anywhere on a shape. Documented in INSTRUCTIONS.md. | 2026-07-08 |
