# A7 spike — `<dyd-diagram>` in Docusaurus and MkDocs Material (assumption A7)

Tests assumption **A7** of [product-brief.md](./product-brief.md) §8: a framework-agnostic web component + `index.json` works cleanly inside Docusaurus (React/MDX) and MkDocs (Jinja). This document **pre-registers** the checklist, then records the results. Evidence base: `.cor/research_a7_ssg_embed.md`.

## Pre-registration (2026-11-15)

Written and frozen **before the verification run** (T10). Results are reported against this section, not by editing it. Any later change is a dated entry in *Amendments*, never an in-place edit.

### Question

Can a minimal `<dyd-diagram>` element plus `index.json` find the diagram source and the index in the **built output** of Docusaurus 3.10.2 and MkDocs 1.6.1 + Material 9.8.1 (paths, non-root base URL, interplay with each SSG's native Mermaid), and still deliver render + ID mapping, deep dive and info panel on the 4-doc toy?

### Setup under test

| Subject | Fixed value |
| --- | --- |
| Corpus | The 4-doc toy `spike/toy` (`architecture/system.md`, `architecture/order-service.md`, `architecture/validator.md`, `scenarios/checkout.md`), unchanged and not copied. Docs dir of both SSGs points at it |
| Docusaurus | 3.10.2, `@docusaurus/theme-mermaid`, `markdown.mermaid: true`, `baseUrl: '/dyd/'`; local dyd theme listed **after** `theme-mermaid` |
| MkDocs | `mkdocs` 1.6.1 + `mkdocs-material==9.8.1` via `uv`, `pymdownx.superfences` mermaid fence, `site_url` with subpath `/dyd/`; local `hooks.py` |
| Element | One `<dyd-diagram>` bundle, own Mermaid 12.3, renders into its own **open** shadow root; the Mermaid source is passed by the adapter from the page's fenced block |
| Index | `dyd index` run by each SSG's build hook; `index.json` + a doc→URL map written to the build output |
| Builds | Static builds (`docusaurus build`, `mkdocs build`) served under the `/dyd/` base. Verified in Chromium via Playwright |
| Adapter-removed builds | Same sites rebuilt with the dyd adapter disabled (Docusaurus: theme dropped from `themes`; MkDocs: `hooks` and element script dropped) |

Native Mermaid stays on in both SSGs; the element takes over. The scenario trace is **not** part of this spike.

### Observable contract

Same hooks as the standalone viewer, now inside the element's open shadow root (Playwright CSS locators pierce it). The spec must not rely on anything else.

| Hook | Meaning |
| --- | --- |
| `dyd-diagram` | The element host; one per toy fence on the page |
| `[data-dyd-node="<ID>"]` | The rendered SVG element of element `<ID>` in the diagram |
| `[data-dyd-panel]` with `[data-dyd-field="<name>"]` | Info panel and its fields: `parent`, `children`, `appearsIn`, `scenarios`, `src` |
| `[data-dyd-error]` | Present and non-empty only when the element reports an error |

Deep dive is observed as navigation: the URL after the click, and the `dyd-diagram` found on the destination page.

### Gated checklist

Binary items, evaluated **per SSG** (D = Docusaurus, M = MkDocs). Expected values are taken from `index.json` produced by `dyd index`, not hard-coded guesses. The URL mapping is whatever the SSG produces; the spec reads it from the built site's own doc→URL map and from `index.json`.

| # | Item | Pass when |
| --- | --- | --- |
| S1 | Render + ID mapping | The built `system` page, served under `/dyd/`, contains one `dyd-diagram` whose `index.json` ID is `architecture/system.md#0`. It renders an SVG; every ID in that diagram's `nodes` has exactly one `data-dyd-node` element; no `data-dyd-error`; no uncaught page error |
| S2 | Index and map found under the base URL | The element's requests for `index.json` and the doc→URL map return 200 under `/dyd/…`; no request to a root-relative path outside the base URL fails |
| S3 | Deep dive | On `system`, clicking `OrderService` navigates to the `order-service` page (URL from the map); that page's `dyd-diagram` renders `Controller`, `Validator`, `Repository`. Clicking `Validator` there navigates to the `validator` page, which renders `SchemaCheck`, `StockCheck`. Clicking `API` (no child doc) does not navigate |
| S4 | Info panel, documented element | Selecting `OrderService` on `system` shows `parent` = `system`, `children` = `Controller, Validator, Repository`, `appearsIn` = the `index.json` list, `scenarios` = `checkout-happy-path`, `src` = `src/orders/` |
| S5 | Info panel, undocumented element | Selecting `PaymentGateway` shows `appearsIn` and `scenarios`; no `parent`/`children`/`src` fields rendered; no error |
| S6 | Deletability | The adapter-removed build renders every toy Mermaid fence as plain Mermaid (an `svg` inside the SSG's native Mermaid container, or inside Material's shadow root, per its mechanism); no `dyd-diagram` in the DOM; no uncaught page error. The Material variant may reach unpkg for `mermaid@11` (see *Recorded*) |
| S7 | No `id:` build error (**Docusaurus only**) | `docusaurus build` exits 0, with no duplicate-id or invalid-id error caused by the toy's `id:` frontmatter, and the four toy docs have distinct permalinks |

S1–S6 apply to both SSGs (12 items); S7 to Docusaurus only. Total 13 items.

### Recorded, not gated

Reported as findings, whatever the verdict:

- **`id:` collision.** Toy `id:` is also Docusaurus's doc id. Resulting doc ids and permalinks (research: `architecture/OrderService`, `/docs/architecture/OrderService`), and the route-map workaround. An id containing `/` makes Docusaurus throw.
- **Two Mermaid copies.** Mermaid versions and bundle weight loaded per page in each SSG (native 11.x / theme-mermaid vs dyd 12.3).
- **Network need.** Material loads `mermaid@11` from unpkg when no global `mermaid` exists; the adapter-removed MkDocs build needs network (or a route mock) in tests.
- **Hydration.** Any React hydration warning around the custom element in Docusaurus; any ordering race between the module script and Material's `DOMContentLoaded` mount.
- **MkDocs/Material horizon.** MkDocs 1.x unmaintained since 2024-08, Material critical-fix support only until 2027-05-05, Zensical as the successor path. Not tested here.
- **Adapter size.** Lines of adapter code per SSG, and whether any product logic leaked into them (constraint 6).
- Any mismatch between index IDs and rendered SVG IDs not covered above.

### Qualitative question (owner, T11)

*"Does the toy feel the same inside Docusaurus and MkDocs as in the standalone viewer?"* Yes / No, with a one-line reason.

### Pass rule

**Pass** iff all 13 gated items pass (S1–S6 on both SSGs, S7 on Docusaurus) **and** the owner answers *yes*. **Fail** otherwise. A single verification run; no retry of a failed item.

### On fail

Record the failure and lower the confidence of A7 in brief §8. Apply the brief's "If wrong": fall back to SSG-specific renderers. **No re-gate, no checklist change.** A new attempt requires a new pre-registration.

### Out of scope

Scenario trace in SSGs, packaged/published `<dyd-diagram>`, bundle-size work, live reload / `dyd watch`, Material `navigation.instant` (off; recorded only), Zensical, other SSGs, click-to-context/source, A5, A6, MCP.

### Invariants

- Toy docs stay pure Mermaid + YAML frontmatter and render on GitHub.
- The standalone viewer and `spike/e2e/viewer.pw.ts` keep passing.
- Existing CLI commands and tests keep passing (`.cor/config.md` checks).
- `index.json` may be extended, never broken.

## Amendments

- **2026-11-15 (before the verification run), contract clarification.** The element dispatches a cancelable, composed `dyd-navigate` event (`detail: { url, id }`) on the host when a node with a child doc is clicked; the default action is `location.assign(url)`. The info panel is filled before the event fires. S4 and S5 are observed by cancelling `dyd-navigate` so the page stays put; S3 lets it proceed. No item, threshold or pass rule changes.
- **2026-11-15 (before the verification run), S6 on Material.** Material renders into a *closed* shadow root, so an `svg` inside it cannot be observed. For MkDocs, S6 reads "rendered as plain Mermaid" as: no `pre.mermaid` left on the page, one `div.mermaid` per fence, each with a rendered height > 50 px, no uncaught page error. Docusaurus keeps the original wording (an `svg` inside `.docusaurus-mermaid-container`). The S7 build-exit check is made by the build script (`ssg/build-all.sh` records the Docusaurus exit status and log), which the spec reads.
- **2026-11-15 (before the verification run), S5 wording.** S5 said "no `parent`/`children`/`src` fields rendered". `PaymentGateway` has an inferred `parent` (`system`) in `index.json`, so the panel does render `parent`, exactly as in the standalone viewer's C5. S5 reads: `parent` equals the `index.json` value, `appearsIn` and `scenarios` are shown, no `children` and no `src` field rendered, no error. Intent unchanged (same as the viewer).
- **2026-11-15 (after the A7 verdict, before the trace-context regression run), S3 gesture.** The trace-context spike ([trace-context-findings.md](./trace-context-findings.md)) splits selection from navigation: a node click only selects and fills the panel; the deep dive is the "Open" `<a href>` link (`[data-dyd-open]`) in the panel, which still fires the cancelable, composed `dyd-navigate` (`detail: { url, id }`). When this suite is re-run as regression (R1), S3 reads: on `system`, select `OrderService` then click its "Open" link → `order-service` page renders `Controller`, `Validator`, `Repository`; select `Validator` then "Open" → `validator` page renders `SchemaCheck`, `StockCheck`; selecting `API` (no child doc) shows no "Open" link and does not navigate. S4 and S5 no longer need to cancel `dyd-navigate`, since a node click does not navigate. The A7 verdict above is unchanged.

## Results

Verification run 2026-11-15: clean rebuild of all four sites (`npm --prefix spike run ssg:build`), then one run of `npm --prefix spike run e2e:ssg` (13 tests, Chromium, `spike/e2e/ssg.pw.ts`). The spec had been dry-run once on the same builds during T09 (all green); the recorded run is the clean rebuild. Results against the frozen checklist (as amended above):

| # | Item | Docusaurus 3.10.2 | MkDocs 1.6.1 + Material 9.8.1 |
| --- | --- | --- | --- |
| S1 | Render + ID mapping | pass | pass |
| S2 | Index and map under base URL | pass | pass |
| S3 | Deep dive | pass | pass |
| S4 | Info panel, documented | pass | pass |
| S5 | Info panel, undocumented | pass | pass |
| S6 | Deletability | pass | pass |
| S7 | No `id:` build error | pass | n/a |

**Automated gate: 13/13.**

**Owner (T11): yes.** Reason, verbatim: "It works but no play pause sequence and so on". The missing trace controls are the scenario trace, which was out of scope for this spike by design; the owner's note is a reminder that the SSG element is not yet at parity with the standalone viewer.

**Verdict: PASS** (all 13 gated items pass and the owner answered yes).

### Findings (recorded, not gated)

- **Both adapters stayed thin.** Docusaurus: 55 lines (`dyd-theme/index.js` 35, `client.js` 7, `theme/Mermaid/index.js` 13). MkDocs: 38 lines (`hooks.py`). The element is 142 lines plus 67 shared with the standalone viewer. Adapters only pass the fence text, emit the doc→URL map, run `dyd index` and copy the bundle: no product logic leaked (constraint 6).
- **Paths and base URL.** Defaults resolved from `import.meta.url` (`index.json` and `dyd-map.json` sit next to `dyd-diagram.js` in `<site>/dyd/`) made base-URL handling a non-issue: no adapter computes a base. The doc→URL map carries site-absolute URLs from each SSG's own route data (Docusaurus `permalink`, MkDocs `file.url` + `site_url` path). The element matches the current page to a doc by normalised path (trailing slash, `index.html`, `.html` ignored).
- **Identity.** The element finds its doc from the page URL via the map and its fence number from its order among `<dyd-diagram>` on the page. Nothing was injected per diagram. Works for the toy (one fence per doc); multi-fence pages are untested.
- **`id:` collision.** Docusaurus reads the toy's `id:` as the doc id: permalinks are `/dyd/docs/architecture/OrderService`, `/dyd/docs/architecture/Validator`, `/dyd/docs/architecture/system` and `/dyd/docs/scenarios/checkout-happy-path` (every toy doc has an `id:`, so each permalink uses it instead of the filename: `OrderService` and `Validator` also differ in case from their files). No build error, four distinct permalinks (S7). MkDocs ignores `id:` and keeps file-based URLs (`/dyd/architecture/order-service/`). The map absorbs the difference. An `id` containing `/` would make Docusaurus throw (research, not exercised): this constrains any future "qualified ID" syntax.
- **Docusaurus quirks.** `@docusaurus/theme-mermaid` needs `@mermaid-js/layout-elk` installed even though it is an optional peer (the client bundle fails to resolve it otherwise). `package.json` must not set `"type": "commonjs"` (babel then misparses the generated `.docusaurus` modules). The dynamic import of the element bundle in `client.js` logs a harmless webpack "critical dependency" warning in the server compile. The classic preset warns about a missing home page (`/dyd/` broken link): the toy has no index doc.
- **Hydration.** No console error or warning on any of the four sites in the production builds (React prod mode; dev-mode hydration warnings were not checked). The custom element renders only into its own open shadow root, and a `source` attribute is the only light-DOM state.
- **MkDocs ordering race: won.** With the adapter, Material never mounts: no `div.mermaid`, no request to unpkg. The module script upgrades `<dyd-diagram>` (which empties its light DOM) before Material's `DOMContentLoaded` mount. The wrapping happens at build time, so no Material internals are touched. Not tested: `navigation.instant`.
- **Two Mermaid copies.** Docusaurus: `theme-mermaid` resolves Mermaid 11.17.2, the element bundles 12.3.0. With the dyd theme the page loads the element's bundle only (native Mermaid is imported but never called). MkDocs: native Material path loads `mermaid@11` (11.17.2) from unpkg, dyd path bundles 12.3.0 and skips unpkg.
- **Weight (uncompressed JS, one page, cold).** Docusaurus plain 2.0 MB → with dyd 5.4 MB. MkDocs plain 3.6 MB (mostly unpkg Mermaid) → with dyd 5.0 MB. The element bundle ships as a directory of 108 files (11 MB on disk: Mermaid's lazy chunks), loaded on demand. Bundle-size work is out of scope; this is a number to remember for A8-style concerns.
- **Network need.** The adapter-removed MkDocs build needs `unpkg.com` to render anything (Material's behaviour); S6 ran with live network. Material also pulls Google Fonts by default (not a dyd concern). The dyd path itself needs no external host.
- **Closed shadow root.** Material's closed shadow root cannot be inspected: S6 for MkDocs was judged by container height (amendment above). It also confirms that post-processing Material's native output was never an option.
- **Platform horizon.** The MkDocs build prints Material's notice: end of life on 2027-05-05, critical fixes until then, Zensical as successor; MkDocs 1.x has had no release since 2024-08. A7 holds for MkDocs today on a platform with a short horizon. Zensical hooks support was not tested.
- **Deletability.** Dropping the adapter is a config-only change in both SSGs (`themes` entry; `hooks` + `extra_javascript`). Both fall back to plain native Mermaid with no error.
- **Side effect.** `dyd index` writes `index.json` into the docs folder (`spike/toy/index.json`); both build hooks rewrite that tracked file with identical content. A build-output location option on the CLI would avoid touching the corpus.
- **Not covered.** Multi-fence pages, dark-mode re-render (Docusaurus re-renders native Mermaid on colour-mode change; the element does not follow), client-side route changes in Docusaurus (only full loads and `location.assign` deep dives were exercised; a Docusaurus route change reuses the React tree and element lifecycle was not tested beyond navigation by URL), `dyd watch`.
