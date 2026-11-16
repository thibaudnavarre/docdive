# Releasing

Releases are published by [`release.yml`](../.github/workflows/release.yml) when a `v*` tag is pushed. It publishes
all four packages at the same version, with no stored tokens and no 2FA prompt: npm and PyPI trust the workflow through
OIDC ("trusted publishing").

## Release steps

1. Bump the version in `packages/docdive-element`, `packages/docdive`, `packages/docusaurus-theme-docdive`
   (`package.json`, plus the `docdive` and `docdive-element` dependency ranges) and
   `packages/mkdocs-docdive/src/mkdocs_docdive/__init__.py`. Refresh `package-lock.json`.
2. Turn the CHANGELOG `Unreleased` section into `## <version> - <date>`.
3. Merge to `main`, wait for CI to pass, then `git tag v<version> && git push origin v<version>`.
4. When `release.yml` succeeds, run the smoke tests below against the published artifacts.
5. Create the GitHub Release, with the CHANGELOG section as its body:

   ```sh
   v=<version>
   gh release create "v$v" --title "$v" --notes "$(awk -v h="## $v " 'index($0, h) == 1 {f = 1; next} /^## / {f = 0} f' CHANGELOG.md)"
   ```

The workflow first checks that the tag equals all four versions, then runs the build, typecheck, lint and tests.
npm publishes in dependency order (`docdive-element`, `docdive`, `docusaurus-theme-docdive`) with provenance, and
PyPI publishes `mkdocs-docdive` in a parallel job. The npm step skips a package whose version is already on npm, so after
a partial publish re-run the failed job and it publishes only the remaining packages.

## Smoke tests

Run these from a temp directory, against the registries, not the workspace. A failure means a fix and a new patch
release: npm versions cannot be unpublished.

```sh
v=<version>
repo=$PWD
tmp=$(mktemp -d)
```

**npm CLI** on the toy fixture:

```sh
cd "$tmp" && npx --yes "docdive@$v" --version   # prints $v
cp -R "$repo/fixtures/toy" toy && cd toy && npx --yes "docdive@$v" build . --out out
```

**mkdocs-docdive** on a copy of the MkDocs example, without the editable source and the workspace CLI command:

```sh
mkdir -p "$tmp/examples" "$tmp/fixtures/toy" && cp -R "$repo/fixtures/toy/." "$tmp/fixtures/toy/"
cp -R "$repo/examples/mkdocs" "$tmp/examples/mkdocs" && cd "$tmp/examples/mkdocs"
rm -rf site site-plain uv.lock
sed -i.bak -e '/Run the workspace CLI/d' -e '/command: node/d' -e 's/- docdive:/- docdive/' mkdocs.yml
python3 -m venv .venv && . .venv/bin/activate
pip install mkdocs-material==9.8.1 "mkdocs-docdive==$v" && mkdocs build
```

**docusaurus-theme-docdive** on a copy of the Docusaurus example:

```sh
mkdir -p "$tmp/examples" "$tmp/fixtures/toy" && cp -R "$repo/fixtures/toy/." "$tmp/fixtures/toy/"
cp -R "$repo/examples/docusaurus" "$tmp/examples/docusaurus" && cd "$tmp/examples/docusaurus"
rm -rf node_modules build build-plain build-mermaid11 .docusaurus
npm pkg set "dependencies.docusaurus-theme-docdive=$v" && npm install && npm run build
```

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
