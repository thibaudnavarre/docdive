# COR Plan — Release 0.3.0

## Context

Cut docdive 0.3.0: ship the six `Unreleased` CHANGELOG entries through the existing tag-triggered `release.yml` (npm + PyPI trusted publishing), smoke-test the published artifacts from throwaway projects, and create the GitHub Releases (0.3.0, plus the missing 0.2.0).

### Current state

- All four packages are at `0.2.0`: `packages/{docdive-element,docdive,docusaurus-theme-docdive}/package.json`, `packages/mkdocs-docdive/src/mkdocs_docdive/__init__.py`. Dependency ranges: `packages/docdive/package.json` → `"docdive-element": "^0.2.0"`, `packages/docusaurus-theme-docdive/package.json` → `"docdive": "^0.2.0"`.
- `CHANGELOG.md` `## Unreleased` holds 6 entries (`init --agent`, richer context bundle, "Copy link", `docdive.config.json`, index `version` check, trusted publishing). `index.json` schema stays `version: 1` (additive fields only).
- `.github/workflows/release.yml`: `verify` job rejects a tag that differs from any of the four versions, then `publish-npm` runs three `npm publish -w` lines in **one** `run:` block. A re-run after a partial publish fails on the first already-published package and never reaches the rest, so the recovery sentence in `docs/releasing.md` ("publish the remaining ones from a re-run of the failed job") does not hold today.
- `v0.2.0` release run succeeded (run 43779659868). GitHub Releases: only `0.1.0` exists; no `v0.2.0` Release.
- `main` is 4 commits ahead of `origin/main` (a2a351a, e769b9d, 727c668, 1648fcb); CI has not run on them.
- Examples consume the packages from the workspace: `examples/docusaurus/package.json` → `"docusaurus-theme-docdive": "*"`; `examples/mkdocs/pyproject.toml` → `[tool.uv.sources] mkdocs-docdive = { path = ..., editable = true }`. A registry smoke test needs copies outside the workspace.

### Decisions locked in Think

| Subject | Decision | Why |
| --- | --- | --- |
| Version | `0.3.0` | New features in `Unreleased`; schema still v1 |
| `init --agent` ranking (brief §11: top 20 dominated by same-file clusters) | Ship as is; separate increment | Keep the release small |
| Pre-tag gate | Push `main`, CI green on the 4 unpushed commits; no local e2e | Release `verify` job re-runs build/typecheck/lint/test/ruff anyway |
| Partial npm publish | Make each publish skip a version already on npm; re-run the failed job | Current one-block script cannot complete a re-run |
| Smoke-test failure | Fix and release `0.3.1` | npm unpublish is off the table |
| Docusaurus smoke | Copy `examples/docusaurus`, pin `docusaurus-theme-docdive` to `0.3.0`, install from the registry | Reuses the known-good site config |
| GitHub Release | Manual `gh release create`, body = CHANGELOG section verbatim; documented in `docs/releasing.md` | Smallest step; no new workflow job |
| Missing 0.2.0 Release | Backfill it from its CHANGELOG section | Keep the Releases list complete |
| Smoke steps | Ad hoc commands written into `docs/releasing.md`, no script | Small increment |

### Scope

**In scope:** version bump, CHANGELOG section, idempotent npm publish step + corrected docs, Release and smoke steps in `docs/releasing.md`, push/CI/tag/publish, three smoke tests, two GitHub Releases.
**Out of scope:** `init --agent` ranking change, release-notes automation in the workflow, a reusable smoke script, any new feature or fix in the packages, e2e suites.

### Invariants

- `release.yml` keeps OIDC trusted publishing: no tokens, `id-token: write` only on the publish jobs.
- Tag must equal all four versions (the `verify` job enforces it).
- `index.json` `version` stays `1` (`Index.version` in `model.ts`, `INDEX_VERSION` in `shared.ts`).

### Acceptance criteria

- CI green on `main` after the push; `release.yml` green on `v0.3.0`.
- `npx docdive@0.3.0 --version` prints `0.3.0`; `build` on `fixtures/toy` succeeds in a temp dir.
- `pip install mkdocs-docdive==0.3.0` in a temp venv; `mkdocs build` succeeds on the copied example.
- Copied Docusaurus example with `docusaurus-theme-docdive@0.3.0` from the registry builds.
- GitHub Releases `v0.2.0` and `v0.3.0` exist with their CHANGELOG sections as body.
- Owner validates solo.

## Tasks

- [x] T01: Make the npm publish step idempotent in `.github/workflows/release.yml`: one step or line per package that skips when `npm view <pkg>@<version> version` already returns the version, otherwise publishes; correct the partial-publish recovery sentence in `docs/releasing.md`
- [x] T02: Bump to 0.3.0: the three `package.json` versions, `docdive` → `docdive-element` range `^0.3.0`, `docusaurus-theme-docdive` → `docdive` range `^0.3.0`, `mkdocs_docdive/__init__.py`; refresh `package-lock.json`
- [x] T03: `CHANGELOG.md`: rename `## Unreleased` to `## 0.3.0 - 2026-11-16`
- [x] T04: `docs/releasing.md`: add step "create the GitHub Release with `gh release create v<version>` using the CHANGELOG section as body" and the three post-publish smoke steps (npx CLI on `fixtures/toy`; temp venv + `mkdocs build` on a copy of `examples/mkdocs` without the editable `tool.uv.sources`; copy of `examples/docusaurus` pinned to the registry version)
- [x] T05: Run the checks, commit, push `main`, wait for CI green on the pushed commits
- [x] T06: `git tag v0.3.0 && git push origin v0.3.0`; watch `release.yml` to success (on a partial publish, re-run the failed job per T01)
- [x] T07: Smoke npm CLI: in a temp dir, `npx docdive@0.3.0 --version` and `docdive build` on `fixtures/toy` [UAT]
- [x] T08: Smoke PyPI: temp venv, `pip install mkdocs-docdive==0.3.0`, `mkdocs build` on a copy of `examples/mkdocs` with the editable source entry removed [UAT]
- [x] T09: Smoke Docusaurus: copy `examples/docusaurus` to a temp dir, set `docusaurus-theme-docdive` to `0.3.0`, `npm install` from the registry, `npm run build` [UAT]
- [x] T10: GitHub Releases: `gh release create v0.2.0` (backfill) and `v0.3.0`, bodies = the matching CHANGELOG sections verbatim
