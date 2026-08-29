# Codex Quality, Security, and Requirements Review

Review date: 2026-08-29
Repository state: `work` branch, FlowShark 0.1.0

## Executive assessment

FlowShark is a credible, unusually broad MVP. The code implements the central
editor, the required shape library, five connector modes, text and styling,
snapping and layout commands, grouping and ordering, undo/redo, templates,
native JSON files, autosave/recovery, and PNG/SVG/PDF export. Its small,
dependency-light TypeScript architecture is understandable and the existing 67
unit tests, production build, and browser smoke suite provide a useful baseline.

It does **not**, however, satisfy every objective strongly enough to call the
brief complete or the product release-ready. The most important newly confirmed
problem is data integrity: canvas-setting edits bypass the command system, so
they are neither undoable nor marked dirty and can be lost without warning.
Untrusted project files also have no resource limits, allowing extreme values or
collection sizes to exhaust memory/CPU, especially during snapshotting or
export. Real Windows ARM performance and accessibility remain unverified.

No critical issue or currently exploitable script-injection path was found in
this pass. The previous review's injection, unsafe SVG import, broad filesystem
scope, dirty-state, autosave, dependency, and smoke-documentation findings have
been addressed. Overall rating: **good internal MVP; not a public release
candidate**.

## Verification performed

| Check | Result |
| --- | --- |
| `npm test` | Pass: 5 files, 67 tests |
| `npm run typecheck` | Pass |
| `npm run build` | Pass; production bundle generated |
| `node scripts/smoke.mjs` with Playwright's reported Chromium path | Environment-blocked: the pinned Chromium executable is not installed |
| `npm audit --omit=dev` | Environment-blocked: registry audit endpoint returned HTTP 403 |
| `cargo audit -f src-tauri/Cargo.lock` | Environment-blocked: `cargo-audit` is not installed |

The audit results recorded in `CODEX-REVIEW-RESPONSE.md` therefore remain useful
historical evidence, but the dependency risk could not be independently
reconfirmed in this environment.

## Findings, ordered by criticality

### High 1 — Canvas settings can be lost silently and cannot be undone

**Categories:** correctness, reliability, error handling, data integrity,
requirements compliance.

The canvas inspector directly mutates grid size, grid visibility, snapping,
snap tolerance, and background and then calls `editor.notify()`. The toolbar
toggle actions do the same. These paths do not call `Editor.apply()`, so no undo
snapshot is created and `dirty` remains false. A user can change the diagram
background or grid settings, close or open another file without an unsaved-work
warning, and lose the change. Autosave also skips it because autosave only runs
for dirty documents. This violates undo/redo and safe file-management
requirements.

where appropriate), refresh from that command, and add regression tests proving
the edit is dirty, undoable/redoable, autosave-eligible, and protected by the
discard confirmation.

### High 2 — Untrusted documents are not bounded against resource exhaustion

**Categories:** security, reliability, performance, data integrity, error
handling.

`parseDoc()` parses the whole file before validation and accepts unlimited
numbers of shapes, connectors, points, labels, groups, and arbitrarily long text
and font-family strings. Numeric values are checked for finiteness but not given
safe upper/lower coordinate, dimension, font-size, stroke-width, grid-size, or
z-index bounds. A locally opened project can therefore create enormous DOM/SVG
output, huge canvases during raster export, expensive routing, or repeated full
document clones in the 200-entry undo stack. This is a denial-of-service risk in
the desktop renderer and can produce browser canvas allocation failures.

The raster image data URL has an 8 MB cap, which is good, but it does not bound
the JSON document or decoded image dimensions.

**Recommended fix:** reject files over a documented byte limit before
`JSON.parse`; cap object/point/label counts and string lengths; clamp or reject
coordinates, dimensions, styling numbers, and export pixel area; decode image
metadata and impose pixel limits; return a clear `DocumentError`; and add
boundary/adversarial tests.

### Medium 3 — “Recent files” is unreliable outside Documents after restart

**Categories:** requirements compliance, correctness, compatibility,
reliability, documentation accuracy.

