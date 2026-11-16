# COR Plan — Click-to-source

## Context

Add click-to-source to `<docdive-diagram>`: a "Source" link in the info panel opens the repo web page (`/blob/…#L<n>`) at the Markdown line where the clicked node is declared in the current fence. This is the last element feature still missing from product brief §10 item 5 (deferred from plan 18).

### Current state

- The index knows fence start lines only: `diagramLines` in `packages/docdive/src/model.ts:115,190` (used for prose). `Diagram` (`model.ts:29`) has `nodes`, `edges`, `labels`, no lines.
- `block.startLine` already skips fence frontmatter (`packages/docdive/src/loader.ts:44-72`).
- Extractors strip multi-line `%%{…}%%` (`flowchart.ts:45`, `sequence.ts:26`), and `sequence.ts:26` also strips `accDescr {…}`. Both shift line numbers unless the newlines are kept.
- Adapters write `docdive-map.json` as doc (relative to the docs dir) → permalink string: Docusaurus `packages/docusaurus-theme-docdive/src/index.cjs:21-67`, MkDocs `packages/mkdocs-docdive/src/mkdocs_docdive/plugin.py:45,65`.
- The element loads the map at `packages/docdive-element/src/element.ts:177-185`. It finds the page doc with `Object.entries(this.map)`, which treats every value as a URL (`element.ts:239`), and reads child URLs at `element.ts:397`. The panel buttons Copy context and Copy link are at `element.ts:334,351`.
- No example site configures an edit URL today.

### Decisions locked in Think

| Subject | Decision | Why |
| --- | --- | --- |
| Target line | Line in the current fence where the clicked node is first declared with its label (flowchart shape/subgraph, `participant`/`actor`); else its first mention | "Markdown line defining the element" (brief §6); multi-fence pages need a per-fence line |
| Destination | Repo web URL `/blob/<ref>/<path>#L<n>` | Readers of static sites have no local checkout |
| URL source | Derived from SSG edit config: Docusaurus per-doc `doc.editUrl` (from `allContentLoaded`), MkDocs `page.edit_url` | The SSG already resolves function/relative edit configs |
| Rewrite | GitHub `/edit/` → `/blob/`; GitLab `/-/edit/` → `/-/blob/`; any other host → no link | Edit URLs ignore `#L`; guessing other hosts risks broken links |
| Override | Adapter option `sourceUrl` (Docusaurus) / `source_url` (MkDocs); template with `{path}` (doc path relative to the docs dir) and `{line}`; wins over derivation | Covers other hosts and custom layouts |
| No URL | Hide the Source link | No dead or misleading UI |
| Trigger | "Source" link in the info panel, next to Copy context / Copy link, opens in a new tab | Same place as the other panel actions |
| Map format | Keep doc → permalink strings; add top-level `sources` (doc → raw edit URL) and `sourceUrl` (template string) | Backward-compatible for custom `map-url` users |
| Where rewrite lives | In the element (`shared.ts`), not the adapters | One TS implementation with unit tests instead of TS + Python copies |
| Dev mode | Same behavior under `docusaurus start`, `mkdocs serve`, `docdive watch` | Lines refresh with the existing re-index |

### Scope

**In scope:** per-node lines in the extractors and the index; `sourceHref` helper; element panel link; both adapters (option + `sources`); example-site edit config; e2e on both examples; adapter READMEs; product brief §6 / §10 item 5 status lines.
**Out of scope:** local editor URIs (`vscode://`); modifier-click on nodes; the dev viewer (`apps/viewer`); element doc / front matter as a target; hosts other than GitHub/GitLab without `sourceUrl`; CHANGELOG entry; fixing the `spike/` paths in `.claude/rules/dyd-element.md`; any release.

### Invariants

- `docdive-map.json` doc → permalink string entries keep their shape and meaning.
- Existing extractor outputs (`nodes`, `labels`, `edges`, `participants`, `steps`) do not change.
- Multi-fence pages: each element uses its own diagram's lines (diagram id `doc#index`).
- Without any edit config or `sourceUrl`, the element behaves exactly as today (no link).

### Acceptance criteria

- Indexer unit tests cover node lines: label declaration vs first mention, sequence `participant`, an init directive before nodes, and the fence frontmatter offset.
- `sourceHref` unit tests cover GitHub, GitLab, other host → null, template override, and no input → null.
- Playwright e2e on the Docusaurus and MkDocs example builds: selecting a node shows a Source link whose href is the expected `/blob/…#L<n>`.
- Checks pass: `npm run typecheck`, `npm run lint`, `npm test`, `uvx ruff check . --fix`.

## Tasks

- [x] T01: Extractors (`flowchart.ts`, `sequence.ts`) record each node's 1-based line within the fence source: first label declaration (shape, subgraph, `participant`/`actor`), else first mention; strip `%%{…}%%` / `accDescr {…}` while keeping line count
- [x] T02: Indexer adds `lines: Record<node, absoluteMarkdownLine>` to each `Diagram` in index.json (`block.startLine` + fence-relative line − 1)
- [x] T03: Unit tests for node lines: label vs first mention, sequence declaration, init directive, fence frontmatter offset [unit]
- [x] T04: `shared.ts` `sourceHref(editUrl, template, docPath, line)`: template wins; GitHub `/edit/` → `/blob/`; GitLab `/-/edit/` → `/-/blob/`; else null; append `#L<line>`
- [x] T05: Unit tests for `sourceHref` [unit]
- [x] T06: Element: `DocMap` type gains `sources` / `sourceUrl`; page-doc lookup (`element.ts:239`) skips non-string values; panel "Source" link (`target=_blank`, `rel=noopener`) next to Copy context / Copy link, hidden when href is null
- [x] T07: Docusaurus theme: `sourceUrl` option; fill `sources` from `doc.editUrl` and write `sources` + `sourceUrl` into the build and dev maps
- [x] T08: MkDocs plugin: `source_url` option; collect `page.edit_url` per page; write `sources` + `sourceUrl` into the map in `on_post_build`
- [x] T09: Example sites: Docusaurus `editUrl`, MkDocs `repo_url` / `edit_uri`
- [x] T10: Playwright e2e on both example builds: select a node, assert the Source link href [integration]
- [x] T11: Docs: adapter READMEs (new option + behavior) and product brief §6 / §10 item 5 status lines
