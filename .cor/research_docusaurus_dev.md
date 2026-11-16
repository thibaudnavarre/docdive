# COR Research — Docusaurus dev-mode support (`docusaurus start`)

## Decision summary
- Recommended approach: in `docusaurus-theme-docdive`, return a `devServer` fragment from `configureWebpack` that (a) appends a `static` entry serving `<generatedFilesDir>/docdive` at `<baseUrl>docdive`, and (b) defines `onListening` to spawn one long-lived `docdive watch <docsDir> --out <generatedFilesDir>/docdive [--src …]` child process (killed on parent exit). Write `docdive-map.json` into the same dir from `allContentLoaded`, which Docusaurus re-runs on every docs reload. `postBuild` stays unchanged.
- Why it fits this project: zero config (Think), only Node built-ins (no new runtime dep), the theme stays CommonJS, and `postBuild` (the production path) is untouched, so build output stays byte-identical. It reuses the existing `watch` command, which already keeps the last good data when a rebuild fails. `onListening` is only called by webpack-dev-server, so no dev/prod heuristic is needed.
- Confidence: HIGH for the hooks and merge semantics (verified in the installed 3.10.2 / wds 5.2.7 / webpack-merge 6.0.1 source). MEDIUM for end-to-end serving behavior (static vs `historyApiFallback` under `baseUrl`), which the planned e2e test must prove.

## Project evidence
- Goal inherited from Think: under `docusaurus start`, diagrams are interactive with no extra config. After editing Markdown, a manual page refresh shows fresh data.
- Scope boundaries: Docusaurus theme only. The `src` option must work in dev. If docs are added or renamed, restarting the dev server is acceptable. MkDocs changes only by the 0.2.0 version bump. The element API is frozen.
- Acceptance criteria: a Playwright e2e test against `docusaurus start`: the diagram is interactive, then edit a `.md`, reload, and the new data appears. Ship as 0.2.0 with a changelog entry.
- Resolved versions: `@docusaurus/core` 3.10.2 (`package-lock.json:3727`), `webpack-dev-server` 5.2.7, `webpack-merge` 6.0.1, Node 22 (CI), `docdive` 0.1.0.
- Existing usages and primitives:
  - `packages/docusaurus-theme-docdive/src/index.cjs:25`: `allContentLoaded` builds `docMap`. `:34`: `postBuild` runs `docdive build` via `execFileSync(process.execPath, [docdiveCli, …])`.
  - `packages/docusaurus-theme-docdive/src/client.js:6`: loads `${baseUrl}docdive/docdive-element.js` (webpackIgnore), so in dev this URL must be served.
  - `packages/docdive/src/run.ts:108`: `watchDocs`. It runs a full rebuild on each `.md`/`.mdx` change (debounce 100 ms). A failed rebuild is logged and the last good files are kept (`writeOutputs` uses `writeAtomic`, `run.ts:90`). It stops on SIGINT/SIGTERM via `io.signal`. The **initial** build is not guarded: if it throws, `watch` exits.
  - `packages/docdive/src/run.ts:96`: `copyAssets` copies the element bundle into `--out` (done by both `build` and `watch`).
  - `.gitignore` already ignores `.docusaurus/`.
  - `examples/docusaurus/docusaurus.config.js`: `baseUrl: "/docdive/"`, docs path `../../fixtures/toy` (shared fixture).
  - E2E today only serves static builds (`playwright.ssg.config.ts`, `playwright.packed.config.ts`). CI is `ubuntu-latest` (`.github/workflows/ci.yml`).
- Measured rebuild cost (`docdive build`, this machine): toy 0.18 s, temporal (812 md) 5.4 s, posthog (4006 md) 16 s, gitlabhq (3098 md) 73 s.
- Constraints inherited from Think: production build byte-identical; no new runtime deps in the theme; theme stays CommonJS (jiti); element API frozen; on invalid Markdown, log the error, keep the last good data and keep the dev server alive.

