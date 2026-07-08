# Codex Quality and Security Review

Review date: 2026-07-07  
Repository: `C:\Users\johnj\Repositories\flowshark`

## Executive Assessment

FlowShark is a credible MVP and it materially satisfies the brief's acceptance criteria for a single-user flowchart editor. The core editor, shape library, connectors, styling, templates, file format, export pipeline, keyboard shortcuts, and desktop shell are all present and working.

Quality is good for an MVP, but not yet release-ready. The biggest reasons are security hardening gaps around untrusted document/SVG input, a broader-than-necessary Tauri filesystem permission surface, and a few implementation/documentation drifts that should be cleaned up before treating this as a polished Windows ARM release.

## Verification Performed

- `npm test` passed: 56/56 tests.
- `npm run typecheck` passed.
- `npm run build` passed.
- `npm audit --omit=dev` reported 0 production npm vulnerabilities.
- `node scripts/smoke.mjs` failed as documented on this machine because the script hardcodes a Linux Chromium fallback at `scripts/smoke.mjs:14-16`.
- After `npx playwright install chromium` and setting `CHROMIUM_PATH`, `node scripts/smoke.mjs` passed end-to-end.
- `cargo` is not installed in this shell, so I could not run a Rust/Tauri dependency audit.

## 1. Does The App Achieve The Project Brief Objectives?

Mostly yes.

What is clearly achieved:

- The app meets the brief's core MVP acceptance criteria in practice: new/open/save/save-as, native `.flowshark` files, undo/redo, grouping, alignment/distribution, snap-to-grid, snap-to-element, templates, PNG/SVG/PDF export, keyboard shortcuts, shape text, connector labels, and multiple connector types all exist and work.
- The implementation is modular in the way the brief recommends: document model, editor state, rendering, routing, templates, export, UI, and platform file I/O are separated across `src/model`, `src/core`, `src/canvas`, `src/connectors`, `src/shapes`, `src/io`, `src/ui`, and `src/platform`.
- The app shell targets Windows ARM/x64 through Tauri and the CI workflow builds both installers.

What is only partially achieved:

- The broader brief asks for Windows ARM performance confidence and accessibility review. Those claims are not yet backed by real ARM performance evidence or a documented accessibility audit.
- A few brief items are deferred or incomplete rather than shipped:
  - General `line` and `arrow` shapes are not present in the model/registry (`src/model/types.ts:48-89`, `src/shapes/registry.ts:430-547`).
  - The left panel does not include a connector category; connectors are chosen from the toolbar instead (`src/ui/shapePanel.ts:121-125`, `src/ui/toolbar.ts:222-253`).
  - Obstacle-avoiding connector routing, equal-spacing snap guides, true swimlane/phase containment, and an on-canvas rotation handle are still open items (`OPENQUESTIONS.md:14-18`).

Bottom line: this is a successful MVP implementation, but not a fully closed-out execution of every brief detail.

## 2. How Well Does It Achieve The Objectives? (Quality)

Overall quality: good MVP, not hardened release candidate.

Strengths:

- The architecture is clean and maintainable. The codebase is small enough to reason about, and responsibilities are separated well.
- The editor behavior is broad for a v0.1.0 app: connectors reroute, labels work, selection/grouping/order operations are implemented, and exports are exercised in a real browser smoke test.
- The project documentation is unusually complete for an MVP: brief, changelog, instructions, versioning, and open questions are all maintained.
- Verification is decent: unit tests, typecheck, build, CI, and a smoke test all exist.

Quality concerns:

- The serialization test suite contains a no-op assertion at `tests/serialization.test.ts:24`. `expect(parsed.schemaVersion).toBeUndefined;` does not call a matcher, so this line validates nothing.
- The smoke test is less portable than the comments and README imply. As written it assumes `/opt/pw-browsers/chromium`, which breaks on this Windows environment until `CHROMIUM_PATH` is set (`scripts/smoke.mjs:14-16`).
- Dirty-state tracking is functionally coarse. `undo()` and `redo()` always mark the document dirty (`src/core/editor.ts:121-138`), so undoing back to the last saved state still leaves unsaved-change prompts/autosave active. That is a UX/file-management correctness issue, not just polish.
- Autosave is best-effort and silent on failure (`src/ui/autosave.ts:16-30`). Given that imported images are stored as data URLs in the document (`src/platform/fileio.ts:162-186`), larger diagrams can plausibly exceed localStorage quotas and disable recovery without warning. This is an inferred reliability risk from the code path.
- Performance against the brief's "hundreds of elements" target is still unproven. The current approach fully rebuilds SVG markup with `innerHTML` on refresh (`src/canvas/view.ts:155-157`) and uses full-document snapshots for undo (`src/core/editor.ts:74-119`). Both are reasonable MVP choices, but they need profiling on real Windows ARM hardware before release claims are strong.

## 3. Drift Issues That Should Be Resolved

