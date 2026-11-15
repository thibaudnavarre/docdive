# COR Plan — docdive v0.1.0 packaging

## Context

Promote the validated `spike/` (indexer/CLI, `<dyd-diagram>` element, Docusaurus + MkDocs adapters) into **docdive** 0.1.0. The result is a public MIT monorepo at `github.com/thibaudnavarre/docdive`, published to npm and PyPI. This plan covers packaging and CLI hardening only. Evidence: `.cor/research_v1_packaging.md`, `docs/product-brief.md`.

### Current state

- CLI `spike/src/cli.ts`:
  - parses `argv` by hand;
  - `index` writes `index.json` **into the docs folder** (`cli.ts:42`);
  - `context` defaults to the `toy` folder (`cli.ts:63`);
  - every failure ends in `process.exit(1)`;
  - it runs through `npx tsx src/cli.ts`, with no build step.
- `spike/src/loader.ts:3` imports `gray-matter` at runtime, but it is listed in `devDependencies`.
- `spike/viewer/element.ts:1` and `spike/viewer/main.ts:1` import `mermaid` statically. Edge mapping (`spike/viewer/shared.ts:37-45`) relies on Mermaid ids of the form `L_<a>_<b>_<n>`. These ids are identical in Mermaid 11.17.2 and 12.3.0 on the toy (probe, 2026-11-15).
- `spike/scripts/build-viewer.mjs` bundles the element with esbuild (ESM, `splitting: true`). The output is about 11 MB in 108 lazy chunks.
- Adapters:
  - `spike/ssg/docusaurus/dyd-theme/` is a CJS theme that wraps `@theme-init/Mermaid` and runs `npx tsx` in `postBuild`.
  - `spike/ssg/mkdocs/hooks.py` uses spike-relative paths and `npx tsx`.
  - Both copy `index.json`, `contexts.json`, `dyd-map.json` and the element directory into `<site>/dyd/`.
- `dyd` is a public prefix: element tag, `dyd-scenario` / `dyd-step` / `dyd-interval`, `data-dyd-*` (used as e2e selectors), the `/dyd/` folder, and the skill text.
- Suites:
  - vitest: 47 tests;
  - viewer e2e: 10 tests (`spike/e2e/viewer.pw.ts`);
  - A7 e2e: 13 tests (`spike/e2e/ssg.pw.ts`);
  - trace-context e2e: 18 tests (`spike/e2e/trace-context.pw.ts`).

  The SSG suites need `spike/ssg/build-all.sh`. The A7 test S6 on MkDocs reaches unpkg.
- There is no git repo. The global git identity is the work email. `gh` is logged in only as an employer-managed account, not the personal one. npm is not logged in. `spike/corpus` weighs 1.1 GB.

### Decisions locked in Think / Research

| Subject | Decision | Why |
| --- | --- | --- |
| Name | `docdive`; CLI bins `docdive` + `ddv` | `dyd` is taken on npm and PyPI; the name must not contain "mermaid" |
| Packages | `docdive` (core+CLI, ships the conventions skill), `docdive-element`, `docusaurus-theme-docdive` (npm), `mkdocs-docdive` (PyPI) | Unscoped names, all free. The Docusaurus adapter is a theme, so the name enables `themes: ['docdive']` |
| Repo | One npm-workspaces monorepo; fresh history; public on `thibaudnavarre`; MIT | Open source on the owner's personal account |
| Git identity | Repo-local `Thibaud Navarre <25456115+thibaudnavarre@users.noreply.github.com>` | Keeps the work email out of public history |
| Committed vs ignored | Commit `docs/` and `.cor/`. Ignore `.agents/`, `.claude/`, `.github/extensions/`, `skills-lock.json`, corpus, build outputs | Research stays public; agent tooling stays local |
| Spike | Code is promoted (refactored, tests kept); `spike/` is deleted after the move | No rewrite; the spike is validated |
| Public contract | Rename every `dyd*` identifier to `docdive*`; semver 0.x | Breaking changes are allowed until 1.0 |
| Runtimes | Node ≥ 22.12, ESM only; Python ≥ 3.11 | Node 20 and Python 3.10 are EOL; Mermaid 12 declares Node ≥ 22.12 |
| Mermaid | Element resolves Mermaid in this order: injected host instance → valid `window.mermaid` → lazy bundled 12.x. It never calls `initialize` on a host instance | Avoids two Mermaid copies and keeps the host's theme and dark-mode config |
| Mermaid 11 breakage | Fall back to bundled 12.x for that page and record it; full 11.x support is deferred | 11.x support must not block the release |
| CLI hardening | `index --out`, exit codes (0 ok, 1 domain/lint errors, 2 usage), errors on stderr, `--help` and `--version`; parse with `node:util` `parseArgs` | No CLI framework dependency |
| Adapter data | New `docdive build <docs> --out <dir>` writes `index.json`, `contexts.json` and the element assets. Adapters add only the doc → URL map | The Python plugin cannot resolve npm packages. Keeps adapters data-only (brief constraint 6) |
| MkDocs plugin | `BasePlugin` registered under the `mkdocs.plugins` entry point; `mkdocs>=1.6,<2`; configurable `command` (default `npx --yes docdive@<version>`) | MkDocs 2.0 has no plugin system |
| Publishing | Manual first publish (npm with 2FA OTP, `uv publish` with a token); CI runs checks only, with network allowed | Release automation is out of scope |