## Findings
| Claim | Evidence | Applicability |
| --- | --- | --- |
| `postBuild` runs only after a production build, so `start` never produces docdive assets. | [Lifecycle APIs, `postBuild`](https://docusaurus.io/docs/api/plugin-methods/lifecycle-apis#postBuild) (v3.10.2) | Root cause confirmed. |
| Plugins configure the dev server by returning a `devServer` field from `configureWebpack`. | [Lifecycle APIs, "Configuring dev server"](https://docusaurus.io/docs/api/plugin-methods/lifecycle-apis#configuring-dev-server); installed `@docusaurus/core/lib/commands/start/webpack.js:143-145` merges `config.devServer` over defaults with webpack-merge | Official, supported hook. No heuristic needed. |
| Docusaurus' default `static` is an array of `{publicPath: baseUrl, directory}` entries built from `siteConfig.staticDirectories`. | `@docusaurus/core/lib/commands/start/webpack.js:76-86` (3.10.2) | Our extra `static` entry is appended. It does not replace the site's `static/`. |
| webpack-merge 6 concatenates arrays and **composes functions**: both are called and their results are merged (arrays concatenated). | `node_modules/webpack-merge/dist/join-arrays.js` (6.0.1) | Do **not** define `setupMiddlewares`: Docusaurus defines it, and composing would duplicate the whole middleware list. `onListening` is safe because Docusaurus does not define it. |
| wds calls `onListening(devServer)` only once the server is listening. | `node_modules/webpack-dev-server/lib/Server.js:3696-3697` (5.2.7); [webpack devServer docs](https://webpack.js.org/configuration/dev-server/) (`>= 5.0.0`) | A dev-only trigger. `docusaurus build` never calls it, so prod behavior is unchanged. |
| On a docs file change, `start` reloads only that plugin, then re-runs `allContentLoaded` for **all** plugins. A failed reload is logged, and the dev server keeps the previous site. | `@docusaurus/core/lib/commands/start/start.js:23-30`, `utils.js` (`reloadPlugin` try/catch), `server/plugins/plugins.js:162-189` | `docMap` can be refreshed for free on each reload (better than the "restart acceptable" floor). Never `await` a slow rebuild in `allContentLoaded`: it blocks every hot reload. |
| `docusaurus start` sets `NODE_ENV ??= 'development'`, but `docusaurus build --dev` also sets `development`. | `@docusaurus/core/bin/docusaurus.mjs:21`, `lib/commands/build/build.js:19-23` | `NODE_ENV` is **not** a reliable dev signal. Rejected. |
| `start` installs SIGINT/SIGTERM handlers that call `devServer.stop(); process.exit()`. | `@docusaurus/core/lib/commands/start/start.js:35-40` | A spawned child must be killed from a `process.on("exit")` handler. Otherwise it is orphaned when the parent alone gets SIGTERM (e.g. Playwright `webServer` teardown). |
| Full `docdive build` takes 5–73 s on real corpora. | Local measurement above | A rebuild must run out of process and asynchronously. `execFileSync` (as in `postBuild`) is not acceptable in dev. |

## Options considered
| Option | Fit | Maintenance / risk | Decision |
| --- | --- | --- | --- |
| A. `configureWebpack` → `devServer.static` (generatedFilesDir) + `onListening` spawns `docdive watch`; `allContentLoaded` writes `docdive-map.json` | Meets all Think constraints. Reuses `watch`'s keep-last-good behavior and its debounce. One process. | Must kill the child on exit. The initial-build failure path exits `watch` (see unresolved). | **ADOPT** |
| B. Re-run `docdive build` (async, non-awaited, serialized) from `allContentLoaded` on each reload, with dev detected via `onListening` | No long-lived child. Reload is driven by Docusaurus' own watcher. | Each rebuild spawns a new CLI process. Needs its own queue/coalescing logic, which duplicates `watch`. | FALLBACK (if `watch` cannot be made to survive an initial failure) |
| C. Await `docdive build` inside `allContentLoaded` in all modes and have `postBuild` copy from it | Simplest code. | Blocks every hot reload for up to 73 s on large docs, and doubles prod build work. | REJECT |
| D. Detect dev via `NODE_ENV` / `process.argv` | Trivial. | `build --dev` also sets development; argv breaks the programmatic API. | REJECT |
| E. Custom `setupMiddlewares` serving JSON on the fly | No files on disk. | webpack-merge composes it with Docusaurus' own `setupMiddlewares`, which duplicates all middlewares. | REJECT |
| F. Write into the site's `static/` dir | Served automatically. | Pollutes the user's repo, and `static/` is copied into prod output, which breaks the byte-identical build. | REJECT |

## Plan inputs
- Components or files likely affected:
  - `packages/docusaurus-theme-docdive/src/index.cjs`: add `configureWebpack` (`isServer === false` only) with `devServer: { static: [{ directory, publicPath }], onListening }`, the spawn and kill logic, and the `docdive-map.json` write in `allContentLoaded`.
  - Possibly `packages/docdive/src/run.ts` `watchDocs` (initial-build resilience, see unresolved).
  - A new e2e spec plus a Playwright config (or project) whose `webServer` runs `docusaurus start` for `examples/docusaurus`.
  - `CHANGELOG.md`, package versions → 0.2.0 (including the MkDocs `__version__` pin).
  - Docs for the theme README / `docs/` if they describe dev usage.
- Version-specific APIs:
  - Docusaurus 3.10.2: `configureWebpack(config, isServer)` returning `devServer`; `context.generatedFilesDir` (`<siteDir>/.docusaurus`).
  - wds 5.2.7: `static: [{ directory, publicPath, watch }]` and `onListening(devServer)`.
  - `publicPath` must be `${siteConfig.baseUrl}docdive` (baseUrl ends with `/`).
- New dependency and version policy, if any: none. `node:child_process` `spawn` with `process.execPath` + the existing `docdiveCli` path.
- Risks and mitigations:
  - Orphaned `watch` child → kill it in `process.on("exit")`; also forward SIGINT/SIGTERM (Docusaurus calls `process.exit()`, which fires `exit`).
  - `onListening` is called once per server, but `configureWebpack` may run more than once → guard the spawn with a module-level flag.
  - The initial `watch` build throws on bad Markdown → the child exits and the dev server stays up with no data. This does not meet "keep alive and recover"; decide in Plan.
  - Static vs `historyApiFallback` ordering under `baseUrl` → prove it with e2e (request `docdive/index.json` and get JSON, not the HTML shell).
  - The e2e test edits the shared `fixtures/toy` → copy it to a temp docs dir, or edit and restore in `finally`.
  - `fs.watch({recursive:true})` on Linux needs Node ≥ 20 → CI is Node 22. OK.
  - wds `static.watch` defaults to on → set `watch: false` for this entry (manual refresh is the agreed contract; avoids an extra chokidar watcher).
- Validation and test implications:
  - Byte-identical prod: diff `examples/docusaurus/build` before and after (or rely on the existing `e2e:ssg` + packed suites passing unchanged).
  - New dev e2e: wait for `docdive/index.json`, check a diagram node is interactive, edit a `.md`, poll `index.json` until it changes, reload, assert the new data in the UI.
  - Unit test only if `watchDocs` changes (initial-failure path) in `packages/docdive/src/cli.test.ts`.
  - Add the dev e2e to CI (`ubuntu-latest`).
- Decisions cor-plan must preserve:
  - Never `await` a docdive rebuild inside a Docusaurus lifecycle hook.
  - Never define `setupMiddlewares` in the theme.
  - Don't detect dev mode via `NODE_ENV` or argv.
  - Only `onListening` / `devServer` triggers dev behavior.
  - Dev output lives under `generatedFilesDir`, never `static/` or `outDir`.
  - `postBuild` is unchanged.

## Unresolved questions
- When the **initial** dev build fails, should `docdive watch` keep watching and recover on the next save (a small CLI change: guard the first `rebuild()` like later ones, but still copy assets)? Or is "log the error, dev server alive without data until restart" enough? Think's rule ("log, keep last good data, keep alive") favors the CLI change; there is no last good data at startup.
- Whether the e2e should run `docusaurus start` in the existing `e2e:ssg` job or a new script. This is a CI-time trade-off for Plan.

## Sources
- [Docusaurus Lifecycle APIs (v3.10.2)](https://docusaurus.io/docs/api/plugin-methods/lifecycle-apis), accessed 2026-11-16
- [webpack DevServer configuration (wds >= 5)](https://webpack.js.org/configuration/dev-server/), accessed 2026-11-16
- Installed source, accessed 2026-11-16: `node_modules/@docusaurus/core/lib/commands/start/{start,webpack,utils,watcher}.js`, `lib/server/plugins/plugins.js`, `bin/docusaurus.mjs` (3.10.2); `node_modules/webpack-dev-server/lib/Server.js` (5.2.7); `node_modules/webpack-merge/dist/join-arrays.js` (6.0.1)