1. The brief requires general `line` and `arrow` shapes, but the shipped shape model/registry does not include them. Connector tooling covers some of the use case, but it is not the same thing (`src/model/types.ts:48-89`, `src/shapes/registry.ts:430-547`).
2. The brief's left shape panel calls for a connector category, but the implementation puts connectors only in the toolbar (`src/ui/shapePanel.ts:121-125`, `src/ui/toolbar.ts:222-253`).
3. The product is described as optimized for Windows on ARM, but that claim is still largely architectural rather than empirically demonstrated. CI builds ARM64 installers, but there are no benchmarks or hardware validation artifacts in the repo.
4. Several known functional gaps are already tracked and should remain explicit release blockers if the goal is "complete MVP per brief": obstacle avoidance, equal-spacing snap guides, swimlane/phase ownership semantics, and interactive rotation (`OPENQUESTIONS.md:14-18`).
5. The smoke-test instructions drift from actual behavior on Windows. The repo says to run `node scripts/smoke.mjs`, but that fails here without first installing Chromium and setting `CHROMIUM_PATH` (`scripts/smoke.mjs:14-16`).

## 4. Security Assessment

No critical vulnerability was proven during this review, but there is one high-severity renderer hardening gap and two meaningful medium-severity issues.

### 1. High: Untrusted `.flowshark` files can inject unsanitized SVG/HTML attributes into the renderer and export path

Why this exists:

- The parser only type-checks many string fields and preserves them as-is:
  - generic strings via `str()` at `src/model/serialization.ts:65-66`
  - canvas background at `src/model/serialization.ts:137`
  - text color/font fields at `src/model/serialization.ts:145-153`
  - stroke color at `src/model/serialization.ts:160-163`
  - shape IDs, fill colors, group IDs, and imageSrc at `src/model/serialization.ts:167-191`
  - connector IDs and label background/border strings at `src/model/serialization.ts:212-245`
- Those fields are then interpolated directly into SVG attributes without escaping:
  - shape fill/stroke/id at `src/canvas/render.ts:41-57`, `src/canvas/render.ts:77-79`
  - connector stroke/label background/border/id at `src/canvas/render.ts:89-92`, `src/canvas/render.ts:137-160`
  - canvas background at `src/canvas/render.ts:235-238`
- The resulting SVG strings are inserted with `innerHTML` in both the live renderer and PDF export path:
  - `src/canvas/view.ts:155-157`
  - `src/canvas/view.ts:257`
  - `src/io/export.ts:63-65`

Impact:

- A malicious project file can break out of attribute context and inject additional SVG/HTML markup into the privileged Tauri renderer/export DOM.
- The CSP reduces some exploit paths, but this is still a high-severity desktop-app issue because the renderer has Tauri APIs available and the app intentionally loads untrusted local files.

Recommended fix:

- Strictly validate or normalize all persisted style/id-like fields before rendering.
- Do not trust IDs from imported documents; regenerate them or escape them.
- Restrict colors/backgrounds/borders to safe formats.
- Prefer DOM/SVG element creation APIs over large `innerHTML` string concatenation for untrusted document content.
- Add regression tests with attribute-breaking payloads.

### 2. Medium: Imported SVG images are accepted without sanitization

Why this exists:

- SVG is accepted as an import format in `src/platform/fileio.ts:177-186` and `src/platform/fileio.ts:191-195`.
- The document sanitizer only checks that `imageSrc` starts with `data:image/` (`src/model/serialization.ts:191`).

Impact:

- Potentially active or externally-referencing SVG content can be embedded into documents, copied to clipboard, or exported downstream without sanitization.
- The brief explicitly calls out sanitizing SVG imports where applicable; this is currently not done.

Recommended fix:

- Either disable SVG import for now or sanitize imported SVG aggressively before persistence/export.
- At minimum strip script, event attributes, `foreignObject`, and external references.

### 3. Medium: Tauri filesystem scope is broader than the app appears to need

Why this exists:

- The default capability grants read/write file permissions plus recursive scope across `$HOME`, `$DOCUMENT`, `$DOWNLOAD`, `$DESKTOP`, `$PICTURE`, and `$APPDATA` (`src-tauri/capabilities/default.json:6-24`).

Impact:

- Any renderer compromise has a much larger local-file blast radius than necessary for a diagram editor.
- This is especially relevant because the renderer currently parses and renders untrusted local project files.

Recommended fix:

- Narrow scopes to the minimum needed for dialog-selected documents, exports, and app recovery data.
- Avoid broad `$HOME/**` access unless a concrete feature requires it.

### 4. Low: Unsigned Windows installers remain a release-security issue

Why this exists:

- Installer signing is still open and SmartScreen warnings are expected (`OPENQUESTIONS.md:22`).

Impact:

- Users have weak provenance guarantees and will see trust warnings on install.

Recommended fix:

- Sign ARM64/x64 installers before public distribution and document the release verification path.

## Overall Conclusion

FlowShark achieves the brief well enough to count as a strong MVP. Functionally, it is much closer to "done" than most first versions. The blockers are not core editor breadth; they are hardening and polish.

If the goal is an internal MVP/demo, the project is in good shape now. If the goal is a release candidate for outside users, the following should be treated as required next steps:

1. Fix the untrusted document-to-SVG `innerHTML` injection path.
2. Sanitize or disable SVG import until it is safe.
3. Reduce Tauri filesystem scope.
4. Clean up the verification gaps: the no-op test assertion, the smoke-test portability issue, and dirty-state correctness.
5. Validate performance and accessibility on real Windows ARM hardware before keeping the current marketing claims.