### Scope

**In scope:**
- monorepo scaffold;
- moving the code and renaming it;
- CLI hardening plus `build`;
- the element's Mermaid resolver;
- the Docusaurus theme and MkDocs plugin packages;
- example sites and e2e ports;
- a new host-Mermaid-11 e2e;
- READMEs (root plus a minimal one per package);
- GitHub Actions CI;
- pack-and-install test;
- GitHub repo creation and push;
- publishing 0.1.0.

**Out of scope:**
- New viewer features: click-to-source, deep-link copy, multi-fence pages, breadcrumb/back, `watch`.
- Config file.
- `index.json` schema versioning.
- Release automation, changesets and trusted publishing.
- MCP.
- Bundle-size work.
- MkDocs 2.0 and Zensical support.
- Publishing the standalone viewer.

### Invariants

- Docs stay pure Mermaid plus YAML frontmatter and render on GitHub (deletability).
- Removing an adapter is a config-only change, and the site falls back to native Mermaid.
- "Copy context" text is byte-identical to `docdive context <id>` stdout minus its final newline.
- `index.json` and `contexts.json` keep their current shape; only names change.
- Adapters contain no product logic.

### Acceptance criteria

- vitest, viewer, A7 and trace-context suites are green after the move and rename, plus the new host-Mermaid-11 e2e.
- `npm pack` and `uv build` tarballs installed into fresh Docusaurus and MkDocs sites outside the workspace render the diagrams, run a scenario trace and copy context.
- GitHub Actions CI is green on `thibaudnavarre/docdive`.
- 0.1.0 of all four packages is published and installable from npm and PyPI.
- `spike/` is gone, and no corpus or work email is in git history.
- The owner's walkthrough answer is yes.

## Tasks

- [x] T01: Initialize git at the repo root. Set the repo-local `user.name` / `user.email` (noreply). Write a `.gitignore` covering corpus, `node_modules`, build outputs (`build*/`, `site*/`, `dist/`), `test-results/`, `.ruff_cache/`, `.agents/`, `.claude/`, `.github/extensions/`, `skills-lock.json`. No commit yet.
- [x] T02: Scaffold the monorepo root:
  - private `package.json` with workspaces (`packages/*`, `apps/*`, `examples/*`) and `engines.node >=22.12`;
  - shared `tsconfig` base, ESLint and Vitest configs;
  - MIT `LICENSE`.
- [x] T03: Move `spike/src` into `packages/docdive`:
  - ESM `tsc` build to `dist/`;
  - `bin` `docdive` and `ddv` pointing to one shebang entry;
  - `gray-matter` as a dependency;
  - `skill/conventions.md` included in `files`.

  Existing unit tests must pass from the new location.
- [x] T04: Move `spike/viewer/element.ts` and `shared.ts` into `packages/docdive-element`. Use an esbuild ESM build with splitting into `dist/`. Bundle Mermaid 12.x and declare an optional peer `mermaid >=11.6 <13`.
- [x] T05: Move the standalone viewer (`main.ts`, `index.html`, `viewer.css`, serve script) into private `apps/viewer`, reusing `docdive-element` shared code.
- [x] T06: Rename `dyd` to `docdive` across code, tests and the skill:
  - element tag `<docdive-diagram>`, attributes, `docdive-scenario` / `docdive-step` / `docdive-interval`;
  - `data-docdive-*`, CSS classes, render id prefix;
  - `/docdive/` output folder and `docdive-map.json`;
  - CLI usage and skill text.
