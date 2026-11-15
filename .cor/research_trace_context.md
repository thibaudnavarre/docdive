# COR Research — Scenario trace + click-to-context in `<dyd-diagram>` (SSG spike)

## Decision summary
- Recommended approach:
  1. **Context bundle:** the CLI renders every bundle at build time with the existing `renderContextMarkdown(buildContext(...))`. A new `dyd context --all` mode prints a JSON map `{ elementId: markdown }` on stdout. The adapters write that output to `<site>/dyd/contexts.json` (data only, like `dyd-map.json`). The element fetches it **before** the click, then calls `navigator.clipboard.writeText` synchronously inside the button's click handler.
  2. **Trace state across deep dive:** carry it in URL query parameters (`dyd-scenario`, `dyd-step`) on the child URL. The child page restores the state paused.
  3. **Deep-dive gesture:** an `<a href>` "Open" link in the info panel. Its click still dispatches the cancelable, composed `dyd-navigate` event; if the event is cancelled, call `preventDefault()` on the anchor. A node click only selects the node and fills the panel.
  4. **Trace engine:** port the viewer's `edgeOccurrence`, `applyTrace` and `annotateSequence` into `viewer/shared.ts` as parametrised functions, and leave `viewer/main.ts` untouched.
- Why it fits this project:
  - The bundle is byte-identical by construction, because the same function produces both the CLI output and the copy.
  - No product logic sits in the adapters (constraint 6), and no extra file is written into the docs corpus.
  - The query-parameter approach reuses the viewer's convention and makes the state visible and testable in the URL.
  - An anchor is keyboard-operable (WCAG 2.1.1), which a double-click is not.
- Confidence: HIGH for the context bundle and the gesture. MEDIUM for clipboard verification headless (Playwright warns that permissions are browser- and version-dependent).

## Project evidence
- Goal inherited from Think: add scenario trace (picker, play, pause, step) and a "Copy context" button to `<dyd-diagram>`. Prove both in Docusaurus and MkDocs on the toy, using the A7 harness. The trace state (scenario + step) must survive a deep dive.
- Scope boundaries:
  - One fence per page.
  - Trace works on flowchart and sequence diagrams.
  - On a child page, show the "Scenario passes through *parent*" notice only (A5 deferred).
  - Standalone viewer untouched.
  - Throwaway spike.
- Acceptance criteria:
  - Playwright checklist, written and frozen before the run, on both SSGs.
  - Clipboard checked via granted permissions and compared to the CLI output.
  - Full A7 suite and viewer suite still green, with S3 amended (dated amendment).
  - Owner walkthrough yes/no.
- Resolved versions (from `spike/node_modules`):
  - mermaid 12.3.0
  - @playwright/test 1.65.1
  - esbuild 0.28.2
  - Docusaurus 3.10.2 and MkDocs 1.6.1 + Material 9.8.1 (per `docs/ssg-findings.md`)
  - No `docs/DEPENDENCIES.md`.
- Existing usages and primitives:
  - `spike/viewer/element.ts:126` `onClick`: fills the panel, then navigates at once via `dyd-navigate` → `location.assign`. This is the click conflict.
  - `spike/viewer/element.ts:105`: only flowcharts get annotated (`annotateFlowchart`); there is no sequence annotation in the element.
  - `spike/viewer/main.ts:52` `annotateSequence`: maps by DOM order of `text.messageText` / `[class^=messageLine]` and writes to the viewer-local `errorHost`.
  - Confirmed that the mermaid 12.3.0 chunk `sequenceDiagram-5NDRBG5M.mjs` still emits `messageText`, `messageLine0` and `messageLine1`.
  - `spike/viewer/main.ts:128` `edgeOccurrence` and `:136` `applyTrace`: the A3 positional heuristic and the "passes through" logic, tied to module-level DOM.
  - `spike/viewer/main.ts:119`: the viewer already reads URL query params (`interval`).
  - `spike/src/context.ts:18` `buildContext` reads the doc body with `loadDocs` (node:fs + gray-matter), so it can't run in the browser. `index.json` has no doc body.
  - `spike/src/context.ts:48` `renderContextMarkdown` is pure and ends with `"\n"`.
  - `spike/src/cli.ts:61` `context` uses `buildModel(root, root)` with no `--src`, the same as the adapters' `index` call.
  - CLI stdout ends `"\n\n"`, because `console.log` appends a newline (checked with `od -c` on `context OrderService`).
  - Adapters: `spike/ssg/docusaurus/dyd-theme/index.js` `postBuild` and `spike/ssg/mkdocs/hooks.py` `on_post_build` already copy `index.json` and write `dyd-map.json` into `<site>/dyd/`.
  - A7 tests: `spike/e2e/ssg.pw.ts:77–118` click nodes to deep-dive (S3) and cancel `dyd-navigate` to inspect the panel (S4, S5).
  - The A7 checklist in `docs/ssg-findings.md` is frozen; any change is a dated *Amendment*.
