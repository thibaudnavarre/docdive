# COR Research — A7: `<dyd-diagram>` inside Docusaurus and MkDocs Material

## Decision summary
- Recommended approach: one framework-agnostic `<dyd-diagram>` custom element (viewer logic + its own bundled Mermaid 12.3, renders into its **own open shadow root**) that receives the Mermaid source of the page's fenced block through a thin, logic-free adapter per SSG:
  - **Docusaurus 3.10.2**: a local *theme* listed **after** `@docusaurus/theme-mermaid` in `themes`, shadowing `@theme/Mermaid`. It renders `<dyd-diagram>` with the `value` prop as source, and falls back to `@theme-init/Mermaid` when dyd is absent. `allContentLoaded` emits the doc→permalink map from the docs plugin's `source`/`permalink`, `getClientModules` registers the element, and a build hook runs `dyd index` and writes `index.json` + map into the output.
  - **MkDocs 1.6.1 + Material 9.8.1**: a local hooks file (`hooks:`) or plugin. `on_pre_build` shells out to the Node CLI. `on_page_content` wraps each `<pre class="mermaid">` in a bare `<dyd-diagram>` tag. `on_post_build` writes `index.json` + the `src_uri → url` map to `site_dir`. The element ships as a `type: module` entry in `extra_javascript`. On upgrade it reads the child `pre` text and replaces it before Material mounts.
- Why it fits this project:
  - Matches every Think decision: source taken from the page's fence, native Mermaid left on, deep dive by navigating to the child page, page→doc map injected with `n` = block order, `dyd index` run by the build hook, the plugin emits data only (constraint 6).
  - Removing the adapter falls back to native rendering, which is exactly the deletability check.
- Confidence: MEDIUM. The mechanisms below are confirmed from source. Still unproven until the spike runs: React hydration around a custom element, and the module-script-before-`DOMContentLoaded` ordering in a real Material build.

## Project evidence
- Goal inherited from Think: pre-registered A7 spike. Test whether the component can find its diagram source and `index.json` in each SSG's built output (paths, base URL, interplay with native Mermaid) and still deliver render + ID mapping, deep dive and the info panel on the 4-doc toy in both SSGs.
- Scope boundaries: minimal `<dyd-diagram>` wrapper around the existing viewer logic. Scenario trace, packaging, live reload, MCP and A5 are out of scope.
- Acceptance criteria: Playwright checklist on both built sites. Pass = all items pass on both SSGs **and** the owner walkthrough answers yes. Items:
  - render + ID mapping, deep dive, info panel
  - deletability: rebuilt without the adapter, every toy diagram renders as plain Mermaid with no error
  - Docusaurus builds with no error or duplicate-id problem caused by the toy's `id:` frontmatter
- Resolved versions:
  - repo: `mermaid` 12.3.0, Node v26.13.0, esbuild ^0.28, Playwright ^1.65 (`spike/package.json`)
  - Docusaurus (npm, 2026-11-15): `@docusaurus/core`/`theme-mermaid` 3.10.2, engines `node >=20`; theme-mermaid depends on `mermaid >=11.6.0`
  - PyPI (2026-11-15): `mkdocs-material` 9.8.1 (2026-11-07, `mkdocs<2,>=1.6`, Python ≥3.11), `mkdocs` 1.6.1 (2024-08-30), `zensical` 0.1.1
  - `uv`/`uvx` and `python3` are available
- Existing usages and primitives:
  - `spike/viewer/main.ts:23`: hardcoded `fetch("/toy/index.json")`; must become configurable/base-URL aware
  - `spike/viewer/main.ts:68-75`: `mermaidSource()` fetches the raw `.md` and slices the n-th fence; must be replaced by the source passed in from the page
  - `spike/viewer/main.ts:78-80`: `flowchartNodeId()` regex `/flowchart-(.+)-\d+$/` is independent of the render-id prefix, so it survives a different render id
  - `spike/viewer/main.ts:124-132`: `render()` calls `mermaid.render` itself, which is the reusable core
  - `spike/viewer/main.ts:171`: deep-dive state lives in `location.search`; in the SSG it becomes navigation to the child page's URL
  - `spike/scripts/build-viewer.mjs`: esbuild ESM + splitting, reusable for the element bundle
  - toy frontmatter: `id: OrderService`, `parent:`, `src:`, `kind: scenario` (`spike/toy/**/*.md`)
