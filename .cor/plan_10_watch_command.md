# COR Plan — `docdive watch`

## Context

Add `docdive watch <folder> --out <dir> [--src <repoRoot>]` so doc authors iterating locally get `index.json` and
`contexts.json` regenerated on every Markdown change, without re-running `build` by hand. Listed in the v1 brief
(`docs/product-brief.md` §6.1, decision D10 "live update is a file watcher") and deferred in `plan_9_v1_packaging.md`.

### Root cause / current state

- `packages/docdive/src/run.ts`: `execute()` handles `index`, `build`, `init`, `context`, `stats`, `lint`; all one-shot.
  `run()` is synchronous and returns an exit code; `cli.ts` assigns it to `process.exitCode`.
- `build` (in `execute()`) calls `buildModel`, writes `index.json` + `contexts.json` with `writeFileSync` (non-atomic), then
  `cpSync`s the element `dist` (filtering `shared.*`), and prints `summarise(index)` on stderr.
- `packages/docdive/src/loader.ts:30` only loads `*.md` / `*.mdx`, so JSON outputs never feed back into the model.
- Adapters: Docusaurus runs `build` only in `postBuild` (`packages/docusaurus-theme-docdive/src/index.cjs`); MkDocs runs it
  in `on_post_build` (`packages/mkdocs-docdive/src/mkdocs_docdive/plugin.py`). Neither is touched.
- CI runs on `ubuntu-latest` only (`.github/workflows/ci.yml`); development is on macOS.

### Decisions locked in Think

| Subject | Decision | Why |
| --- | --- | --- |
| Surface | Standalone CLI: writes to `--out`; author serves it with any static server / viewer | Keeps adapters data-only; no adapter wiring |
| Outputs | Same as `build`: full build (JSON + assets) once at start, then `index.json` + `contexts.json` per change | One mental model; assets don't change while watching |
| Triggers | Only `.md` / `.mdx` changes under the docs folder; not `src:` files | Matches what the loader reads |
| Live reload | None; reloading is the host's job | Out of scope |
| Dependencies | Node built-ins only (`fs.watch` recursive, Node >= 22.12) | CLI has no framework deps by design (plan_9) |
| Atomic writes | Outputs written to a temp file in `--out` then renamed | A static server must never serve a half-written JSON |
| Broken docs | Keep watching; write outputs with diagnostics, like `build` | Mid-edit states are normal |
| Docs folder removed/renamed | Print error, exit 1 | Nothing left to watch |
| `--out` inside docs | Allowed | `.json` changes never trigger a rebuild |
| Shutdown | Ctrl-C (SIGINT/SIGTERM) exits 0 | Normal termination |
| Output | One stderr line per rebuild: timestamp, changed file, `summarise()` line | Same summary as `build` |
| Platforms | macOS + Linux verified; Windows best-effort | CI is ubuntu |

### Scope

**In scope:** `watch` command, shared atomic output writer, async-capable `run()`, tests, `USAGE` / READMEs / CHANGELOG.
**Out of scope:** adapter changes (Docusaurus `start`, MkDocs `serve`), browser live reload, watching `src:` files,
config file, `--once` flag, a watcher library.

### Invariants

- `build`, `index` and every other command keep their current outputs, exit codes (0 / 1 / 2) and stderr messages.
- Usage errors stay on stderr with `USAGE` and exit 2; no new runtime dependency.
- Docs stay pure Mermaid plus YAML frontmatter.

### Acceptance criteria

- Vitest tests (passing on ubuntu CI, no fixed sleeps): initial build; edit / add / delete an `.md` updates both JSON
  files; non-Markdown change does not rebuild; `--out` inside the docs folder does not loop; removing the folder exits 1.
- `USAGE`, root `README.md`, `packages/docdive/README.md` and `CHANGELOG.md` (Unreleased) document `watch`.
- Checks pass: `npm run typecheck`, `npm run lint`, `npm test`, `uvx ruff check . --fix`.
- Manual run against an example docs folder shows the edit after a page reload.

## Tasks

- [x] T01: Extract the `build` output step into a shared function that writes `index.json` and `contexts.json` atomically (temp file in `--out` + rename) and copies the element assets separately; `build` uses it with unchanged behavior
- [x] T02: Make `run()` return `number | Promise<number>` and await it in `cli.ts`, keeping every existing command synchronous in behavior
- [x] T03: Add `watch <folder> --out <dir> [--src <repoRoot>]` with the same argument validation as `build`: full build at start, recursive `fs.watch` filtered to `.md`/`.mdx`, debounced rebuild of the JSON outputs, one timestamped stderr summary line per rebuild
- [x] T04: Handle `watch` lifecycle: keep watching on docs errors (outputs still written with diagnostics), exit 1 with a stderr error when the docs folder disappears, close the watcher and exit 0 on SIGINT/SIGTERM
- [x] T05: Write `watch` tests in `packages/docdive/src/cli.test.ts`: initial build, edit/add/delete updates, non-Markdown change ignored, `--out` inside docs does not loop, folder removal exits 1; poll for results instead of fixed sleeps [integration]
- [x] T06: Document `watch` in `USAGE`, root `README.md`, `packages/docdive/README.md`, and an Unreleased entry in `CHANGELOG.md`
- [x] T07: Run `docdive watch` on an example docs folder behind a static server, edit a diagram, reload, and confirm the change is reflected [UAT]