- Constraints inherited from Think:
  - No product logic in adapters (constraint 6).
  - Deletable: removing the adapter falls back to native Mermaid.
  - `dyd-navigate` event kept.
  - A7 + viewer suites green.
  - Chromium headless gate.
  - Served from `http://localhost:420x/dyd/` (`spike/playwright.ssg.config.ts`).

## Findings
| Claim | Evidence | Applicability |
| --- | --- | --- |
| `Clipboard.writeText()` is Baseline (since 2020-03) and needs a secure context. It throws `NotAllowedError` when writing isn't allowed. | [MDN writeText](https://developer.mozilla.org/en-US/docs/Web/API/Clipboard/writeText) | Works in all target browsers. Failures must be caught and shown in the panel, not swallowed. |
| `http://localhost` is a secure context. Plain `http://` on other hosts is not. | [MDN Secure contexts](https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Secure_Contexts); [W3C Secure Contexts](https://w3c.github.io/webappsec-secure-contexts/) | The test servers on `localhost` qualify. Real deployments must be HTTPS. GitHub Pages and Netlify are, so this is not a blocker. |
| A clipboard write is allowed if `clipboard-write` with `allowWithoutGesture` is granted, or if the page has **transient activation**. | [W3C Clipboard API §9.2.1](https://w3c.github.io/clipboard-apis/#check-clipboard-write-permission) | The write must happen inside the button click's activation window. |
| The transient activation duration is "at most a few seconds" and set by the browser. | [WHATWG HTML §6.4 User activation](https://html.spec.whatwg.org/multipage/interaction.html#transient-activation-duration) | A lazy `fetch(contexts.json)` in the click handler before `writeText` risks losing activation. So prefetch it, and only `writeText` in the handler. |
| Playwright `browserContext.grantPermissions` accepts `clipboard-read` / `clipboard-write`, but "supported permissions differ between browsers… any permission may stop working after an update". | [Playwright BrowserContext.grantPermissions](https://playwright.dev/docs/api/class-browsercontext#browser-context-grant-permissions) | Primary check: grant both, click, then `navigator.clipboard.readText()`. An escape hatch is needed (below). |
| `dblclick` fires only after two `click` events. | [MDN dblclick](https://developer.mozilla.org/en-US/docs/Web/API/Element/dblclick_event) | A double-click deep dive always fires the select click twice first, and it can't be operated by keyboard. |
| WCAG 2.1.1 (Level A): all functionality must be operable through a keyboard interface. | [W3C Understanding SC 2.1.1](https://www.w3.org/WAI/WCAG22/Understanding/keyboard.html) | Favours a focusable `<a href>` "Open" link over a double-click. |
| `sessionStorage` is split by origin **and tab**, and survives reloads. A new tab gets a copy of the opener's storage. | [MDN sessionStorage](https://developer.mozilla.org/en-US/docs/Web/API/Window/sessionStorage) | Rejected for trace state: invisible in the URL, can't be shared, and would leak a scenario into unrelated pages of the same tab. |
| Mermaid 12.3.0 sequence SVG still uses `messageText`, `messageLine0` and `messageLine1`. | Local package `spike/node_modules/mermaid/dist/chunks/mermaid.core/sequenceDiagram-5NDRBG5M.mjs` | The viewer's DOM-order mapping can be ported unchanged. |

## Options considered
| Option | Fit | Maintenance / risk | Decision |
| --- | --- | --- | --- |
| **Bundle: CLI `context --all` → JSON map → adapters write `<site>/dyd/contexts.json`** | Byte-identical by construction (same renderer). Adapters just pipe stdout to a file. | Payload grows with N elements × doc body; fine for the toy, but bundle size is a known open topic. | ADOPT |
| Bundle: add `docBody` to `index.json` and bundle `renderContextMarkdown` into the element | No extra file. | Changes the `index.json` contract and duplicates rendering on two runtimes. The doc body must match what `loadDocs`/gray-matter produce. Drift risk. | FALLBACK |
| Bundle: element fetches source `.md` files | — | The SSGs don't publish sources, and it would need gray-matter in the browser. | REJECT |
| Bundle: `dyd index --contexts` writing into the docs folder | Simple. | Repeats the known "build rewrites the corpus" side effect (`docs/ssg-findings.md`). | REJECT |
| **Trace state: URL query `dyd-scenario` / `dyd-step` on the child URL** | Visible, shareable, survives reload, testable by URL. The viewer already reads query params. | Static hosts ignore the query. Docusaurus client-side routing stays untested (out of scope). | ADOPT |
| Trace state: `sessionStorage` | Survives navigation. | Invisible, scoped to the tab, leaks across pages. | REJECT |
| Trace state: `history.state` | — | Doesn't carry across a `location.assign` to a new document. | REJECT |
| **Deep dive: "Open" `<a href>` in the panel (+ `dyd-navigate`)** | Keyboard-operable, middle-click works, the panel stays reachable before leaving. | Changes the S3 gesture (dated amendment). | ADOPT |
| Deep dive: double-click on the node | No new UI. | Not keyboard-operable, and two select clicks fire first. | REJECT |
| **Clipboard check: grant permissions + `readText()`** | Exercises the real API. | Permission support may change (Playwright warning). | ADOPT |
| Clipboard check: `addInitScript` spy on `navigator.clipboard.writeText` | Deterministic. | Doesn't exercise the real clipboard. | FALLBACK (only if grant + readText fails in Chromium 1.65.1; record as an amendment) |

## Plan inputs
- Components or files likely affected:
  - `spike/viewer/element.ts`: trace bar in the shadow root, selection vs navigation split, "Open" link, "Copy context" button, sequence annotation, reading state from the query.
  - `spike/viewer/shared.ts`: parametrised `annotateSequence`, `edgeOccurrence` and trace application.
  - `spike/src/cli.ts`: the `context --all` mode.
  - `spike/ssg/docusaurus/dyd-theme/index.js` and `spike/ssg/mkdocs/hooks.py`: write `contexts.json` to `<site>/dyd/`.
  - `spike/e2e/ssg.pw.ts`: amend S3, add the new checks.
  - New findings doc (e.g. `docs/trace-context-findings.md`) with the frozen checklist.
  - `docs/product-brief.md` §8/§9/§10 after the run.
- Version-specific APIs or migration steps:
  - `navigator.clipboard.writeText` (Baseline).
  - Playwright 1.65.1 `context.grantPermissions(['clipboard-read','clipboard-write'])`, or `test.use({ permissions: [...] })`.
  - Mermaid 12.3.0 sequence class names as above.
- New dependency and version policy, if any: none.
- Risks and mitigations:
  - **Lost user activation:** prefetch `contexts.json` together with `index.json`, and call `writeText` synchronously in the click handler. Catch `NotAllowedError` and show it in the panel (`data-dyd-copy-status`).
  - **Byte-identity definition:** the reference is `renderContextMarkdown(...)`, which is CLI stdout minus the final newline added by `console.log`. Pin this in the checklist.
  - **Trace bar visibility on the child page:** the child diagram's nodes don't include the scenario's participants. "Scenario touches the diagram" must mean a step's `from`/`to` is in `diagram.nodes` **or** is the diagram's doc owner or one of its ancestors. Otherwise the bar hides exactly where the carried-over state should show.
  - **Invalid query state** (unknown scenario, step out of range): clamp or ignore, and never throw.
  - **Viewer untouched:** helpers in `shared.ts` are new or added alongside; don't change `main.ts`, and keep `viewer.pw.ts` green.
  - **Two Mermaid copies and bundle weight:** unchanged by this spike; not gated.
- Validation and test implications:
  - Write the new checklist before the run, covering on both SSGs:
    - trace bar visibility rules
    - step, prev, play, pause on the flowchart
    - sequence message highlight on the checkout page
    - deep dive keeps scenario + step and shows the "passes through" notice
    - node click no longer navigates
    - the "Open" link navigates and still fires `dyd-navigate`
    - "Copy context" equals the CLI reference for one documented element (`OrderService`) and one undocumented element (`PaymentGateway`)
    - adapter-removed builds still render
  - Run `npm --prefix spike run ssg:build`, then `e2e:ssg`, then `e2e` (viewer), plus the config checks (typecheck, lint, vitest, ruff).
- Decisions cor-plan must preserve:
  - Same renderer for CLI and copy (no browser-side re-implementation).
  - No product logic and no corpus writes in the adapters.
  - `dyd-navigate` stays cancelable and composed, with `detail: { url, id }`.
  - Trace state lives in the URL.
  - The deep-dive gesture is a keyboard-operable link.
  - The A7 checklist changes only through a dated amendment.

## Unresolved questions
- Exact query parameter names and whether step changes update the current URL (`history.replaceState`) so a reload keeps the state. This is a plan-level choice; Think only requires the state to survive a deep dive.
- Whether `grantPermissions` + `readText()` works headless in Playwright 1.65.1 Chromium for this setup. Not verified here; it is the first thing to check in Plan/Work, with the spy as the fallback.

## Sources
- [MDN — Clipboard: writeText()](https://developer.mozilla.org/en-US/docs/Web/API/Clipboard/writeText), accessed 2026-11-15
- [MDN — Secure contexts](https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Secure_Contexts), accessed 2026-11-15
- [W3C — Clipboard API and events, §9.2 Clipboard write permission](https://w3c.github.io/clipboard-apis/#check-clipboard-write-permission), accessed 2026-11-15
- [WHATWG HTML — User activation](https://html.spec.whatwg.org/multipage/interaction.html#transient-activation-duration), accessed 2026-11-15
- [Playwright — BrowserContext.grantPermissions](https://playwright.dev/docs/api/class-browsercontext#browser-context-grant-permissions), accessed 2026-11-15
- [MDN — Element: dblclick event](https://developer.mozilla.org/en-US/docs/Web/API/Element/dblclick_event), accessed 2026-11-15
- [W3C — Understanding WCAG 2.2 SC 2.1.1 Keyboard](https://www.w3.org/WAI/WCAG22/Understanding/keyboard.html), accessed 2026-11-15
- [MDN — Window: sessionStorage](https://developer.mozilla.org/en-US/docs/Web/API/Window/sessionStorage), accessed 2026-11-15
