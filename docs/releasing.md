# Releasing

Releases are published by [`release.yml`](../.github/workflows/release.yml) when a `v*` tag is pushed. It publishes
all four packages at the same version, with no stored tokens and no 2FA prompt: npm and PyPI trust the workflow through
OIDC ("trusted publishing").

## Release steps

1. Bump the version in `packages/docdive-element`, `packages/docdive`, `packages/docusaurus-theme-docdive`
   (`package.json`, plus the `docdive` and `docdive-element` dependency ranges) and
   `packages/mkdocs-docdive/src/mkdocs_docdive/__init__.py`. Refresh `package-lock.json`.
2. Turn the CHANGELOG `Unreleased` section into `## <version> - <date>`.
3. Merge to `main`, then `git tag v<version> && git push origin v<version>`.

The workflow first checks that the tag equals all four versions, then runs the build, typecheck, lint and tests.
npm publishes in dependency order (`docdive-element`, `docdive`, `docusaurus-theme-docdive`) with provenance, and
PyPI publishes `mkdocs-docdive` in a parallel job. Re-running a failed job after a partial publish fails on the packages
that already went out; publish the remaining ones from a re-run of the failed job only.

## One-time setup

Do this once per package, on each registry. The values must match exactly or the publish is rejected.

**npm**, for `docdive-element`, `docdive` and `docusaurus-theme-docdive`: package page, Settings, *Trusted Publisher*,
GitHub Actions:

| Field | Value |
| --- | --- |
| Organization or user | `thibaudnavarre` |
| Repository | `docdive` |
| Workflow filename | `release.yml` |
| Environment | (empty) |

Then, per package, Settings, *Publishing access*: "Require two-factor authentication and disallow tokens". Revoke any
old automation tokens.

**PyPI**, for `mkdocs-docdive`: project page, Manage, Publishing, add a GitHub publisher with the same owner,
repository and workflow filename `release.yml`, and an empty environment.

## index.json schema version

`index.json` carries a top-level integer `version` (currently `1`). The rules:

- A change that breaks readers (removed or renamed field, changed meaning) bumps the integer. Additive fields do not.
- `<docdive-diagram>` refuses an `index.json` whose `version` is not the one it reads and shows a message asking for a
  rebuild with a matching docdive.
- The version is owned by `docdive` (`Index.version` in `model.ts`) and mirrored in `docdive-element`
  (`INDEX_VERSION` in `shared.ts`). Change both together.
