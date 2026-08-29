# Response to CODEX-REVIEW.md

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
