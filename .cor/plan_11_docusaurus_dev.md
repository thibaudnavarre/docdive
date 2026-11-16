# COR Plan — Docusaurus dev mode (`docusaurus start`)

## Context

Make `docusaurus-theme-docdive` work under `docusaurus start` with zero extra config. Diagrams should be interactive, and after a Markdown edit a manual page refresh should show fresh data. Ship as 0.2.0. Evidence: `.cor/research_docusaurus_dev.md`.

### Root cause / current state

- `packages/docusaurus-theme-docdive/src/index.cjs:34`: `docdive build` runs only in `postBuild`, which `start` never calls. In dev, `client.js:6` imports `${baseUrl}docdive/docdive-element.js`, which nothing serves, so there are no docdive features at all.
- `packages/docdive/src/run.ts:108` `watchDocs`: a failed **rebuild** is logged and the last good files are kept (`writeAtomic`). A failed **initial** build throws, and `watch` exits.
- Docusaurus 3.10.2 `start` merges the plugin `devServer` over its defaults with webpack-merge 6. That merge concatenates arrays and composes functions. On a docs change, `start` re-runs `allContentLoaded` for all plugins.
- A full rebuild costs 0.18 s on the toy fixture and 5–73 s on the real corpora.

### Decisions locked in Think / Research

| Subject | Decision | Why |
| --- | --- | --- |
| Adapter scope | Docusaurus only | `mkdocs serve` already re-runs `on_post_build` on each rebuild |
| Freshness contract | Manual page refresh shows new data. No auto-reload. | Enough for the owner. Avoids HMR work. |
| Dev trigger | `devServer.onListening` (only called by webpack-dev-server) | `NODE_ENV` is also `development` under `build --dev`, and argv sniffing breaks the programmatic API |
| Rebuild engine | One long-lived `docdive watch` child process | Reuses debounce and keep-last-good behavior. Rebuilds can take up to 73 s, so they must never be awaited in a lifecycle hook. |
| Output location | `<generatedFilesDir>/docdive` (`.docusaurus/`, gitignored), served via an appended `devServer.static` entry at `<baseUrl>docdive`, `watch: false` | `static/` would pollute the repo and leak into prod output |
| `setupMiddlewares` | Never define it in the theme | Docusaurus defines it too. Composition would duplicate every middleware. |
| `docdive-map.json` in dev | Written from `allContentLoaded` | That hook re-runs on every docs reload, so the map stays fresh at no extra cost |
| Initial build failure | `watch` logs it, still copies assets, keeps watching, and recovers on the next save | Think rule: log, keep the dev server alive. There is no last good data at startup. |
| `src` option | Passed to `watch` as `--src`, resolved like in `postBuild` | Same behavior as build |
| Dev e2e in CI | Separate `e2e:dev` script and CI step | Keeps the existing suites unchanged |

### Scope

**In scope:** `watch` initial-failure resilience, theme dev-server wiring, map file in dev, dev e2e plus CI, docs, the 0.2.0 bump and publish.
**Out of scope:** MkDocs dev changes (only the `__version__` bump), browser auto-reload/HMR, any change to the element package API, any change to `postBuild`.

### Invariants

- Production `docusaurus build` output is byte-identical.
- The theme stays CommonJS (jiti cannot evaluate `import.meta`) and adds no runtime dependencies. Only `node:` built-ins are allowed.
- The `docdive-element` API is frozen.
- Existing `watch` behavior is kept: exit 0 on abort, exit 1 when the folder disappears, keep-last-good on a failed rebuild.

### Acceptance criteria

- Playwright e2e against `docusaurus start` on `examples/docusaurus`: the diagram is interactive. Then edit a `.md`, wait for `index.json` to change, reload, and the new data appears. It runs in CI.
- `examples/docusaurus/build` is byte-identical before and after the change.
- 0.2.0 is published, with a changelog entry.

## Tasks

- [x] T01: `docdive watch`: when the initial build fails, log the error, still copy the element assets, keep watching, and recover on the next save (`packages/docdive/src/run.ts` `watchDocs`).
- [x] T02: Unit test for the initial-failure recovery in `packages/docdive/src/cli.test.ts` [unit]
- [x] T03: Theme: `configureWebpack` (client build only, `isServer === false`) returns `devServer.static: [{ directory: <generatedFilesDir>/docdive, publicPath: <baseUrl>docdive, watch: false }]`.
- [x] T04: Theme: `devServer.onListening` spawns one `docdive watch <docsDir> --out <generatedFilesDir>/docdive [--src]` using `process.execPath` and the existing `docdiveCli`, with stdio inherited. A module-level flag ensures it is spawned once. It is killed from `process.on("exit")`.
- [x] T05: Theme: `allContentLoaded` also writes `docdive-map.json` into `<generatedFilesDir>/docdive` (mkdir -p).
- [x] T06: Verify the production build is byte-identical: run `diff -r` on `examples/docusaurus/build` built before and after T03–T05 [integration]
- [x] T07: Write a Playwright e2e test against `docusaurus start`: a new config plus `e2e/dev.pw.ts`. Check the diagram is interactive; edit a `.md`, poll `docdive/index.json` until it changes, reload, and assert the new data. Restore the shared `fixtures/toy` file in `finally` [integration]
- [x] T08: Add an `e2e:dev` npm script and a CI step in `.github/workflows/ci.yml`.
- [x] T09: Docs: add a dev-mode section to `packages/docusaurus-theme-docdive/README.md` and a `CHANGELOG.md` Unreleased entry.
- [x] T10: Bump all four packages to 0.2.0: `package.json` versions, inter-package deps (`docdive ^0.2.0`), and the MkDocs `__version__`. Turn the CHANGELOG Unreleased section into `## 0.2.0`.
- [x] T11: Publish 0.2.0: run `npm publish --dry-run` for each package. The owner publishes with 2FA in the order `docdive-element` → `docdive` → `docusaurus-theme-docdive`, then `uv publish` for `mkdocs-docdive`. Confirm each package installs from its registry.
