# COR Plan — A7 spike: `<dyd-diagram>` in Docusaurus and MkDocs Material

## Context

Answer brief §8 **A7**: can a framework-agnostic web component + `index.json` find its diagram source and index in the built output of Docusaurus and MkDocs Material (paths, base URL, interplay with each SSG's native Mermaid), and still deliver render + ID mapping, deep dive and info panel on the 4-doc toy? Throwaway spike quality, in `spike/`. Evidence: `.cor/research_a7_ssg_embed.md`.

### Current state

- `spike/viewer/main.ts` is a page-level app, not a component:
  - `:23` hardcodes `fetch("/toy/index.json")`
  - `:68-75` `mermaidSource()` fetches the raw `.md` and slices the n-th fence (raw `.md` is not served by an SSG)
  - `:124-132` `render()` calls `mermaid.render` itself (reusable core)
  - `:171` deep-dive state lives in `location.search`
- `flowchartNodeId()` (`:78-80`) matches `/flowchart-(.+)-\d+$/`, so it does not depend on the render-id prefix.
- Docusaurus 3.10.2 `@theme/Mermaid` renders nothing in SSR, then injects only the SVG; it re-renders on color-mode change. The source exists only as the `value` prop.
- Material 9.8.1 mounts `pre.mermaid` at `DOMContentLoaded`, renders into a **closed** shadow root and replaces the `pre`. It loads `mermaid@11` from unpkg if no global `mermaid` exists.
- Toy frontmatter uses `id:`, which Docusaurus also reads as its doc id. It gives doc id `architecture/OrderService` and permalink `/docs/architecture/OrderService`, with no duplicates across folders. An id containing `/` throws.

### Decisions locked in Think

| Subject | Decision | Why |
| --- | --- | --- |
| Question | Can the component find diagram + `index.json` in each SSG's built output | The riskiest part of A7; tag loading alone is trivial |
| Component | Minimal `<dyd-diagram>` wrapper around the existing viewer logic, enough to embed | Packaging is out of scope |
| Features gated | Render + ID mapping, deep dive, info panel | Scenario trace deliberately excluded |
| Content | Existing 4-doc toy in both SSGs, docs dir pointed at `spike/toy` (no copy) | Same corpus as the viewer spike |
| Source | From the page's own fenced block | Keeps the toy pure Mermaid; no source duplication in the index |
| Native Mermaid | Left on; the component takes over | Removing the adapter must fall back to native rendering (deletability, constraint 3) |
| Deep dive | Navigate to the child doc's SSG page | SSG owns routing |
| Identity | Injected page→doc map; `n` = block order on the page | Matches `index.json` `doc#n` ids |
| URL mapping | Adapter emits a plain doc→URL map from SSG route data; component consumes it | Data, not logic (constraint 6) |
| `dyd index` | Run inside each SSG's build hook | Thin plugin shape of brief §6.1 |
| Docusaurus adapter | Local **theme** listed **after** `@docusaurus/theme-mermaid`, wrapping `@theme-init/Mermaid` | A plain plugin sits below themes, so `@theme-init` would self-import (research) |
| MkDocs adapter | `hooks.py` wraps each `pre.mermaid` in a bare `<dyd-diagram>` at build time; element loaded as a module script | Module scripts upgrade before Material's `DOMContentLoaded` mount; the closed shadow root makes later access impossible (research) |
| Rendering | Element renders into its own **open** shadow root; source passed as attribute/property | Avoids React hydration mismatches; Playwright locators pierce open shadow roots |
| `id:` collision | Accepted; route map absorbs URL changes; recorded as a finding; gated as "no build error/duplicate id" | Conventions stay unchanged for the spike |
| Versions | Docusaurus 3.10.2 (isolated `package.json`), `mkdocs-material==9.8.1` via `uv`; Python shells out to the Node CLI | Latest stable; keeps the dyd core free of SSG deps |
| Base URL | Non-root base in both (Docusaurus `baseUrl: '/dyd/'`, MkDocs subpath `site_url`) | Surfaces path bugs |
| Gate | Pre-registered Playwright checklist on both built sites; pass = all items on **both** SSGs + owner walkthrough yes; on fail: record, lower A7 confidence, apply the brief's "If wrong"; no re-gate | Same discipline as A1/A4/viewer spike |

### Scope

**In scope:** `<dyd-diagram>` extraction + bundle, Docusaurus site + theme + build hook, MkDocs site + `hooks.py`, Playwright spec, `docs/ssg-findings.md`, brief updates.
**Out of scope:** scenario trace in SSGs, packaged/published `<dyd-diagram>`, bundle-size work, live reload / `dyd watch`, Material `navigation.instant` (off; recorded only), Zensical, other SSGs, click-to-context/source, A5, A6, MCP.

### Invariants

- Toy docs stay pure Mermaid + YAML frontmatter and render on GitHub.
- The standalone viewer and `spike/e2e/viewer.pw.ts` keep passing.
- Existing CLI commands and tests keep passing (`.cor/config.md` checks).
- `index.json` may be extended, never broken.
- Pre-registration is not edited after the verification run (dated amendments only, before the run).

### Acceptance criteria

- Pre-registered checklist committed in `docs/ssg-findings.md` before the verification run. Items per SSG:
  - render + ID mapping
  - deep dive lands on the child page with its diagram mapped
  - info panel for a documented and an undocumented element
  - adapter-removed build renders every toy diagram as plain Mermaid with no error
  - Docusaurus only: no build error/duplicate id from `id:`
- The Playwright spec implements the checklist one-to-one against static builds under a non-root base URL.
- Verdict = pass iff all items pass on both SSGs **and** the owner answers yes.
- Findings recorded regardless: `id` collision, no `/` in Docusaurus ids, two Mermaid copies, unpkg network need, MkDocs/Material maintenance horizon (2027-05-05).
- Brief §8 A7, §9, §10 updated; config checks green.

## Tasks

- [x] T01: Write the pre-registration in `docs/ssg-findings.md`: frozen checklist per SSG, pass rule, on-fail rule, "recorded, not gated" items
- [x] T02: Extract a `<dyd-diagram>` custom element from the viewer: open shadow root, source passed in, configurable `index.json` + doc→URL map URLs, deep dive navigates to the child doc's page. The standalone viewer keeps working
- [x] T03: Add an element bundle entry to the esbuild build (`spike/scripts/build-viewer.mjs`)
- [x] T04: Scaffold the Docusaurus 3.10.2 site in `spike/ssg/docusaurus`: isolated `package.json`, `@docusaurus/theme-mermaid`, `markdown.mermaid: true`, `baseUrl: '/dyd/'`, docs path pointing at `spike/toy`
- [x] T05: Docusaurus dyd theme: `theme/Mermaid` renders `<dyd-diagram>` from `value` with `@theme-init/Mermaid` fallback, listed after `theme-mermaid`; client module registers the element
- [x] T06: Docusaurus build hook: run `dyd index`, emit the doc→permalink map from `allContentLoaded` (docs `source`/`permalink`), write `index.json` + map to `outDir`
- [x] T07: Scaffold the MkDocs Material 9.8.1 site in `spike/ssg/mkdocs`: `uv`, `pymdownx.superfences` mermaid fence, subpath `site_url`, `docs_dir` pointing at `spike/toy`
- [x] T08: MkDocs `hooks.py`:
  - `on_pre_build` runs the Node CLI index
  - `on_page_content` wraps each `pre.mermaid` in `<dyd-diagram>`
  - `on_post_build` writes `index.json` + the `src_uri → url` map to `site_dir`
  - the element is added to `extra_javascript` as a module
- [x] T09: Playwright spec implementing the checklist one-to-one on both built sites and both adapter-removed builds [integration]
- [x] T10: Run the verification once; record results and findings in `docs/ssg-findings.md` (`id` collision, no `/` ids, two Mermaid copies, unpkg network, MkDocs/Material maintenance); config checks stay green
- [x] T11: Owner walkthrough of both sites: "does the toy feel the same inside Docusaurus and MkDocs as in the standalone viewer?" yes/no [UAT]
- [x] T12: Update brief §8 A7 row, §9, §10 status
