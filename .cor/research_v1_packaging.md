# COR Research — docdive v0.1.0 packaging (spike → monorepo, Mermaid reuse, SSG plugins, publishing)

## Decision summary
- Recommended approach:
  - **Runtimes:** raise the floor to **Node ≥ 22.12** and **Python ≥ 3.11**. Node 20 and Python 3.10 are already EOL, and Mermaid 12 declares Node ≥ 22.12.
  - **Element and Mermaid:** the element loads Mermaid **through an injectable resolver** with no static import. It tries, in order:
    1. an instance the adapter injects (Docusaurus: the site's own `mermaid`, resolved by webpack through a `peerDependency`);
    2. a usable `window.mermaid` (the MkDocs case when the user loads Mermaid globally);
    3. the bundled Mermaid 12 chunk loaded with a lazy `import()`.
  - **CLI:** keep the spike's hand-rolled CLI but move parsing to `node:util` `parseArgs` (no new dependency), add `--out`, exit codes, `--help` and `--version`, and compile to ESM `dist/` with `tsc`.
  - **Docusaurus:** ship the adapter as an ESM **theme** module (default export).
  - **MkDocs:** ship a `BasePlugin` registered through the `mkdocs.plugins` entry point, pinned to `mkdocs>=1.6,<2`.
  - **Publishing:** do the first publish by hand: `npm publish -w`, which requires an interactive npm 2FA prompt, then `uv publish` with a PyPI token.
- Why it fits this project:
  - It covers every Think decision: 0.x contract, Mermaid 11 + 12 with bundled fallback, adapters with no product logic (brief constraint 6), manual first publish, ESM only.
  - It adds no new runtime dependency.
  - The only deviations are runtime floors that the evidence shows are already EOL.
- Confidence: **HIGH** on versions, Mermaid ID compatibility, plugin mechanics and publishing. **MEDIUM** on reusing the Docusaurus Mermaid instance (it shares global `initialize` state with the host) and on how the MkDocs plugin obtains the CLI and element assets (see Unresolved).

## Project evidence
- **Goal inherited from Think:** promote the validated spike into **docdive** 0.1.0 at `github.com/thibaudnavarre/docdive`. It is a public MIT monorepo with npm workspaces and fresh history, containing these packages:
  - `docdive`: core and CLI, bins `docdive` and `ddv`, ships the conventions skill.
  - `docdive-element`
  - `docusaurus-plugin-docdive`
  - `mkdocs-docdive` (PyPI)
  - The standalone viewer becomes an unpublished demo app.
- **Scope boundaries:**
  - Packaging and CLI hardening only: index output path, exit codes with errors on stderr, `--help` and `--version`.
  - No new viewer features. No release automation; CI runs checks and e2e.
  - Every `dyd` identifier is renamed to `docdive` (element tag, attributes, URL params, `data-*`, output folder, skill text).
  - `spike/` is deleted after the move. `spike/corpus` (1.1 GB) and build outputs are never committed.
  - Agent tooling (`.agents/`, `.claude/`, `.github/extensions/`, `skills-lock.json`) is gitignored. `docs/` and `.cor/` are committed.
- **Acceptance criteria:**
  - Every existing suite is green after the move and rename: vitest 47, viewer e2e 10, A7 13, trace-context 18.
  - `npm pack` / `uv build` tarballs work in fresh Docusaurus and MkDocs sites.
  - GitHub Actions CI is green; network access is allowed for the unpkg test.
  - 0.1.0 is published to npm and PyPI.
  - The repo has a root README plus a minimal README per package.
- **Resolved versions** (registry, 2026-11-15): mermaid 12.3.0 (latest; 11.17.2 is the last 11.x; 13.0.0-alpha.3 on `v13-alpha`), @docusaurus/core and theme-mermaid 3.10.2, mkdocs 1.6.1 (2.0.dev6 pre-release), mkdocs-material 9.8.1, esbuild 0.28.2, tsx 4.23.15, gray-matter 4.0.3, typescript ~6.0 (pinned in `.cor/config.md`), Playwright 1.65.1. Local toolchain: Node 26.13.0, uv 0.12.6, Python 3.15.2.
- **Existing usages and primitives:**
  - `spike/src/cli.ts:23` — hand-rolled `argv` parsing; `index` writes to `join(root, "index.json")` inside the docs folder (`cli.ts:42`); failures go through `throw new Error(USAGE)` and then `process.exit(1)` (`cli.ts:104-109`); `context` defaults to the `toy` folder (`cli.ts:63`).
  - `spike/src/loader.ts:3` — `gray-matter` is a **runtime** import but is listed under `devDependencies` (`spike/package.json`). It must become a `dependency` of `docdive`.
  - `spike/viewer/element.ts:1` and `spike/viewer/main.ts:1` — **static** `import mermaid from "mermaid"`; render goes through `mermaid.render(id, source)` (`element.ts:165`).
  - `spike/viewer/shared.ts:37-45` — edge mapping relies on Mermaid link ids `L_<a>_<b>_<n>`, positional for parallel edges.
  - `spike/scripts/build-viewer.mjs` — esbuild ESM bundle with `splitting: true`, entry `dyd-diagram`, output `viewer/dist-element` (directory of lazy Mermaid chunks, about 11 MB and 108 files per `docs/ssg-findings.md`).
  - `spike/ssg/docusaurus/dyd-theme/index.js` — CJS theme: `getThemePath`, `getClientModules`, `allContentLoaded` (doc → permalink map) and `postBuild` (shells out to `npx tsx src/cli.ts`, copies the element directory, `index.json`, `dyd-map.json` and `contexts.json` into `<outDir>/dyd`).
  - `spike/ssg/docusaurus/dyd-theme/theme/Mermaid/index.js` — wraps `@theme-init/Mermaid` and falls back to it if the element bundle fails to load.
  - `spike/ssg/mkdocs/hooks.py` — `on_pre_build` (runs `index`), `on_files` (doc URL map), `on_page_content` (wraps `<pre class="mermaid">` in the element), `on_post_build` (copies assets). It uses spike-relative paths and `npx tsx`.
- **Constraints inherited from Think:** ESM only; the element must work with Mermaid 11.x and 12.x and fall back to the bundled 12.x; contract is 0.x (breaking changes allowed); MIT; a personal git identity (`25456115+thibaudnavarre@users.noreply.github.com`) and personal `gh` account; manual publish.

## Findings
| Claim | Evidence | Applicability |
| --- | --- | --- |
| Node 20 reached EOL on 2026-03-24. Node 22, 24 and 26 are LTS. | [Node.js releases](https://nodejs.org/en/about/previous-releases) | The Think floor "Node ≥ 20" targets an EOL runtime. |
| Mermaid 12.0.0 requires ES2024 / Safari 17.4+ and **declares Node ≥ 22.12** in `package.json`. | [mermaid@12.0.0 release](https://github.com/mermaid-js/mermaid/releases/tag/mermaid%4012.0.0) | Any package that depends on mermaid 12 inherits an `engines` floor of 22.12. |
| Mermaid 12 makes **ELK the default layout** for flowchart, state, class and ER diagrams, and lays out and colours them differently from 11 (dagre). ELK is a lazy chunk in the ESM build. | Same release notes | The same diagram rendered by host 11 and by the bundled 12 will look different. Positions change; ids do not (next row). |
| On the toy flowchart and a sequence diagram, Mermaid **11.17.2 and 12.3.0 emit identical ids**: edges `L_API_OrderService_0`, `L_OrderService_PaymentGateway_0` / `_2` (parallel edge), node `flowchart-<id>-<n>`, actors `[name=<id>]`, and `text.messageText`. | Local Playwright probe, 2026-11-15 (both `dist/mermaid.min.js` from `spike/node_modules` and `spike/ssg/docusaurus/node_modules`) | `annotateFlowchart` / `annotateSequence` should work on host 11 unchanged. This was checked on the toy only. |
| `@docusaurus/theme-mermaid` 3.10.2 depends on `mermaid >=11.6.0` and loads it with `await import('mermaid')` (memoized `loadMermaid`), with no global. It exports `useMermaidConfig` / `useMermaidRenderResult` from `./client`. | `spike/ssg/docusaurus/node_modules/@docusaurus/theme-mermaid/package.json`, `lib/client/loadMermaid.js`, `lib/client/index.d.ts` | A theme that declares `mermaid` as a peer dependency and calls `import('mermaid')` resolves to the site's hoisted copy, so the host instance can be reused. That instance carries the host's `initialize` config (theme, dark mode). |
| Docusaurus: "themes are loaded just like plugins"; the module's **default export** is the constructor; the docs examples use `export default`. | [Plugin method references (3.10.2)](https://docusaurus.io/docs/api/plugin-methods) | An ESM theme module is supported. The adapter overrides `@theme-init/Mermaid` through `getThemePath`, so it must be listed under `themes`, after `@docusaurus/theme-mermaid`. |
| Material loads Mermaid only when `typeof mermaid === "undefined" \|\| mermaid instanceof Element`, falling back to `unpkg.com/mermaid@11`. Otherwise it uses the global. | [Material source `components/content/mermaid/index.ts`](https://github.com/squidfunk/mkdocs-material/blob/master/src/templates/assets/javascripts/components/content/mermaid/index.ts) | With the docdive adapter, Material never mounts (`docs/ssg-findings.md`), so the only host Mermaid on an MkDocs page is a user-supplied global. The element's global check must reject `Element` (a DOM node with `id="mermaid"` creates `window.mermaid`). |
| MkDocs plugins are a `mkdocs.plugins.BasePlugin` subclass plus an entry point in the `mkdocs.plugins` group. MkDocs 1.4+ supports a typed `Config` schema. | [MkDocs plugin dev guide](https://www.mkdocs.org/dev-guide/plugins/) | The spike's `hooks.py` events (`on_pre_build`, `on_files`, `on_page_content`, `on_post_build`) map 1:1 to plugin methods. |
| MkDocs 2.0 (pre-release, 2.0.dev6 on 2026-09-15) **has no plugin system** and is incompatible with Material. MkDocs 1.6.1 (2024-08-30) is the latest 1.x, and 1.x is described as unmaintained. | [Material blog: what MkDocs 2.0 means](https://squidfunk.github.io/mkdocs-material/blog/2026/02/18/mkdocs-2.0/); PyPI `mkdocs` release list | Pin `mkdocs>=1.6,<2`. The plugin has a shelf-life risk, which is out of scope for 0.1.0. |
| Python 3.10 reached EOL on 2026-10-01; 3.11 runs to 2027-10-31. | [endoflife.date Python API](https://endoflife.date/api/python.json) | The Think floor "Python ≥ 3.10" targets an EOL runtime. |
| `npm publish --workspace=<name>` publishes one workspace. Files are controlled by `files`; `npm pack --dry-run` shows the contents. | [npm-publish v11](https://docs.npmjs.com/cli/v11/commands/npm-publish) | Supports per-package manual publish from the monorepo root. |
| All npm publishes now require **2FA**, or a granular token with bypass-2FA. Trusted publishing is recommended for CI. | [npm: requiring 2FA for publishing](https://docs.npmjs.com/requiring-2fa-for-package-publishing-and-settings-modification) | A manual publish needs an npm account with 2FA enabled and an interactive OTP. |
| PyPI supports API tokens and OIDC trusted publishing. | [PyPI trusted publishers](https://docs.pypi.org/trusted-publishers/) | A manual `uv publish` with a project or account token is enough for 0.1.0. Trusted publishing is a later step. |
| `node:util` `parseArgs` is available in the local Node runtime. | Local check (`typeof parseArgs === "function"`, Node 26.13.0) | Lets the CLI harden its flags with no new dependency. |

## Options considered
| Option | Fit | Maintenance / risk | Decision |
| --- | --- | --- | --- |
| **Element resolves Mermaid in this order: injected instance → valid `window.mermaid` → lazy `import()` of bundled 12.x.** `mermaid` is an optional `peerDependency` (`>=11.6 <13`) of `docdive-element`. The Docusaurus theme injects `(await import('mermaid')).default`. | Meets "Mermaid 11 + 12, reuse host, bundled fallback". Ids are identical on 11 and 12 (probe). | Sharing the host instance shares global `initialize` config, so the element must not call `initialize`, or must restore the host config. Layout differs between host 11 (dagre) and bundled 12 (ELK). | **ADOPT** |
| Always use the bundled 12.x (spike behaviour). | Simplest; the behaviour is already tested. | Two Mermaid copies per page (+3.4 MB on Docusaurus per `docs/ssg-findings.md`); contradicts the Think decision. | **FALLBACK**: also the agreed per-page fallback if host 11 breaks. |
| Load Mermaid from a CDN. | Small bundle. | Needs the network at view time; rejected in Think. | REJECT |
| `useMermaidRenderResult` from `@docusaurus/theme-mermaid/client` (the host renders the SVG, the element only annotates). | Reuses the host fully, including dark-mode config. | Moves rendering into React, so the element no longer renders for itself, and the MkDocs path differs. Larger refactor. | REJECT for 0.1.0 |
| CLI parsing with `node:util` `parseArgs`. | No dependency; covers flags, `--help` and `--version`. | No subcommand help generation, so `USAGE` text is written by hand (already the case). | **ADOPT** |
| CLI framework (commander, yargs, citty). | Nicer help output. | New runtime dependency for 6 commands. | REJECT |
| Docusaurus adapter as an ESM **theme**, registered under `themes`, published as `docusaurus-plugin-docdive` (name from Think). | Mechanism unchanged from the spike; a name is only a convention. | Docusaurus shorthand (`themes: ['docdive']`) resolves to `docusaurus-theme-docdive` (free on npm), so users must write the full package name. | **ADOPT**, with the rename to `docusaurus-theme-docdive` left for cor-plan to confirm. |
| MkDocs: `BasePlugin` + entry point, `mkdocs>=1.6,<2`, `requires-python >=3.11`, built with uv/hatchling. | Matches the official guide; ports `hooks.py` directly. | MkDocs 2.0 drops plugins; Zensical compatibility is unverified. | **ADOPT** |
| MkDocs plugin keeps `hooks.py` (users copy the file). | Zero packaging. | Cannot be published to PyPI; fails the acceptance criteria. | REJECT |
| Manual publish (npm 2FA OTP, `uv publish` with a token). | Matches Think. | Human step; npm and PyPI accounts must exist. | **ADOPT** |
| npm and PyPI trusted publishing from Actions. | Provenance, no tokens. | Release automation is out of scope. | REJECT for 0.1.0 |

## Plan inputs
- **Components or files likely affected:**
  - `spike/src/*.ts` moves to `packages/docdive/src`.
  - `spike/viewer/element.ts` and `spike/viewer/shared.ts` move to `packages/docdive-element/src`.
  - `spike/viewer/main.ts`, `index.html` and `viewer.css` become an unpublished demo workspace, e.g. `apps/viewer`.
  - `spike/ssg/docusaurus/dyd-theme/*` moves to `packages/docusaurus-plugin-docdive`.
  - `spike/ssg/mkdocs/hooks.py` moves to `packages/mkdocs-docdive/src/mkdocs_docdive/plugin.py` with a `pyproject.toml`.
  - `spike/skill/conventions.md` moves into the `docdive` package (`files`).
  - `spike/toy` becomes the shared e2e fixture. `spike/ssg/*` sites become example and e2e sites that consume the workspace packages.
  - `spike/e2e`, `playwright*.config.ts`, `vitest.config.ts`, `eslint.config.js` and `tsconfig.json` move to the repo root.
  - Update `.cor/config.md` checks. Update `ruff.toml` (it currently excludes `spike/corpus`).
- **Version-specific APIs or migration steps:**
  - `engines.node: ">=22.12"` on every npm package. Python `requires-python = ">=3.11"`. mkdocs `>=1.6,<2`. `docdive-element` peer `mermaid >=11.6 <13` (optional). The Docusaurus theme peers are `@docusaurus/core ^3.10` and `@docusaurus/theme-mermaid ^3.10`.
  - Element: replace the static `import mermaid` with a resolver. Validate `window.mermaid` as `typeof m?.render === "function"` and `!(m instanceof Element)`. Keep `splitting: true` so the bundled fallback stays a lazy chunk.
  - Docusaurus: a `getClientModules` client injects the host instance into the element, e.g. a static setter on the element class or a `window` handoff before upgrade. Keep the `@theme-init/Mermaid` fallback.
  - CLI: compile with `tsc` to `dist/` (ESM, shebang on the bin entry). `bin: { docdive, ddv }` point to the same file. Exit codes: `0` ok, `1` lint errors / domain failure, `2` usage error. Diagnostics go to stderr; `--json` payloads go to stdout only.
  - `index --out <dir>` stops writing into the docs folder. Remove the `toy` default from `context`.
- **Adapter data flow:** both adapters need `index.json`, `contexts.json`, the doc → URL map and the element asset directory in `<site>/docdive/`.
  - Docusaurus can resolve the element directory with `import.meta.resolve('docdive-element/…')`.
  - The Python plugin cannot resolve npm packages, so the CLI should expose the asset location or copy it. The recommended form is a CLI subcommand or flag that writes everything into `--out`; see Unresolved.
- **New dependency and version policy, if any:**
  - No new runtime dependencies.
  - `gray-matter` moves from `devDependencies` to `dependencies` of `docdive`. `mermaid` becomes a `dependency` of `docdive-element` for the bundled build and an optional peer for the host instance. The plan must choose between bundling Mermaid into `dist` (so it is not a runtime dependency) and declaring it.
  - Pin exact versions for the Docusaurus example site (3.10.2) and Material (9.8.1), as in the spike.
- **Risks and mitigations:**
  1. **Shared `initialize` state.** Calling `mermaid.initialize` on the host instance overrides Docusaurus dark-mode and theme config. Mitigation: the element never calls `initialize` on an injected instance, and calls it only on its own bundled one.
  2. **Visual layout drift.** Host 11 uses dagre and the bundled 12 uses ELK. Ids are stable but positions change. Mitigation: accept it and document it; the e2e checks ids and classes, not geometry.
  3. **Host-11 breakage on untested diagram shapes** (only the toy was probed). Mitigation: the agreed per-page fallback to the bundled 12.x, recorded in a findings note.
  4. **MkDocs 2.0 drops plugins.** Mitigation: the `<2` pin and a README note.
  5. **npm may reject `docdive` as too similar to an existing name.** Mitigation: run `npm publish --dry-run` before release and keep a scoped fallback (`@thibaudnavarre/docdive`).
  6. **npm 2FA.** The account needs 2FA before the first publish.
  7. **The 1.1 GB corpus could be committed by accident.** Mitigation: write `.gitignore` before `git add`, and check that the size of the staged tree is under ~10 MB.
  8. **Rename blast radius.** `data-dyd-*` selectors in all three e2e suites have to be renamed in lockstep. Mitigation: rename in one task and re-run all suites.
  9. **The work email could leak into commits.** Mitigation: repo-local `user.email` must be set before the first commit.
- **Validation and test implications:**
  - The existing suites stay the gate (vitest 47, viewer 10, A7 13, trace-context 18) after the rename.
  - Add one e2e run with the element on **host Mermaid 11.17.2** in Docusaurus (injected instance), so the 11.x path is exercised and not just probed.
  - Pack-and-install test: `npm pack` for each workspace and `uv build`, then install the tarballs into the two example sites outside the workspace (no symlinks).
  - CLI tests: exit code 2 on bad usage, a usage message on stderr, `--version` matching `package.json`, and `--out` leaving the docs folder untouched.
  - CI: Node 22 and 24 matrix (optional), `npx playwright install --with-deps chromium`, uv for MkDocs, network allowed.
- **Decisions cor-plan must preserve:**
  - Every Think decision listed under Project evidence.
  - No static Mermaid import in the element.
  - Adapters stay data-only (brief constraint 6).
  - No CLI framework.
  - No changes to the `index.json` shape beyond adding a schema version (hardening item not selected in Think; only add it if Plan reopens the item).
  - The MkDocs plugin pins `<2`.

## Unresolved questions
- **Think amendments to confirm in cor-plan:** Node floor 20 → **22.12**, and Python floor 3.10 → **3.11**. Both 20 and 3.10 are EOL as of today.
- **Docusaurus package name:** keep `docusaurus-plugin-docdive` (Think) or switch to `docusaurus-theme-docdive` (matches the Docusaurus shorthand, since it is a theme)?
- **How the MkDocs plugin gets the CLI and element assets.**
  - Option (a), recommended: the plugin runs `npx --yes docdive@<same version>`, and a CLI command writes `index.json`, `contexts.json` and the element assets into `--out`. This adds CLI surface beyond the three hardening items.
  - Option (b): vendor the element `dist` (about 11 MB) inside the wheel and require `docdive` on `PATH`.
  - Either way, MkDocs users need Node at build time, which the brief already assumes (TypeScript core plus Python shim).
- **Host Mermaid 11 reuse on Docusaurus:** proven at the SVG-id level on the toy only. The first e2e run against the injected 11.17.2 instance may still surface config or `initialize` interactions.

## Sources
- [Node.js releases](https://nodejs.org/en/about/previous-releases), accessed 2026-11-15
- [mermaid@12.0.0 release notes](https://github.com/mermaid-js/mermaid/releases/tag/mermaid%4012.0.0), accessed 2026-11-15
- [Material for MkDocs: Diagrams](https://squidfunk.github.io/mkdocs-material/reference/diagrams/), accessed 2026-11-15
- [Material for MkDocs Mermaid loader source](https://github.com/squidfunk/mkdocs-material/blob/master/src/templates/assets/javascripts/components/content/mermaid/index.ts), accessed 2026-11-15
- [Material blog: What MkDocs 2.0 means for your documentation projects](https://squidfunk.github.io/mkdocs-material/blog/2026/02/18/mkdocs-2.0/), accessed 2026-11-15
- [MkDocs plugin developer guide](https://www.mkdocs.org/dev-guide/plugins/), accessed 2026-11-15
- [Docusaurus plugin method references 3.10.2](https://docusaurus.io/docs/api/plugin-methods), accessed 2026-11-15
- [Docusaurus swizzling (wrapping)](https://docusaurus.io/docs/swizzling#wrapping), accessed 2026-11-15
- [npm-publish (npm v11)](https://docs.npmjs.com/cli/v11/commands/npm-publish), accessed 2026-11-15
- [npm: requiring 2FA for package publishing](https://docs.npmjs.com/requiring-2fa-for-package-publishing-and-settings-modification), accessed 2026-11-15
- [PyPI trusted publishers](https://docs.pypi.org/trusted-publishers/), accessed 2026-11-15
- [endoflife.date Python API](https://endoflife.date/api/python.json), accessed 2026-11-15
- npm registry metadata (`npm view`) for mermaid, @docusaurus/*, esbuild, gray-matter, tsx; PyPI JSON for mkdocs and mkdocs-material, accessed 2026-11-15
- Local evidence: `spike/` sources, `spike/ssg/docusaurus/node_modules/@docusaurus/theme-mermaid`, Playwright probe of Mermaid 11.17.2 vs 12.3.0 SVG ids (2026-11-15)