- [x] T07: Harden the CLI in `packages/docdive`:
  - `node:util` `parseArgs`;
  - exit codes 0, 1 and 2;
  - diagnostics on stderr, data on stdout;
  - `--help` and `--version` (read from `package.json`);
  - `index --out <dir>`, so the docs folder is never written;
  - remove the `toy` default from `context`.
- [x] T08: Add `docdive build <docs> --out <dir>`. It writes `index.json`, `contexts.json` and copies the `docdive-element` dist, so `docdive` depends on `docdive-element`.
- [x] T09: Write tests for the CLI [unit]:
  - bad usage gives exit code 2 with usage text on stderr;
  - `--version` matches `package.json`;
  - `index --out` leaves the docs folder untouched;
  - `build` output contains the three artifacts;
  - `ddv` aliases `docdive`.
- [x] T10: Add the Mermaid resolver to `docdive-element`:
  - remove the static import;
  - resolve injected instance → `window.mermaid` (only if it has `render` and is not an `Element`) → lazy `import()` of the bundled 12.x;
  - call `initialize` only on the bundled instance.
- [x] T11: Write tests for the resolver [unit]:
  - each resolution branch;
  - a DOM-element `window.mermaid` is rejected;
  - no `initialize` call on an injected instance.
- [x] T12: Create `packages/docusaurus-theme-docdive`:
  - ESM theme whose `getThemePath` wraps `@theme-init/Mermaid` and keeps the fallback;
  - a client module injects the host's `import('mermaid')` into the element;
  - `allContentLoaded` builds the doc → URL map;
  - `postBuild` runs `docdive build` and writes `docdive-map.json`;
  - peers `@docusaurus/core` and `@docusaurus/theme-mermaid ^3.10`.
- [x] T13: Create `packages/mkdocs-docdive`:
  - `pyproject.toml` with hatchling, `requires-python >=3.11` and `mkdocs>=1.6,<2`;
  - a `BasePlugin` registered under the `mkdocs.plugins` entry point `docdive`;
  - a configurable `command` option, default `npx --yes docdive@<version>`;
  - the `hooks.py` events ported (`on_files` map, `on_page_content` wrap, `on_post_build` runs `docdive build` and writes the map).

  Ruff must be clean.
- [x] T14: Move `spike/toy` to `fixtures/toy`. Move the SSG sites to `examples/docusaurus` and `examples/mkdocs`, each with an adapter and a plain variant, consuming the local packages. Port `build-all.sh` and the static-serve script.
- [x] T15: Port the viewer, A7 and trace-context e2e suites and their Playwright configs to the new layout and names. All 41 tests must be green [integration].
- [x] T16: Add an e2e where Docusaurus injects the host's Mermaid 11.17.2. It must render, trace a scenario (parallel edges included) and copy context, with no bundled Mermaid chunk loaded [integration].
- [x] T17: Point the `.cor/config.md` checks and `ruff.toml` excludes at the new layout. Every check must pass from the repo root.
- [x] T18: Move `spike/corpus` to a gitignored `corpus/`. Delete `spike/`. Re-run all checks and e2e to confirm nothing still references it.
- [x] T19: Write the root README (what docdive is, packages, quick start for Docusaurus and MkDocs, MkDocs `<2` note). Add a minimal README per published package (install plus one usage snippet).
- [x] T20: Add a GitHub Actions CI workflow: Node 22, `npm ci`, typecheck, lint, vitest, `uvx ruff`, Playwright Chromium install, example-site builds through uv, and all e2e suites. Network is allowed.
- [x] T21: Run a pack-and-install test [integration]:
  - `npm pack` each npm package and `uv build` the MkDocs plugin;
  - install the tarballs into fresh Docusaurus and MkDocs sites outside the workspace (MkDocs `command` pointing at the packed CLI);
  - confirm render, trace and copy context.
- [x] T22: Publish the repo:
  - check the staged tree is under ~10 MB and has no work email or corpus;
  - make the initial commit;
  - the owner runs `gh auth login` as `thibaudnavarre`;
  - create the public repo `thibaudnavarre/docdive` and push;
  - confirm CI is green.
- [x] T23: Publish 0.1.0:
  - `npm publish --dry-run` for each package;
  - the owner logs in to npm with 2FA and publishes `docdive-element`, then `docdive`, then `docusaurus-theme-docdive`;
  - `uv publish` for `mkdocs-docdive`;
  - confirm each package installs from its registry.