The static Tauri filesystem scope is intentionally restricted to
`$DOCUMENT/**`, while `openRecentFile()` directly reads the stored path without
showing a dialog. Dialog-granted scope is temporary, so a recent file elsewhere
on disk can fail after relaunch. Recent files are a required file-management
operation in the brief, but the README presents the feature without this
limitation; only the review response explains it.

**Recommended fix:** use Tauri persisted filesystem scopes/bookmarks if
available, request the user to reauthorize the path through the open dialog, or
remove inaccessible entries with an explanatory prompt. Document the behavior
until fixed and add a Windows integration test covering relaunch and a path
outside Documents.

### Medium 4 — The 500-element/Windows ARM performance target is unproven and at risk

**Categories:** performance, architecture, maintainability, project-brief drift.

Every content refresh rebuilds the complete SVG through `innerHTML`; selection
and geometry queries repeatedly scan arrays; routing and snapping scan document
objects; and each undo action stores a full structured clone for as many as 200
steps. These choices keep the MVP simple but imply roughly linear rendering per
refresh and potentially very high memory growth across edit history. There is no
500-object benchmark, frame-time measurement, startup measurement, spatial
index, or Windows ARM hardware result. The README now discloses this accurately,
so this is an implementation/verification gap rather than hidden marketing
drift.

**Recommended fix:** add reproducible 500- and 2,000-object fixtures and measure
startup, load/save, drag frame time, routing, memory, and export on ARM64. Profile
before redesigning; likely improvements include keyed incremental SVG updates,
command/delta-based history, cached indexes, spatial hit-testing, and throttled
rendering.

### Medium 5 — Accessibility is partial and has no validation

**Categories:** accessibility, requirements compliance, compatibility.

Toolbar and panel controls generally have labels and focus styling, but canvas
objects are rendered as SVG graphics without an accessible object tree or a
keyboard mechanism to traverse/select individual diagram elements. Essential
editing remains pointer-centric. There is no automated accessibility check,
screen-reader transcript, contrast report, high-contrast-mode test, touch/pen
test, or documented Windows keyboard-only acceptance run.

**Recommended fix:** define the intended accessible diagram interaction model;
expose shapes/connectors through a synchronized tree/list with names, roles, and
selection state; support keyboard traversal and manipulation; respect forced
colors and reduced motion; add axe-based checks; and validate with Narrator,
keyboard-only use, high contrast, touch, and scaling on Windows.

### Medium 6 — Public release provenance remains unresolved

**Categories:** security, dependency risk, reliability.

Windows installers are unsigned (tracked as Q4). Users cannot verify publisher
identity and should expect SmartScreen friction. CI actions and Rust/npm
dependencies are mostly version-tagged or semver-ranged rather than pinned to
immutable revisions, increasing supply-chain exposure. The audit job is useful,
but `cargo install cargo-audit` on every run is slow and itself fetches mutable
tooling.

**Recommended fix:** sign and timestamp both architectures, publish checksums and
release provenance/SBOMs, pin third-party GitHub Actions by commit SHA, use
Dependabot/Renovate, and install a pinned `cargo-audit` version or trusted cached
binary.


### Low 7 — Automated coverage is strong in core logic but thin at system boundaries

**Categories:** test coverage, error handling, compatibility, maintainability.

Unit tests cover editor, serialization, rendering, routing, and snapping, and the
smoke test exercises a useful happy path. Missing coverage includes canvas dirty
tracking, autosave quota/failure/recovery lifecycle, browser and Tauri save
cancellation/failure, recent-file permissions after restart, clipboard failure,
malformed-size limits, export allocation failures, keyboard-only workflows,
accessibility, and native Windows ARM/x64 runtime behavior. CI builds installers
but does not launch/test them.

**Recommended fix:** add focused unit tests for error branches, Playwright tests
for persistence and keyboard workflows, accessibility scans, and a small native
post-build launch/file-I/O smoke test on each Windows architecture.

### Low 8 — “Complete MVP” wording conflicts with acknowledged brief gaps

**Categories:** documentation accuracy, requirements compliance,
project-brief drift.