- Constraints inherited from Think: hard constraint 3 (deletable, plain Mermaid still renders), 6 (no product logic in SSG adapters), 7; toy stays pure Mermaid + frontmatter; existing CLI commands and tests keep passing; `index.json` may be extended, never broken; checks per `.cor/config.md`.

## Findings
| Claim | Evidence | Applicability |
| --- | --- | --- |
| Docusaurus turns ` ```mermaid ` fences into an MDX element `mermaid` whose `value` is the raw source | `@docusaurus/mdx-loader@3.10.2` `lib/remark/mermaid/index.js` (package source) | The source is available as a React prop, which is the hook point for the adapter |
| Docusaurus `@theme/Mermaid` renders **nothing** during SSR/before effect, then injects only the SVG via `dangerouslySetInnerHTML`; ids are `mermaid-svg-<random>`; it re-renders on color-mode change | `@docusaurus/theme-mermaid@3.10.2` `lib/theme/Mermaid/index.js`, `lib/client/index.js` (package source) | The built HTML holds no source text. Enhancing the native SVG would be wiped on re-render, so the adapter must wrap the component, not post-process the DOM |
| Theme components stack in the order `preset plugins > preset themes > plugins > themes > site`. `@theme-init/X` points to the bottom provider; a theme package can wrap another theme's component with it | [Docusaurus client architecture](https://docusaurus.io/docs/advanced/client) | The dyd adapter must be a **theme** listed after `theme-mermaid`. As a plain plugin it would sit below theme-mermaid and `@theme-init/Mermaid` would resolve to itself |
| Plugins get `allContentLoaded({allContent, actions})`, `postBuild({outDir, baseUrl, routesPaths…})`, `injectHtmlTags`, `getClientModules` | [Lifecycle APIs](https://docusaurus.io/docs/api/plugin-methods/lifecycle-apis); `@docusaurus/types@3.10.2` `src/plugin.d.ts:133` | `allContentLoaded` reads the docs content; `postBuild` writes `index.json` + map to `outDir` with `baseUrl` known |
| Docs metadata has `source` (`@site/...`) and `permalink`. Doc id = `frontMatter.id ?? filename`, prefixed by its directory; an id containing `/` **throws** | `@docusaurus/plugin-content-docs@3.10.2` `lib/docs.js:61-63,93,132-135` | Toy `id: OrderService` gives doc id `architecture/OrderService` and permalink `/docs/architecture/OrderService`: no duplicate across folders. A future qualified ID like `billing/UserService` would break the Docusaurus build |
| Unknown front matter keys are accepted (`.unknown()`) | `plugin-content-docs@3.10.2` `lib/frontMatter.js:42` | `parent`, `src`, `kind` do not fail validation |
| Material mounts `pre.mermaid` at `DOMContentLoaded` (`document$`), reads `textContent`, renders into a **closed** shadow root and replaces the `pre` | Material `src/templates/assets/javascripts/components/content/{_,mermaid}/index.ts`, `browser/document/index.ts` (master, accessed 2026-11-15) | The SVG is unreachable after Material renders. The element must take the source from the `pre` **before** Material mounts |
| Material loads `mermaid@11` from unpkg unless a global `mermaid` already exists | same `mermaid/index.ts` `fetchScripts()` | The deletability build needs network access (or a route mock) in Playwright. Two Mermaid majors coexist (11 native, 12.3 dyd) |
| In Material's `base.html`, `extra_javascript` comes after `bundle.js`; module scripts run deferred, before `DOMContentLoaded` | Material `src/templates/base.html:438-441`; [HTML spec – scripts](https://html.spec.whatwg.org/multipage/scripting.html#the-script-element) | A `type: module` element bundle defines `<dyd-diagram>` and upgrades the wrapped `pre`s before Material's mount runs |
| MkDocs ≥1.4 `hooks:` loads a local `.py` file as a plugin instance; `File` exposes `src_uri` and `url` (respecting `use_directory_urls`) | [MkDocs config – hooks](https://www.mkdocs.org/user-guide/configuration/#hooks); `mkdocs@1.6.1` `structure/files.py` | The doc→URL map comes straight from `page.file.src_uri → page.url`, with no packaging needed for the spike |
| MkDocs 1.x is unmaintained (no release since 2024-08); MkDocs 2.0 drops plugins and breaks Material; Material gets critical maintenance only through **2027-05-05**; Zensical reads `mkdocs.yml` and `extra_javascript` but supports only a subset of plugins via replacements | [Material: Zensical](https://squidfunk.github.io/mkdocs-material/blog/2025/11/05/zensical/), [Material: MkDocs 2.0](https://squidfunk.github.io/mkdocs-material/blog/2026/02/18/mkdocs-2.0/), [Zensical MkDocs compatibility](https://zensical.org/docs/compatibility/mkdocs/) | The Python target is moving. Keeping the Python side to "run CLI + wrap tag + write JSON" limits the cost of a later move to Zensical. Out of scope for the spike, but record it |
| Playwright CSS/role locators pierce **open** shadow roots by default | [Playwright locators – shadow DOM](https://playwright.dev/docs/locators#locate-in-shadow-dom) | The existing `[data-dyd-*]` selectors keep working if the element renders into an open shadow root |

## Options considered
| Option | Fit | Maintenance / risk | Decision |
| --- | --- | --- | --- |
| Element renders itself from the fence source passed by a thin adapter (Docusaurus theme wrapper; MkDocs tag wrap + module script) | Meets every Think decision. One code path for both SSGs. Deletability is free | Hydration around a custom element; Material ordering. Both are tested by the gate | **ADOPT** |
| MkDocs: no build-time wrapping; the element script scans `pre.mermaid` itself and re-scans on Material's `document$` (instant nav) | Smaller Python side | Couples the element to Material's private `document$`; races with instant navigation | **FALLBACK** (only if `on_page_content` wrapping proves unworkable) |
| Post-process the native SVG (Docusaurus container / Material output) instead of re-rendering | Zero double render | Material's shadow root is **closed**, so impossible; Docusaurus re-renders on color-mode change and wipes annotations | REJECT |
| Indexer embeds the Mermaid source in `index.json`; the element ignores the page | Robust to SSG markup | Contradicts the Think choice (source from the page's fence); doubles payload | REJECT (kept only as an idea if both adapters fail) |
| Disable native Mermaid in both SSGs | Removes races | Contradicts the Think choice; makes deletability need a config change | REJECT |
| Docusaurus adapter as a plain plugin + client module patching the DOM | Simpler registration | Source is not in the DOM; a plugin sits below the themes, so it cannot wrap `@theme/Mermaid` via `@theme-init` | REJECT |

## Plan inputs
- Components or files likely affected:
  - `spike/viewer/main.ts`: extract a `<dyd-diagram>` element (shadow root, `source` input, configurable `index.json` URL + doc→URL map, deep dive = `location.assign(map[childDoc])`); keep the standalone viewer working
  - `spike/scripts/build-viewer.mjs`: add an element bundle entry
  - new `spike/ssg/docusaurus/` (site + local theme `theme/Mermaid` + plugin hooks)
  - new `spike/ssg/mkdocs/` (`mkdocs.yml`, `hooks.py`, toy docs copied or symlinked)
  - new Playwright spec(s) over the two built sites + the two "adapter removed" builds
- Version-specific APIs or migration steps:
  - Docusaurus 3.10.2: `markdown.mermaid: true`, `themes: ['@docusaurus/theme-mermaid', './dyd-theme']` (order matters), `@theme-init/Mermaid` fallback, `allContentLoaded`, `postBuild({outDir, baseUrl})`, `getClientModules`
  - MkDocs 1.6.1: `hooks:`, events `on_pre_build`, `on_page_content(html, page)`, `on_post_build(config)`, `page.file.src_uri`, `page.url`, `extra_javascript: [{path: …, type: module}]`
  - Material 9.8.1 config: `pymdownx.superfences` custom fence `mermaid` → `pre.mermaid`
- New dependency and version policy, if any: spike-only, throwaway site deps
  - Docusaurus: `@docusaurus/core`, `@docusaurus/preset-classic`, `@docusaurus/theme-mermaid` pinned `3.10.2` in an isolated `package.json` under `spike/ssg/docusaurus/`, so they stay out of `spike/package.json`
  - MkDocs: `mkdocs-material==9.8.1` via `uv` (pulls `mkdocs` 1.6.1, `pymdown-extensions`)
  - no new dependency in the dyd core
- Risks and mitigations:
  - **React hydration mismatch** if the element mutates React-owned children. Mitigation: render only into the element's own shadow root and pass the source as an attribute/property, never as mutated light DOM.
  - **Material ordering**: if the element upgrades after Material mounts, the source is gone (closed shadow). Mitigation: wrap at build time and load as a module script; the gate detects double render or a missing source.
  - **Instant navigation** (`navigation.instant`): keep it off for the spike and record it, or include it as an extra recorded check.
  - **Base URL**: serve each build under a non-root base (Docusaurus `baseUrl: '/dyd/'`, MkDocs `site_url` subpath) so path bugs surface.
  - **Network**: the deletability build in Material fetches unpkg `mermaid@11`. Allow network or mock the route in Playwright; record which.
  - **Two Mermaid copies** (11 native + 12.3 dyd in Material; theme-mermaid resolves its own): record bundle size; not gated.
  - **Docusaurus doc id**: no slash allowed. Record as a finding against the open "ID qualification syntax" question.
  - **Platform drift**: record MkDocs/Material end-of-maintenance (2027-05-05) as a finding in `docs/` and the brief's A7 row, not a spike item.
- Validation and test implications:
  - Playwright runs against the static builds (`docusaurus build` + serve; `mkdocs build` + static server) with a non-root base URL.
  - Checklist per SSG: render + ID mapping, deep dive (navigation lands on the child page and its diagram is mapped), info panel (documented and undocumented element, as C4/C5), adapter-removed build renders plain Mermaid with no error, and for Docusaurus no build error/duplicate id.
  - The existing `npm --prefix spike run typecheck|lint|test` and `viewer.pw.ts` must keep passing.
  - Python side: `uvx ruff check .` covers `hooks.py`.
- Decisions cor-plan must preserve:
  - Source comes from the page's fence; native Mermaid stays on; deep dive navigates to the child page; identity = injected page→doc map + block order; `dyd index` runs in the build hook; adapters emit data only.
  - Pass = all items on both SSGs + owner yes.
  - The `id` collision is accepted and recorded.
  - The dyd theme is listed after `theme-mermaid`.
  - The element renders into an open shadow root.

## Unresolved questions
- Does React 19 hydration in Docusaurus 3.10.2 tolerate a custom element host that attaches a shadow root on upgrade? Expected yes (the shadow root is outside React's tree); unverified until the spike runs.
- Does Material's mount run strictly after module-script element upgrades in a real build? Inferred from the HTML spec plus Material source, not observed.
- Does Zensical honour MkDocs `hooks:` files? Not documented on the compatibility page. Out of spike scope; only the `extra_javascript` part is confirmed compatible.

## Sources
- [Docusaurus – Diagrams](https://docusaurus.io/docs/markdown-features/diagrams), accessed 2026-11-15
- [Docusaurus – Lifecycle APIs](https://docusaurus.io/docs/api/plugin-methods/lifecycle-apis), accessed 2026-11-15
- [Docusaurus – Client architecture (theme aliases, client modules)](https://docusaurus.io/docs/advanced/client), accessed 2026-11-15
- npm packages `@docusaurus/theme-mermaid`, `@docusaurus/mdx-loader`, `@docusaurus/plugin-content-docs`, `@docusaurus/types` @ 3.10.2 (package source via `npm pack`), accessed 2026-11-15
- [Material for MkDocs – Diagrams](https://squidfunk.github.io/mkdocs-material/reference/diagrams/), accessed 2026-11-15
- [Material source – mermaid component](https://github.com/squidfunk/mkdocs-material/blob/master/src/templates/assets/javascripts/components/content/mermaid/index.ts), accessed 2026-11-15
- [Material source – base.html](https://github.com/squidfunk/mkdocs-material/blob/master/src/templates/base.html), accessed 2026-11-15
- [Material blog – Zensical](https://squidfunk.github.io/mkdocs-material/blog/2025/11/05/zensical/), accessed 2026-11-15
- [Material blog – What MkDocs 2.0 means](https://squidfunk.github.io/mkdocs-material/blog/2026/02/18/mkdocs-2.0/), accessed 2026-11-15
- [Zensical – MkDocs compatibility](https://zensical.org/docs/compatibility/mkdocs/), accessed 2026-11-15
- [MkDocs – Plugins dev guide](https://www.mkdocs.org/dev-guide/plugins/), [hooks config](https://github.com/mkdocs/mkdocs/blob/1.6.1/docs/user-guide/configuration.md), accessed 2026-11-15
- PyPI JSON for `mkdocs-material`, `mkdocs`, `zensical`, accessed 2026-11-15
- [HTML spec – the script element](https://html.spec.whatwg.org/multipage/scripting.html#the-script-element), accessed 2026-11-15
- [Playwright – Locators, shadow DOM](https://playwright.dev/docs/locators#locate-in-shadow-dom), accessed 2026-11-15