- [ ] T24: The owner walks through a Docusaurus site and an MkDocs site that use the published packages (render, deep dive, trace, copy context) and records a yes or no [UAT].

## Notes

- [decision] `spike/` was copied, not moved, until T18 so its checks and e2e stayed a green baseline; it is now deleted. The A4 harness moved to `scripts/research/`, the corpus fetcher to `scripts/fetch-corpus.sh` (corpus lives in the gitignored `corpus/`); `spike/highlight.html` was dropped (superseded by the element).
- [gotcha] The Docusaurus theme entry is CommonJS (`src/index.cjs`), not ESM: Docusaurus loads theme modules through jiti, which fails on `import.meta`. The theme's `client.js` and `theme/` stay ESM (webpack handles them).
- [gotcha] `mkdocs.config.config_options.ExtraScriptValue` takes only `path` in its constructor; set `.type = "module"` afterwards.
- [decision] `docdive index` without `--out` prints the JSON on stdout; the generated `index.json` is no longer written into the docs folder, so `fixtures/toy` has none. The e2e suites that read `spike/toy/index.json` (T15) must read it from the built site or from `docdive index`.
- [setup] `npm test` first rebuilds `docdive-element` (`pretest`) because the `build` CLI test needs its `dist/`. `npm run typecheck` of `apps/viewer` needs `docdive-element` built (its `shared` types are emitted into `dist/`).
- [practice] e2e specs live in root `e2e/` and read expected data through `e2e/helpers.ts` (built CLI), never from a generated file in the fixture. Run order: `npm run examples:build`, then `npm run e2e` (viewer) and `npm run e2e:ssg`. Viewer 10/10 and SSG + trace-context 31/31 pass on the packaged layout.
- [decision] The host-Mermaid-11 e2e (`e2e/host-mermaid.pw.ts`, port 4205) builds the same Docusaurus example with `DOCDIVE_HOST_MERMAID=11`, which aliases the site's `mermaid` to a pinned `mermaid11` (`npm:mermaid@11.17.2`). The element's two small helper chunks (esbuild runtime + shared code, ~6 KB) load on every page; the assertion is "no chunk carrying Mermaid", not "no chunk at all".
- [gotcha] In the workspace the Docusaurus example's host Mermaid is the hoisted 12.3.0 (the nested 11.17.2 only belongs to `@mermaid-js/layout-elk`), so the default build exercises injection of a 12.x host; only the `build-mermaid11` variant exercises 11.x.
- [practice] `npm run pack-test` (`scripts/pack-test.sh`) packs the three npm packages and the MkDocs wheel, installs them into fresh sites outside the workspace and runs `e2e/packed.pw.ts` (needs network and uv). The Docusaurus site renders with its own Mermaid (`data-docdive-mermaid="injected"`), the MkDocs site with the bundled copy (`bundled`). Tarballs total ~2 MB.
- [gotcha] The CLI infers more when the docs folder sits next to an SSG config (`docusaurus.config.js`, `mkdocs.yml`), so `docdive context` output for the same files differs from the bare fixture (confidence 0.6, other children). Compare "copy context" against the CLI on the same folder, never on `fixtures/toy`.
- [decision] T22: the personal `gh` login was replaced by the owner creating the empty public repo on the web and pushing over SSH (`origin` = `git@github.com-personal:thibaudnavarre/docdive.git`, key `id_ed25519_gh-thibaudnavarre`); the `gh` keyring still holds only the managed account, which is used read-only for `gh run view`. CI run on the initial commit: green.
- [note] Published 0.1.0 of all four packages. npm briefly lists a placeholder `docdive-element@0.0.0-stage` created at first publish; `latest` is 0.1.0. Verified from the registries: npm install of the three packages, and `mkdocs-docdive==0.1.0` building a site with the default `npx --yes docdive@0.1.0` command.
- [practice] T24 automated walkthrough (2026-11-16): fresh Docusaurus and MkDocs sites built from the registry packages (docdive 0.1.0, docusaurus-theme-docdive 0.1.0, mkdocs-docdive 0.1.0, default `npx --yes docdive@0.1.0` command), driven in Chromium with `e2e/packed.pw.ts`: render, deep dive, scenario trace and copy context, 8/8 on both sites. The owner's yes/no is still pending.