The README calls 0.1.0 a “complete, working MVP” while the same section lists
unmet release blockers and deferred brief features. SVG import is safely disabled
but remains a recommended import capability; obstacle avoidance and
equal-spacing guides are deferred; performance/accessibility acceptance is not
demonstrated. The release-readiness disclosure is good, but “complete” is still
easy to misread as complete compliance with the project brief.

**Recommended fix:** say “functional internal MVP implementing the core
acceptance workflow” and maintain a requirement traceability matrix with
Implemented / Partial / Deferred / Not applicable plus evidence for each brief
item.

### Low 9 — Validation permits ambiguous/corrupt relationship data

**Categories:** data integrity, correctness, maintainability.

Group IDs are not checked against the global element-ID set or against earlier
group IDs, member IDs are not deduplicated, labels need not be unique within a
connector, and connector anchor names are accepted as arbitrary strings. This is
not currently an injection vector because output is escaped, but malformed files
can create ambiguous groups and inconsistent selection/ungroup behavior.

**Recommended fix:** enforce globally unique IDs (including groups and labels),
deduplicate group membership, reject overlapping/inconsistent group ownership,
validate anchors against the shape's declared connection points, and report
repairs or rejection to the user rather than silently dropping data.

### Low 10 — Browser fallback behavior is less capable than desktop behavior

**Categories:** compatibility, reliability, documentation accuracy.

Where the File System Access API is unavailable, Save downloads a new file and
then reports success/marks the document saved; subsequent saves cannot overwrite
that download in place. Clipboard export also depends on browser clipboard
support and permissions. The code handles many failures at the action boundary,
but feature parity varies substantially by browser.

**Recommended fix:** document the supported browser matrix and degraded save/
clipboard behavior, detect capabilities in the UI, label fallback actions as
downloads, and run Playwright coverage in Chromium plus at least one additional
engine if browser compatibility remains a stated goal.

## Requirements and drift summary

| Area | Assessment |
| --- | --- |
| Purpose / core workflow | Achieved: users can create, edit, connect, style, arrange, save, reopen, and export diagrams. |
| Required shape library | Achieved, including line/arrow and container entries. |
| Connectors and labels | Largely achieved; obstacle avoidance is deferred and manual routing is intentionally basic. |
| Text and styling | Achieved for required controls; optional lists/auto-fit/format painter variants are not all present. |
| Layout/object management | Achieved for required alignment, distribution, grouping, order, locking, and snapping; equal-spacing guides are deferred. |
| File operations | Partial because recent-file authorization is unreliable outside Documents. |
| Export | Achieved for PNG/SVG/PDF; important resource limits are absent. |
| Templates/shortcuts | Achieved for the required template set and documented shortcut set. |
| Accessibility | Partial and unverified. |
| Performance | Architecturally plausible for small diagrams; minimum 500-element target unverified. |
| Security/privacy | Major prior injection and permission issues are fixed; local-only design has low privacy exposure, but resource-exhaustion and release provenance remain. No telemetry or cloud transfer was found. |
| Architecture/code quality | Good separation and readability; direct canvas mutations bypass the otherwise sound command boundary. |
| Documentation | Extensive and mostly accurate, with the completeness/recent-files qualifications noted above. |
| Dependency risk | Managed with lockfiles and CI audits, but current audits could not be rerun here and supply-chain pinning can improve. |

## Recommended remediation order

1. Fix canvas mutations to participate in commands, dirty state, undo, and autosave.
2. Add document/import/export resource limits and adversarial tests.
3. Make recent-file authorization durable or explicitly reauthorize it.
4. Establish the 500-object ARM64 benchmark and accessible interaction model.
5. Sign releases and harden dependency/action provenance.
6. Expand boundary, native-runtime, browser-compatibility, and accessibility tests.
7. Add a living requirements traceability matrix and qualify “complete MVP.”

## Final conclusion

The code achieves the product's purpose and most functional requirements with
good MVP-level design quality. It is appropriate for internal demonstrations and
continued engineering. It should not be represented as fully compliant or ready
for public distribution until silent canvas-setting data loss and unbounded
document resource consumption are fixed, and Windows ARM performance,
accessibility, installer signing, and native file workflows are validated.
