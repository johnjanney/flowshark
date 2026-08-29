# Response to CODEX-REVIEW.md

This document records each round of independent review of FlowShark, the
verification of every finding against the actual code, and what was fixed.
The current round is first; the earlier rounds follow in the order they were
written.

- [Round 3 — the 2026-08-29 review](#round-3--response-to-the-2026-08-29-codex-review) (current)
- [Round 1 — the 2026-07-07 review](#round-1--response-to-the-2026-07-07-codex-review)
- [Round 2 — second pass over the 2026-07-07 review](#addendum-second-pass-over-codex-reviewmd)

---

# Round 3 — response to the 2026-08-29 Codex review

Response date: 2026-08-29
Reviewed by: Claude (Opus 5)

This round covers the rewritten [CODEX-REVIEW.md](CODEX-REVIEW.md) dated
2026-08-29 (High 1 – Low 10). Every finding was verified against the code
before being acted on, and an independent review of the repository was run
alongside it across the seventeen dimensions requested (requirements
compliance, correctness, code quality, architecture, performance, security,
reliability, error handling, data integrity, privacy, accessibility,
compatibility, test coverage, documentation accuracy, dependency risk,
maintainability, project-brief drift). That independent pass found eight
issues Codex did not report, two of which are more user-visible than
anything in Codex's list.

## Verdict on Codex's findings

| # | Finding | Verdict | Outcome |
| --- | --- | --- | --- |
| High 1 | Canvas settings bypass the command system | **Confirmed** | **Fixed** |
| High 2 | Untrusted documents unbounded against resource exhaustion | **Confirmed**, with three concrete amplifiers Codex did not name | **Fixed** |
| Medium 3 | Recent files unreliable outside Documents after restart | **Confirmed** | **Fixed** (detect + re-authorize); durable scope tracked as Q21 |
| Medium 4 | 500-element / ARM performance unproven | **Confirmed** as a verification gap | **Half-fixed**: benchmark added, x64 baseline measured, one real optimization; ARM run still open (Q16) |
| Medium 5 | Accessibility partial and unvalidated | **Confirmed**; found *worse* than described in one respect | **Substantially fixed**; audit still open (Q17) |
| Medium 6 | Release provenance unresolved | **Confirmed** | **Partially fixed**; SHA pinning blocked in this environment (Q20) |
| Low 7 | Coverage thin at system boundaries | **Confirmed** | **Partially fixed**: 32 new tests + 5 new smoke checks |
| Low 8 | "Complete MVP" wording conflicts with known gaps | **Confirmed** | **Fixed** (wording + REQUIREMENTS.md) |
| Low 9 | Validation permits ambiguous relationship data | **Confirmed**, and one part understated | **Fixed** |
| Low 10 | Browser fallback less capable than desktop | **Confirmed** | **Fixed** (honest labelling + documented matrix) |

Nothing in the review was a false positive. Two findings were more serious
than stated (High 2 and Low 9); one was less severe in practice than it
reads (Low 9's connector-anchor concern — the router already falls back
safely — though it was still worth closing).

## New findings from the independent review

| # | Finding | Severity | Outcome |
| --- | --- | --- | --- |
| N1 | Dismissing a confirmation dialog wedges the command that opened it | **High** | Fixed |
| N2 | Recovered unsaved work can be silently re-marked as saved | **High** | Fixed |
| N3 | CI attaches no installers to a tagged release, silently | Medium | Fixed |
| N4 | Grid generation is unbounded on export | Medium | Fixed |
| N5 | `wrapText` hard-break is O(n²) in text length | Medium | Fixed |
| N6 | A `localStorage` failure turns a successful save into "Save failed" | Low–Medium | Fixed |
| N7 | Recent-file entries are read back without validation | Low | Fixed |
| N8 | The canvas has no visible focus indicator | Low | Fixed |

## Priority order used

1. Silent data loss and wedged commands (High 1, N1, N2, N6) — these lose or
   block a user's work with no error.
2. Resource exhaustion from untrusted files (High 2, Low 9, N4, N5).
3. Reliability and release correctness (Medium 3, N3, N7).
4. Accessibility (Medium 5, N8) — required by brief §8.14, and cheap to move
   from "labels exist" to "usable without a mouse".
5. Measurement and evidence (Medium 4, Low 7, Low 8).
6. Provenance (Medium 6) — the part that could be done here was done; the
   rest is blocked and tracked.

---

## High 1 — Canvas settings could be lost silently and could not be undone

**Verified.** Confirmed at six call sites, not the two the review implies:
`src/ui/inspector.ts` mutated `doc.canvas.gridSize`, `.gridVisible`,
`.snapToGrid`, `.snapToElement`, `.snapTolerance` and `.background` directly
and then called `editor.notify()`; `Actions.toggleGrid`, `toggleSnapGrid` and
`toggleSnapElement` did the same. None called `Editor.apply()`.

The consequence chain is exactly as described, and worth spelling out because
it compounds: no `begin()`/`commit()` means no undo snapshot **and** no
`recomputeDirty()`, so `dirty` stayed false; `startAutosave`'s tick returns
early when `!editor.dirty`, so the change was never autosaved either; and
`Actions.confirmDiscard()` returns `true` immediately when `!dirty`, so
New/Open discarded the change with no prompt. A user could set a diagram
background, open another file, and lose it with no warning and no recovery
copy.

**Fixed** by adding `Editor.setCanvas(patch, label)` — a real command that
routes through `apply()`, so the edit is undoable, dirty-marking,
autosave-eligible and guarded by the discard confirmation. It ignores no-op
patches so toggling a value back and forth doesn't push empty undo steps.
All six call sites now use it, and the inspector clamps its numeric inputs
through the same helpers the file parser uses, so a typed value and a loaded
value are bounded identically.

**Regression coverage:** five unit tests in `tests/editor.test.ts` (dirty,
undo, redo, clean-on-undo-back-to-saved, no-op ignored) and two smoke checks
that toggle the grid in the real UI and assert the status bar shows "Unsaved
changes" and that Ctrl+Z reverts it.

## High 2 — Untrusted documents were not bounded against resource exhaustion

**Verified, and worse than described.** `parseDoc()` checked numbers with
`Number.isFinite` and applied a few one-sided floors (`Math.max(2, gridSize)`,
`Math.max(1, w)`) but had no upper bounds and no count limits anywhere. Three
specific amplifiers make this more than a memory-pressure concern:

1. **`gridSVG()` loops over `area.w / gridSize` segments.** `area` for an
   export comes from content bounds. A single shape at `x = 1e15` with
   "include grid" ticked produces a loop of ~10¹⁴ iterations — a hard hang,
   not a slow render. The review's phrasing ("enormous DOM/SVG output")
   understates this: it never gets as far as producing output.
2. **`wrapText()`'s hard-break path was O(n²) in text length** (it walked the
   cut point back one character at a time, re-measuring each step). With
   unbounded `text`, a single long unbroken run is a hang.
3. **`rasterize()` set `canvas.width/height` with no cap.** Over the browser's
   canvas limit, allocation fails *without throwing* — `toBlob` yields null
   and the user sees "Export failed" with no explanation, or a blank image.

**Fixed** with a new `src/model/limits.ts` holding every bound in one
documented place, wired into the parser, the renderer and the export path:

- Files over 32 MB are refused **before** `JSON.parse` with a `DocumentError`
  that says so (previously a huge file was parsed in full, then validated).
- Counts capped: shapes, connectors, groups, group members, bend points per
  connector, labels per connector.
- Values clamped: coordinates (±10⁷), dimensions, rotation (normalized into
  ±360°), font size, line height, stroke width, corner radius, text padding,
  label offset, z-index, grid size, snap tolerance.
- Strings truncated: shape/label text, document title, font-family.
- `gridSVG` widens its step until the line count fits the cap, so a hostile
  document degrades to a coarser grid instead of hanging.
- `rasterDimensions()` refuses exports above 80 MP or 20,000 px per side and
  throws `ExportSizeError` with a message naming the limit and suggesting a
  smaller selection or scale.
- `wrapText` binary-searches the break point instead of walking back.

The ceilings are far above any real diagram — 20,000 elements is well past
the point the editor is usable (see the benchmark: a 2,000-element drag frame
is already 77 ms). They exist to convert "the app hangs" into "the app opens a
repaired document, or refuses the file with a clear message".

**Regression coverage:** 12 adversarial tests in `tests/limits.test.ts`,
including a normal-document round-trip to prove the limits don't distort
ordinary files.

## Medium 3 — Recent files outside Documents

**Verified.** `src-tauri/capabilities/default.json` scopes `fs:scope` to
`$DOCUMENT/**`; `openRecentFile()` calls `readTextFile(path)` with no dialog,
so it depends on the session-only runtime grant an open dialog confers. After
a relaunch that grant is gone and the read is rejected. `Actions.openRecent`
caught the error but surfaced it as `Could not open file: ${err}` — a raw
Tauri permission string.

**Fixed** at the interaction level rather than by widening the scope (which
would hand the renderer standing access to more of the disk — a worse trade
for a convenience feature). On failure FlowShark now explains what happened
and offers to reopen the file through the dialog, which restores access; if
the user declines, the stale entry is removed. `openRecentFile` carries a
comment stating the constraint so the next reader doesn't rediscover it.
Documented in README ("Recent files") and INSTRUCTIONS §8.

**Not fixed:** durable scopes/bookmarks that survive a restart. That needs a
persisted-scope API from Tauri's fs plugin; tracked as **Q21**.

## Medium 4 — The 500-element performance target

**Verified as a verification gap**, and the architectural description is
accurate: `refreshContent()` rebuilds the whole SVG through `innerHTML`, and
each drag frame calls `restorePendingPreview()`, which `structuredClone`s the
entire document.

**Half-fixed.** Two things were possible here; ARM hardware was not.

*Measurement.* `scripts/bench.mjs` is new: it generates 100/500/2,000-element
fixtures and times parse, routing, SVG build, DOM commit, full refresh, undo
snapshot, drag frame and export — against the real source modules in a real
browser, via the Vite dev server, so it needs no production hooks and no
build step. The x64 baseline is recorded in README. The headline: at 500
elements a drag frame is **17–23 ms median, 24–75 ms p95** — the brief's §8.15
minimum is met with limited headroom, with occasional stutter expected. At
2,000 elements it is **77 ms** (≈13 fps), which is not acceptable. So the
brief's target holds and the next order of magnitude does not; that is now a
number rather than a guess.

*Optimization.* One real fix, chosen because it is the highest
value-per-risk: **drag rendering is coalesced to animation frames**. Pointer
devices deliver moves at 120–1000 Hz while the display refreshes at 60–120 Hz,
so the old code ran several full clone-and-rebuild cycles per displayed frame.
State is still computed from the latest pointer position, and `pointerUp`
flushes any queued frame before committing, so the undo entry still matches
where the pointer actually stopped. The resize path was extracted from the
pointer-move switch into `applyResizeDrag()` to make this possible, which also
removes a 60-line inline block from a 200-line switch.

**Not fixed:** the architectural work — keyed incremental SVG updates instead
of a full `innerHTML` rebuild, and delta-based undo instead of whole-document
clones. Both are real rewrites and the benchmark now exists to justify and
verify them. The ARM acceptance run remains **Q16**; the benchmark is the
thing to run there.

## Medium 5 — Accessibility

**Verified**, and one part was worse than the review says: `src/style.css`
contained `#canvas-svg:focus { outline: none; }`, which suppressed the focus
indicator on the app's main interactive surface entirely (**N8**). Combined
with the canvas being a single focus stop with `role="img"`, a keyboard-only
user could reach the toolbar and panels but had no way to reach, see, or act
on an individual diagram object.

**Substantially fixed:**

- **Keyboard traversal.** With the canvas focused, `Tab`/`Shift+Tab` step
  through every visible shape and connector in painting order — the same
  order a sighted user sees them stacked — selecting each, scrolling it into
  view if off-screen, and announcing it through a new polite ARIA live region
  ("Start / End, 'Start'. 1 of 10."). `Enter` edits the selected shape's text.
  Arrow keys, Delete and every existing command then apply to that selection.
- **Canvas semantics.** `role="application"` (it is an editing surface with
  its own key bindings, not a picture) with a label stating the traversal
  keys.
- **Visible focus.** `:focus-visible` ring on the canvas, so pointer clicks
  stay quiet but keyboard focus is visible.
- **Modal dialogs.** `aria-modal="true"`, Tab focus trapped inside the
  dialog, and focus restored to the invoking control on close.
- **Forced colors.** A `@media (forced-colors: active)` block ties borders and
  focus rings to system colors so controls stay distinguishable in Windows
  high-contrast themes.
- **Reduced motion.** `prefers-reduced-motion` honoured globally.
- **Exported diagrams** carry `role="img"`, a `<title>` and a generated
  `<desc>` summarizing the content and naming the first labelled shapes —
  the brief's §8.14 "alt text for exported diagrams, where applicable".

**Not fixed, and still a release blocker (Q17):** none of this has been
*audited*. Outstanding: a Narrator/NVDA pass, a colour-contrast check, a
colour-blind-safe palette review, a Windows high-contrast test, touch/pen
testing, an OS-text-scaling test, and an automated axe run in CI.

## Medium 6 — Release provenance

**Verified.** Installers are unsigned (Q4), and `.github/workflows/ci.yml`
referenced every third-party action by mutable tag.

**Partially fixed.** What could be done here was done:

- Workflow-level `permissions: contents: read`, so the default token is
  least-privilege and only the release job opts into `contents: write`.
- The release job's artifact glob was **broken** — see N3 below.

**Not fixed:** pinning actions to commit SHAs and `cargo-audit` to a version.
This is mechanical, but every SHA must be verified against the upstream
repository, and this environment cannot reach github.com or crates.io for any
repository outside this project — both were tested and both are blocked. An
unverified pin is an unresolvable ref and a hard CI failure, which is strictly
worse than the mutable tag it replaces, so it was **not guessed**. The
workflow carries a `TODO(supply-chain)` naming exactly what to do, and it is
tracked as **Q20** and listed as a release blocker in README. Signing remains
**Q4** (needs a certificate decision, not a code change).

## Low 7 — Test coverage at system boundaries

**Verified.** Fixed for everything this round touched: **32 new unit tests**
(67 → 99) plus **5 new end-to-end smoke checks** (17 → 22). New coverage:
document size/count/value limits, relationship-integrity repair, export size
refusal, grid bounding, text-wrap performance, exported-SVG accessibility,
canvas-setting dirty/undo/autosave semantics, recovered-document dirty state,
and keyboard traversal — plus smoke checks that exercise canvas settings,
dialog dismissal and keyboard traversal against the real UI.

**Still thin** and honestly recorded in [REQUIREMENTS.md](REQUIREMENTS.md)
§12: no automated test opens or saves through a real file dialog on either
platform, several inspector controls are covered only through the model layer
beneath them, there is no accessibility scan in CI, no non-Chromium browser
run, and CI builds the Windows installers without launching them.

## Low 8 — "Complete MVP" wording

**Verified.** README said "FlowShark 0.1.0 is a complete, working MVP" in the
same section that listed unmet release blockers.

**Fixed.** It now reads "functional internal MVP", states that three of the
brief's definition-of-done criteria are unmet, and links to a new
[REQUIREMENTS.md](REQUIREMENTS.md) — a requirement-by-requirement matrix
(Implemented / Partial / Deferred / N/A) covering every section of the brief
with the evidence for each status, exactly as the review recommended. Writing
it surfaced two small documentation drifts of its own: INSTRUCTIONS.md listed
the shape-panel categories without the Connector category added in the
previous round, and overstated smoke-test coverage of the acceptance
criteria. Both corrected.

## Low 9 — Ambiguous relationship data

**Verified**, and one part was understated: group ids were checked with
`isSafeId` but never against the element-id set, so a file could give a group
the *same id as a shape* — after which `expandToGroup()` and `ungroup()`
behave according to array order. The review lists this as "not checked
against the global element-ID set", which is right, but the practical effect
(two different objects answering to one id) is worse than "ambiguous groups".

The connector-anchor part is the least severe item in the review: `resolveEnd`
already falls back to `anchors[0]` for an unknown anchor name, so an invalid
anchor could not crash or misrender. It was still worth closing, because a
persisted phantom anchor silently changes meaning if a future shape gains an
anchor by that name.

**Fixed** in `validate()`: one global id namespace across shapes, connectors
*and* groups (first claimant wins, later duplicates dropped); group membership
deduplicated; an element can belong to only one group (first group to claim it
wins); each element's `groupId` rebuilt from the authoritative membership
lists rather than trusted from the file, so the two can never disagree;
duplicate connector-label ids dropped; anchors validated against the real
connection-point names.

The review also recommends "report repairs or rejection to the user rather
than silently dropping data". **Not done** — the parser's repair-quietly
behavior is unchanged for structural problems, and a repair report would need
a UI surface that doesn't exist. The one place it now speaks up is the size
limit, which rejects rather than repairs. Worth revisiting; not a correctness
gap.

## Low 10 — Browser fallback parity

**Verified.** Where the File System Access API is unavailable, `saveTextFile`
downloads a new file, returns `{ path: null }`, and `Actions.save` reported
"Saved <name>" and marked the document clean — implying the original file had
been updated when in fact a new download had been written.

**Fixed:** that path now says "Downloaded <name>". README gained a
**Browser support** matrix covering open, save-in-place, recent files,
clipboard copy and export by engine, with an explicit note that Firefox and
Safari behavior is derived from capability detection in the code rather than
from a test run (automated coverage is Chromium-only). INSTRUCTIONS §8 says
the same thing in user language.

**Not fixed:** running Playwright against a second engine. Worth doing if
browser support stays a stated goal.

---

# New findings from the independent review

## N1 (High) — Dismissing a confirmation dialog wedged the command

`confirmDialog()` wrapped `openDialog()` in a promise that resolved only from
the Cancel and Continue click handlers. But `openDialog()` also closes on
**Escape** and on a **backdrop click**, and neither path settled the promise.

So: make an edit, press Ctrl+N, press Escape. The dialog closes, the promise
never resolves, `Actions.newFile()`'s `await this.confirmDiscard()` never
returns, and New silently does nothing — no error, no toast, nothing to
indicate the command died. Same for Open and New-from-template. Every
dismissal leaked a pending promise for the life of the session.

This is the most user-visible defect found in this round and it is not in
Codex's review.

**Fixed:** `openDialog()` takes an `onDismiss` callback invoked for any close
the caller didn't initiate, and `confirmDialog()` resolves `false` there —
Escape and backdrop click now mean the same thing as Cancel. Covered by a
smoke check that dismisses the prompt with Escape and then verifies the
command can be issued again and re-prompts.

## N2 (High) — Recovered unsaved work could be silently re-marked as saved

The crash-recovery banner did:

```ts
editor.setDoc(recovery.doc, recovery.filePath);
editor.dirty = true;
```

`setDoc` resets `savedDepth = 0` with an empty undo stack, so the manual
`dirty = true` is inconsistent with the state that computes it. Make one edit
after restoring and undo it: `recomputeDirty()` sees `savedDepth (0) ===
undoStack.length (0)` and sets `dirty = false`. The recovered diagram — which
has *never been written anywhere* — is now considered saved. New/Open discard
it without a prompt, `beforeunload` doesn't warn, and autosave stops
refreshing the recovery copy.

This is the same class of bug as Codex's High 1 (state that isn't part of the
command system), reached from a different direction.

**Fixed:** added `Editor.markUnsaved()`, which sets `savedDepth = null` — the
existing sentinel for "the saved state is unreachable via undo/redo" —
and `recomputeDirty()` now treats `null` as unconditionally dirty. Two
regression tests.

## N3 (Medium) — CI attached no installers to a tagged release

`actions/upload-artifact@v4` roots an artifact at the **least common
ancestor** of its input paths. The build job uploads both
`…/release/bundle/nsis/*.exe` and `…/release/flowshark.exe`, so the LCA is
`…/release/` and the installers sit at `bundle/nsis/*.exe` *inside* the
artifact. The release job globbed `artifacts/FlowShark-windows-arm64/nsis/*.exe`
— one directory short. `softprops/action-gh-release` defaults
`fail_on_unmatched_files` to false, so tagging `v*` would have produced a
draft release with **no installers attached and no error**.

**Fixed:** corrected both globs to include `bundle/`, and set
`fail_on_unmatched_files: true` so this fails loudly if it regresses. This is
unverifiable from here (it needs a real tag push on Windows runners), so it is
called out rather than claimed as tested.

## N4 (Medium) — Unbounded grid generation

Detailed under High 2 above. On-screen the grid is bounded by the viewport and
the 0.1 zoom floor, so this only bites on export with "include grid" and
far-flung content — but there it is a hang, not a slowdown.

## N5 (Medium) — Quadratic text wrapping

Detailed under High 2 above.

## N6 (Low–Medium) — A storage failure turned a successful save into a failure

In `Actions.save()`, `addRecentFile()` ran inside the try block *after*
`markSaved()`. `localStorage.setItem` throws on quota exhaustion or when
storage is disabled (private windows, some enterprise policies). The file was
already written and the document already marked clean, but the catch reported
`Save failed: …` and returned `false` — telling the user their work wasn't
saved when it was, and returning false to any caller gating on it.

**Fixed:** `addRecentFile` is now best-effort and swallows storage errors
internally, with a comment saying why. The same treatment for
`removeRecentFile`.

## N7 (Low) — Recent-file entries were read back unvalidated

`getRecentFiles()` did `JSON.parse` and returned the array if it was one,
without checking entry shape. `localStorage` is shared with anything else on
the origin and survives downgrades; a malformed record rendered as a menu item
labelled `undefined` that passed `undefined` to `readTextFile` when clicked.

**Fixed:** entries are validated and normalized on read.

## N8 (Low) — No visible focus indicator on the canvas

Detailed under Medium 5 above.

---

# Verification

Every claim above was verified by running the code, not by reading it.

```
npm run typecheck        → clean
npm test                 → 99/99 passed (was 67; 32 new tests)
npx vite build           → clean production bundle
node scripts/smoke.mjs   → 22/22 checks passed, including a byte-valid PDF
                           export and the three new regression checks
npm audit --omit=dev     → 0 vulnerabilities
node scripts/bench.mjs   → baseline recorded in README
```

### What could not be verified here

Stated plainly, because Codex's review was right to flag unverifiable claims:

- **Windows-on-ARM anything.** No ARM hardware, no Windows, no WebView2. The
  benchmark and installer behavior on the target platform remain unmeasured
  (Q16).
- **`cargo audit`.** `cargo-audit` is not installed and crates.io is
  unreachable from this environment. The result recorded in Q19 stands as
  historical evidence; CI re-runs it on every push.
- **GitHub Actions SHAs.** github.com is unreachable for any repository
  outside this project, so the pins in Medium 6 were deliberately not guessed
  (Q20).
- **Non-Chromium browsers.** The browser matrix in README is derived from the
  capability detection in `src/platform/fileio.ts`, not from a test run.
- **The release workflow fix (N3).** Correct by the documented
  `upload-artifact` behavior, but only a real tag push proves it.
- **Any accessibility audit.** The improvements in Medium 5 are code changes,
  not audit results (Q17).

---

# Round 1 — response to the 2026-07-07 Codex review

Response date: 2026-07-08
Reviewed by: Claude (Sonnet 5), same agent that implemented FlowShark

This document verifies each finding in [CODEX-REVIEW.md](CODEX-REVIEW.md)
against the actual codebase, states a verdict, and records what was fixed.
Every fix below was verified by rebuilding, re-running the full test suite
(67 tests, up from 56), the production build, and the Playwright smoke test
— not just read and assumed correct.

## Summary

Codex's review was thorough and accurate. All four security findings were
confirmed as real; the High-severity one was, if anything, **more serious
than described** once traced through to the Tauri filesystem capabilities
it interacts with (see below). All identified drift and quality issues
were confirmed. Nothing in the review was found to be a false positive.

| Finding | Verdict | Outcome |
| --- | --- | --- |
| High: SVG attribute injection | **Confirmed, more severe than stated** | Fixed |
| Medium: unsanitized SVG import | **Confirmed** | Fixed (import disabled, not just filtered) |
| Medium: broad Tauri fs scope | **Confirmed** | Fixed (narrowed to `$DOCUMENT/**`) |
| Low: unsigned installers | **Confirmed, already tracked** | No change (tracked in OPENQUESTIONS.md Q4) |
| Dead test assertion | **Confirmed** | Fixed |
| Smoke test Chromium path portability | **Confirmed** | Fixed |
| Undo/redo dirty-flag correctness | **Confirmed** | Fixed |
| Autosave silent failure | **Confirmed as a real gap** | Fixed (one-time user warning) |
| Missing Line/Arrow shapes | **Confirmed** | Fixed |
| Missing Connector category in panel | **Confirmed** | Fixed |
| Performance/accessibility unproven on real hardware | **Confirmed** | Acknowledged, logged as open questions (can't validate from this sandbox — see below) |

## 1. Does the app achieve the brief objectives?

Agreed with Codex's assessment. The two brief-drift items it identified
were real and are now fixed:

- **Line and Arrow general shapes** (brief §8.2) were missing from
  `src/model/types.ts`'s `ShapeType` union and `src/shapes/registry.ts`.
  Added both, including a proper diagonal-line renderer for Line and a
  path-with-filled-arrowhead renderer for Arrow, visually verified via a
  screenshot before committing (not just typechecked).
- **Connector category in the left shape panel** (brief §8.13 explicitly
  lists it as a required section) was missing — connectors were only
  selectable from the toolbar dropdown. Added a "Connectors" category to
  `src/ui/shapePanel.ts` with icons for all five connector types
  (straight/elbow/step/curved/freeform); clicking one arms the connector
  tool, exactly like the toolbar dropdown, and the toolbar's label stays in
  sync. Verified end-to-end with a scripted Chromium session: click a
  connector type in the panel → tool arms correctly → draw a connector on
  canvas → connector appears with the right type.

The remaining items Codex listed (obstacle-avoiding routing, equal-spacing
snap guides, true swimlane/phase containment, on-canvas rotation handle)
were already tracked in `OPENQUESTIONS.md` before this review and remain
appropriately deferred — the brief itself says basic reliable routing
should come before advanced auto-routing (§15), and the other three are
marked "optional"/"recommended" rather than required.

## 2. Quality

Agreed with all five quality concerns raised. Fixed four; the fifth
(performance profiling) can't be done from this environment — see the note
at the end of this document.

- **Dead test assertion** (`tests/serialization.test.ts:24`) — confirmed:
  `expect(parsed.schemaVersion).toBeUndefined;` was missing its call
  parentheses, so it was a no-op property access, not an assertion. Fixed
  to `expect(parsed.schemaVersion).toBe(SCHEMA_VERSION);`, which actually
  exercises what the comment claimed to test.
- **Smoke test portability** — confirmed: `scripts/smoke.mjs` hardcoded
  `/opt/pw-browsers/chromium` as its default, which is specific to the
  sandboxed environment this project was originally built in and doesn't
  exist on a normal dev machine. Fixed to default to Playwright's own
  browser resolution (works after `npx playwright install chromium`,
  which is the standard setup step) and only override the executable path
  when `CHROMIUM_PATH` is explicitly set. Verified both the default path
  and the explicit-override path still work.
- **Dirty-state correctness** — confirmed and was a real bug, not just
  polish: `undo()`/`redo()` set `dirty = true` unconditionally, so undoing
  back to exactly the last-saved state still showed "unsaved changes" and
  kept autosaving needlessly. Fixed by tracking the undo-stack depth at
  the moment of save and comparing against it, correctly handling the
  tricky case where a new edit branches off after undoing past the save
  point (making the old save point permanently unreachable, so dirty
  correctly stays `true` even after further undo/redo on the new branch).
  Three new tests in `tests/editor.test.ts` cover exactly this branching
  case, not just the simple round-trip.
- **Autosave silent failure** — confirmed as a real reliability gap, not
  just theoretical: the failure path was a bare `catch {}` with no
  recovery path and no user-facing signal, and large diagrams with
  embedded raster images (data URLs) can plausibly approach typical
  browser localStorage quotas (5–10MB). Fixed to warn the user once per
  session via a toast if autosave fails, so they know to save manually
  rather than assuming crash recovery has their back.
- **Performance at "hundreds of elements" scale** — confirmed as unproven,
  not confirmed as broken. The `innerHTML` full-rebuild-on-refresh and
  full-document-snapshot undo approach are real, deliberate MVP tradeoffs
  (the snapshot-undo choice was already recorded as a considered decision
  in `OPENQUESTIONS.md` R3), not oversights. I did not change the
  rendering architecture — that's a substantial rewrite (see Q18 below),
  not a bug fix, and doing it without profiling data from real hardware
  risks optimizing the wrong thing. Logged as **Q16** in
  `OPENQUESTIONS.md`: now that a real Windows on ARM build succeeds (this
  session also fixed the build toolchain issues that were blocking it),
  this can finally be profiled directly, which this sandboxed environment
  cannot do.

## 3. Drift

Covered under sections 1 and 2 above. One clarification: Codex's drift
item #3 ("Windows ARM optimization claim is architectural, not
empirically demonstrated") and its call for "benchmarks or hardware
validation artifacts" is accurate and is now **Q16** in
`OPENQUESTIONS.md`, alongside a new **Q17** for the accessibility audit
gap Codex noted in section 2 of its review but didn't list as a numbered
drift item. Both require hands-on testing on real hardware/assistive
tech that this sandboxed session cannot perform.

## 4. Security — detailed findings

### Finding 1 (High → confirmed, and more severe than described)

**Codex's claim:** untrusted `.flowshark` files can inject unsanitized
SVG/HTML attributes into the renderer and export path via unescaped string
interpolation into SVG attributes, rendered via `innerHTML`.

**Verification:** confirmed by direct inspection of every cited file and
line. Traced the actual exploit path further than the review did:

1. `src/model/serialization.ts`'s `str()` helper only checked
   `typeof v === "string"` — no character or format validation — for
   colors, ids, and other fields that end up in SVG attributes.
2. Those values were interpolated directly into double-quoted SVG
   attribute strings without escaping in `src/canvas/render.ts` (shape
   fill/stroke/id, connector stroke/id, label background/border/id),
   `src/connectors/routing.ts`'s `capSVG()` (connector endpoint caps — 8
   separate interpolation points), and `src/core/text.ts`'s `textSVG()`
   (text fill color, used by every shape's label and every connector
   label).
3. The resulting strings are inserted via `contentLayer.innerHTML = ...`
   in `src/canvas/view.ts`, which runs on **every document load and every
   edit** — not just on export.
4. **Not fully captured in the original review:** `src-tauri/tauri.conf.json`
   doesn't set `withGlobalTauri`, but Tauri 2's IPC bridge
   (`window.__TAURI_INTERNALS__`) is present in the webview regardless —
   it's what the app's own `@tauri-apps/api` imports call internally, and
   it's reachable by *any* JavaScript running on the page, injected or
   not. Combined with the filesystem capability scope that existed before
   this review (`$HOME/**` and five other broad paths — see Finding 3),
   a successful attribute-breakout injection had a plausible path to
   arbitrary local file read/write within that scope, not just a
   cosmetic rendering glitch. This makes the finding's severity rating
   directionally correct or arguably conservative, not overstated.

**Proof of concept:** a `.flowshark` file with
`"fill": {"color": "red\" onmouseover=\"alert(document.cookie)"}` on a
shape, opened normally via File → Open, would render a shape that executes
arbitrary JavaScript in the app's webview on mouseover — no further user
action needed beyond opening the file.

**Fix:**

- Escaped every remaining unescaped interpolation at the point of SVG
  generation (`src/canvas/render.ts`, `src/connectors/routing.ts`,
  `src/core/text.ts`), reusing the existing `escapeXML()` helper.
- As defense in depth, added `src/core/safety.ts` with `safeColor()` (a
  strict allowlist for hex/rgb/hsl/named-color syntax, anything else falls
  back to a safe default) and `isSafeId()` (alphanumeric/underscore/hyphen
  only), applied at the document-parse boundary in
  `src/model/serialization.ts` — shapes/connectors/groups/labels with an
  unsafe id are dropped entirely (matching this file's existing
  drop-what's-invalid pattern for other malformed fields), and colors that
  don't match the allowlist fall back to a safe default instead of being
  preserved.
- Both layers matter independently: escaping closes the vulnerability
  unconditionally regardless of upstream validation; parse-boundary
  validation prevents nonsense/oversized values from ever reaching the
  live document model in the first place.

**Verification of the fix:** added regression tests in
`tests/render.test.ts` (proving the renderer neutralizes attribute-breakout
payloads even if something upstream fails to validate them — i.e. this
survives even if `serialization.ts` is bypassed) and
`tests/serialization.test.ts` (proving malicious documents are sanitized
on open, not just at render time). All 67 tests pass; the full smoke test
still passes unchanged.

### Finding 2 (Medium → confirmed)

**Codex's claim:** imported SVG images are accepted without sanitization.

**Verification:** confirmed, and the actual attack surface was larger than
the review's specific citations: `src/platform/fileio.ts`'s
`openImageFile()` offered `.svg` in both the Tauri dialog filter and the
browser `<input accept>` list, converting it to a `data:image/svg+xml`
data URL. The document sanitizer only checked the `data:image/` prefix,
which SVG data URLs satisfy. **Additionally found, not explicitly called
out in the review:** `src/ui/actions.ts`'s `importImage()` and the
clipboard-paste handler in `src/main.ts` both construct the image shape
directly and push it into the live document, **completely bypassing**
`parseDoc()`/the sanitizer — so even before this fix, a pasted SVG (e.g.
copied from a browser as an image) would render live in the current
session immediately, regardless of what the file-open sanitizer did.

**Fix:** took the review's first suggested option — disabled SVG import —
rather than attempting to hand-roll SVG sanitization. Properly sanitizing
arbitrary attacker-controlled XML/SVG correctly (stripping scripts, event
handlers, `foreignObject`, external references) needs a real DOM-based
sanitizer; regex-based sanitization of XML is a known-unreliable approach
with a long history of bypasses, and this project doesn't currently bundle
a proper one. Specifically:

- Removed `svg` from both the Tauri dialog filter and the browser file
  input's `accept` list in `src/platform/fileio.ts`.
- Added `isSafeImageDataUrl()` to `src/core/safety.ts` (raster mime types
  only: png/jpeg/gif/webp/bmp, base64-encoded, size-capped) and applied it
  at **all three** entry points: the document parser
  (`src/model/serialization.ts`), the import dialog handler
  (`src/ui/actions.ts`), and the clipboard-paste handler
  (`src/main.ts`) — closing the bypass the review didn't explicitly flag,
  not just the one it cited.
- Both live-entry rejections show a toast so the failure isn't silent.
- Logged as **Q18** in `OPENQUESTIONS.md`: SVG import can be reinstated
  once the project adds a real sanitizer (e.g. DOMPurify configured for
  SVG, which would need a DOM available — non-trivial in this app's
  Node-based test environment — or sanitization moved into the Rust side).

### Finding 3 (Medium → confirmed)

**Codex's claim:** the Tauri filesystem capability scope
(`$HOME/**`, `$DOCUMENT/**`, `$DOWNLOAD/**`, `$DESKTOP/**`, `$PICTURE/**`,
`$APPDATA/**`) is broader than the app needs.

**Verification:** confirmed by tracing every filesystem call in
`src/platform/fileio.ts`. All of them go through
`@tauri-apps/plugin-dialog`'s `open()`/`save()` first, **except** one:
`openRecentFile()`, which calls `readTextFile(path)` directly on a path
stored from a previous session, with no fresh dialog interaction. Tauri 2
extends filesystem scope automatically for a path the user just picked via
the dialog plugin, regardless of the static capability scope — so open,
save, export, and import all work anywhere on disk without needing broad
static scope. The recent-files feature is the one genuine exception, since
it reads a stored path without a fresh dialog pick.

**Fix:** narrowed `src-tauri/capabilities/default.json`'s `fs:scope` from
six broad paths (effectively "most of the user's files") to just
`$DOCUMENT/**`, and removed the redundant `fs:default` permission (grep
confirmed the app only ever calls `readTextFile`/`writeTextFile`/
`readFile`/`writeFile`, all four of which are still explicitly granted).

**Disclosed tradeoff:** reopening a "recent file" that was last saved
outside the Documents folder on a new app launch will now fail (with a
toast showing the error, not a silent failure or crash — `Actions.
openRecent()` already had a try/catch) until the user re-saves it under
Documents, or reopens it via File → Open (which still works anywhere,
since that goes through the dialog).

**Verification limitation, disclosed:** this Linux sandbox cannot compile
Tauri's Windows target, and attempting a Linux-target `cargo check` here
failed on a missing system library (`gdk-3.0`) unrelated to this change —
a pre-existing environment limitation, not something introduced by this
fix. The edited JSON is well-formed and follows the same schema shape as
the file it replaces. **This specific change should be verified by
actually running save/open/export/import and recent-files on real Windows
ARM hardware** before being considered fully confirmed — I could not do
that verification myself.

### Finding 4 (Low → confirmed, already tracked)

**Codex's claim:** unsigned Windows installers remain a release-security
issue.

**Verification:** confirmed and accurate. This was already tracked as
**Q4** in `OPENQUESTIONS.md` before this review (raised during initial
implementation) and requires a business decision (which certificate type,
whether to use Azure Trusted Signing) that's out of scope for a code fix.
No change made; existing tracking is sufficient.

## What wasn't fixed, and why

- **Performance profiling on real hardware** (brief §8.15) — requires
  actually running the app on Windows ARM hardware with hundreds of
  shapes and measuring frame times; this sandboxed environment has no
  such hardware. Logged as Q16.
- **Accessibility audit** (brief §8.14) — requires a screen reader and
  manual/automated contrast checking against a running app; same
  limitation. Logged as Q17.
- **Rewriting the renderer off `innerHTML`** — the actual vulnerability is
  fixed (escaping + validation); a full rewrite to safe DOM-API element
  construction would remove the *class* of risk structurally rather than
  just this instance of it, but is a substantial rendering-engine change
  disproportionate to what's needed to close the reported bug. Logged as
  Q18 for future consideration.
- **Windows ARM fs-scope narrowing, live verification** — see the
  disclosed limitation under Finding 3 above.

## Verification summary

```
npm run typecheck   → clean
npm test             → 67/67 passed (was 56; 11 new regression tests)
npm run build        → clean production build
node scripts/smoke.mjs → 16/16 steps passed, including a byte-valid PDF export
```

Also manually verified via scripted Chromium sessions (not just asserted):
the Line and Arrow shapes render correctly (screenshot inspected), and the
new Connectors panel category correctly arms the connector tool and
produces a working connector end-to-end.

---

# Addendum: second pass over CODEX-REVIEW.md

Addendum date: 2026-08-29

A follow-up pass re-read [CODEX-REVIEW.md](CODEX-REVIEW.md) line by line
against the response above, looking specifically for findings the first
response did not act on. Four were found. All four are now closed; the
current state was re-verified end to end (67/67 unit tests, typecheck,
production build, 16/16 smoke-test steps including a byte-valid PDF).

| Previously unaddressed | Severity | Outcome |
| --- | --- | --- |
| Rust/Tauri dependency audit never performed | Medium (unknown risk) | Run: 0 vulnerabilities; both audits added to CI |
| Smoke-test *documentation* drift (review §3.5) | Low | README now documents the one-time Playwright step |
| ARM performance / accessibility claims kept without evidence (review §3.3 + conclusion 5) | Low | Claims qualified; release blockers listed explicitly |
| Functional gaps not marked as release blockers (review §3.4) | Low | New "Release readiness" section in README |

Two further issues surfaced while verifying, and were fixed in the same
pass:

| Found while verifying | Severity | Outcome |
| --- | --- | --- |
| `dompurify` 3.4.11 (shipped in `dist/` via jsPDF) has two XSS advisories | Moderate | Bumped to 3.4.14 |
| Selection-overlay `innerHTML` path still interpolated ids unescaped | Defense in depth | Escaped |

## 1. Rust/Tauri dependency audit (review, "Verification Performed")

**What the review said:** "`cargo` is not installed in this shell, so I
could not run a Rust/Tauri dependency audit." The first response did not
mention this at all, so the Rust side of the dependency tree — the half
that runs *outside* the webview sandbox, with full OS privileges — had
never been audited by anyone.

**Now done.** `cargo audit` against `src-tauri/Cargo.lock` (432 crate
dependencies, advisory DB of 1,226 advisories):

- **0 vulnerabilities.**
- 17 warnings, none with a fix available at this project's level:
  - 11 unmaintained/unsound warnings for the GTK3 stack (`gtk`, `gdk*`,
    `atk*`, `glib`, `proc-macro-error`). `cargo tree -i <crate> --target
    aarch64-pc-windows-msvc` returns "nothing to print" for every one of
    them — they are Linux-only and are not compiled into the Windows
    ARM64/x64 builds at all. They are in `Cargo.lock` only because a
    lockfile covers every platform.
  - 6 unmaintained `unic-*` crates, which *do* apply to Windows, reaching
    the build through `tauri-utils` → `urlpattern`. "Unmaintained" is not
    a vulnerability and there is no upgrade to take; tracked as **Q19**.

**Kept closed:** a `Dependency audit (npm + cargo)` job now runs
`npm audit --omit=dev --audit-level=moderate` and `cargo audit` on every
push and PR (`.github/workflows/ci.yml`), and both commands are documented
in README. A one-time audit answers the question once; the CI job is what
keeps the answer true — which matters, because running it immediately
surfaced the npm drift below.

## 2. The npm audit result had drifted since the review

The review recorded "`npm audit --omit=dev` reported 0 production npm
vulnerabilities". That is no longer true: `dompurify` 3.4.11 carries two
moderate DOMPurify XSS advisories
([GHSA-c2j3-45gr-mqc4](https://github.com/advisories/GHSA-c2j3-45gr-mqc4),
[GHSA-55q2-fjhq-7xh7](https://github.com/advisories/GHSA-55q2-fjhq-7xh7)).

It arrives as an *optional* dependency of jsPDF, which is easy to wave off
as "not really shipped" — but it is: a production `vite build` emits
`dist/assets/purify.es-*.js`, a lazily-loaded chunk of the app bundle.
Bumped to 3.4.14 (lockfile only, no source change). `npm audit --omit=dev`
is clean again and PDF export was re-verified by the smoke test.

## 3. Smoke-test documentation drift (review §3.5)

The first response fixed `scripts/smoke.mjs` itself (dropping the
hardcoded `/opt/pw-browsers/chromium` default) but not the instructions
the review actually cited. README still listed a bare
`node scripts/smoke.mjs`, which on a fresh clone fails with Playwright's
"Executable doesn't exist … run `npx playwright install`" error — the same
end-user symptom the review reported, from a different cause.

README's dev section now lists `npx playwright install chromium` as the
one-time step and explains that `CHROMIUM_PATH` is only for pointing at a
specific binary. (Reproduced here: with no `CHROMIUM_PATH`, this
environment's smoke test fails exactly that way, because its pre-installed
Chromium build doesn't match what the pinned Playwright expects; with
`CHROMIUM_PATH` set, all 16 steps pass.)

## 4. Unevidenced ARM/accessibility claims (review §3.3 and conclusion 5)

The review's closing recommendation was to "validate performance and
accessibility on real Windows ARM hardware **before keeping the current
marketing claims**." The first response logged the validation gaps as Q16
and Q17 but left the claims themselves untouched — README still opened
with "optimized for Windows 11 on ARM" and listed "accessible labeled
controls" as a shipped feature. Logging a gap in an internal tracking file
does not qualify a claim made on the front page.

README now states the ARM targeting as what it actually is (a native-ARM64
WebView2 shell with no emulation layer and CI-built ARM64 installers) and
says plainly that frame-time and large-document performance are unmeasured
on real hardware; the accessibility bullet now says ARIA-labeled controls
and focus-visible styles, not validated by an audit.

## 5. Functional gaps not marked as release blockers (review §3.4)

The review asked that the known gaps "remain explicit release blockers if
the goal is 'complete MVP per brief'". They were listed in
OPENQUESTIONS.md, but nothing distinguished a release blocker from a
deferred nice-to-have. README now has a **Release readiness** section that
names the three blockers (unsigned installers Q4, unmeasured ARM
performance Q16, no accessibility audit Q17) and separately lists what is
knowingly deferred (Q9–Q12, Q18).

## 6. One remaining unescaped `innerHTML` path (defense in depth)

While re-verifying Finding 1, one `innerHTML` path was found that the
first pass missed: `CanvasView.refreshOverlay()`
(`src/canvas/view.ts`) builds the selection/handle/anchor overlay by
string concatenation and interpolated `s.id` / `c.id` into `data-*`
attributes without escaping.

This was **not exploitable**: ids are constrained to `[A-Za-z0-9_-]` by
`isSafeId()` at the parse boundary, and every document entry point
(File → Open, recent files, autosave recovery) goes through `parseDoc()`.
But it contradicted the two-layer principle stated in Finding 1 above —
"escaping closes the vulnerability unconditionally regardless of upstream
validation" — by being the one output site still relying on the upstream
layer. Now escaped, so no `innerHTML` sink in the app trusts its input.

The remaining `innerHTML` uses were re-reviewed and are safe: they build
markup from compile-time constants (`toolbar.ts`, `shapePanel.ts`,
`inspector.ts`, `dialogs.ts`), from app-generated SVG that is already
escaped (`export.ts`, the template thumbnails), or from a locally
generated timestamp (`main.ts`'s recovery banner, via
`Date.toLocaleString()`).

## Verification

```
npm audit --omit=dev   → 0 vulnerabilities
cargo audit            → 0 vulnerabilities (17 unmaintained/unsound warnings, see Q19)
npm run typecheck      → clean
npm test               → 67/67 passed
npm run build          → clean production build
node scripts/smoke.mjs → 16/16 steps passed, byte-valid PDF export
```

Unchanged from the first response: the Tauri filesystem-scope narrowing
still needs to be exercised on real Windows ARM hardware (save / open /
export / import / recent files), and Q16/Q17 still need hardware and
assistive tech this environment does not have.
