# Version Management

This document describes how versions are managed in FlowShark, per the best
practices called for in [PROJECTBRIEF.md](PROJECTBRIEF.md) (versioned document
schema, reliability, maintainability — §13, §8.10).

## 1. Application version (SemVer)

FlowShark follows [Semantic Versioning 2.0.0](https://semver.org):

- **MAJOR** — incompatible changes (e.g. dropping support for reading an old
  document schema, removing a feature).
- **MINOR** — new user-facing functionality, backwards compatible
  (new shapes, new export formats, new tools).
- **PATCH** — backwards-compatible bug fixes only.

While the product is pre-1.0 (`0.y.z`), minor versions may contain breaking
changes; the changelog must call them out explicitly.

### Where the version lives

The version string must be updated **in all three files in the same commit**:

| File | Field |
| --- | --- |
| `package.json` | `version` |
| `src-tauri/tauri.conf.json` | `version` |
| `src-tauri/Cargo.toml` | `[package] version` |

## 2. Document schema version

The `.flowshark` file format carries its own integer `schemaVersion`
(`SCHEMA_VERSION` in `src/model/serialization.ts`), independent of the app
version.

Rules:

1. **Bump the schema version** whenever the persisted document shape changes
   in a way an older parser would misread. Purely additive optional fields
   with safe defaults do **not** require a bump (the sanitizer fills
   defaults).
2. **Write a migration** in `migrate()` in `src/model/serialization.ts` for
   every bump, converting version *n* documents to *n + 1*. Migrations chain,
   so a v1 file still opens after five schema bumps.
3. **Never delete migrations** — old files must open forever.
4. **Newer-schema files are rejected** with a clear "please update FlowShark"
   error rather than being silently mangled.
5. **Add a round-trip test** in `tests/serialization.test.ts` for every
   migration (fixture file in the old format → parsed correctly).

## 3. Changelog discipline

`CHANGELOG.md` follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/):

- Every user-visible change lands under the `[Unreleased]` heading in the
  same pull request that makes the change.
- Entries are grouped as `Added` / `Changed` / `Deprecated` / `Removed` /
  `Fixed` / `Security`.
- On release, `[Unreleased]` is renamed to `[X.Y.Z] - YYYY-MM-DD` and a fresh
  empty `[Unreleased]` section is added.
- Schema version bumps are always mentioned explicitly in the changelog.

## 4. Release process

1. Ensure `main` is green (CI: typecheck, unit tests, smoke test).
2. Pick the new version per SemVer based on the `[Unreleased]` changelog
   entries.
3. Update the version in `package.json`, `src-tauri/tauri.conf.json`, and
   `src-tauri/Cargo.toml`; roll the changelog section.
4. Commit: `git commit -m "Release vX.Y.Z"`.
5. Tag: `git tag vX.Y.Z && git push origin main vX.Y.Z`.
6. CI builds Windows ARM64 and x64 installers and attaches them to a draft
   GitHub release; review the draft, paste the changelog section into the
   release notes, and publish.

## 5. Branching

- `main` is always releasable.
- Feature work happens on short-lived branches merged via pull request; CI
  must pass before merge.
- Hotfixes branch from the release tag, bump PATCH, and merge back to `main`.

## 6. Dependency versions

- `package-lock.json` and `src-tauri/Cargo.lock` are committed for
  reproducible builds.
- Dependency upgrades are ordinary changes: they go through PRs, CI, and the
  changelog (under `Changed`) when user-visible.
