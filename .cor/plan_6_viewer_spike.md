# COR Plan — Viewer spike (§9 toy test)

## Context

Answer the brief's §9 **toy test** (`docs/product-brief.md` §9, §10 step 4): on the toy system, do **deep dive + scenario trace + info panel** feel like understanding the system, with zero non-Mermaid syntax beyond frontmatter? Throwaway spike quality, in `spike/`.

### Current state

- `spike/highlight.html` steps one scenario on the top-level flowchart only (Mermaid 11 from CDN, `mermaid.render`, SVG ids `<renderId>-flowchart-<ID>-n` / `<renderId>-L_<A>_<B>_<n>`). No deep dive, no info panel, no sequence-diagram highlighting.
- Parallel edges (A3) are untested: the page highlights the first matching `L_A_B_n` (`docs/spike-findings.md`).
- Toy (`spike/toy/`): `architecture/system.md` (`system`), `architecture/order-service.md` (`OrderService`, parent `system`, children Controller/Validator/Repository), `scenarios/checkout.md` (`checkout-happy-path`, top-level participants only).
- `index.json` already exposes `elements.X.{doc,parent,children,appearsIn,src}`, `diagrams[].{id,type,nodes,edges,labels}`, `scenarios.X.{doc,steps[{from,to,label,isReturn}]}`. Built by `dyd index` (`spike/src/cli.ts:32`).
- `highlight.html` needs an HTTP server (`fetch` fails on `file://`). Playwright is not a `spike/` dependency yet.

### Decisions locked in Think

| Subject | Decision | Why |
| --- | --- | --- |
| Question | §9 toy test only | Next step in brief §10; A1/A4 closed |
| Features | Deep dive (+ breadcrumb/back), scenario trace (play/pause/step) on every diagram it touches, minimal info panel (appearsIn, scenarios, parent/children, src) | Info panel is part of the §9 test; the rest is not needed to answer it |
| Sequence diagram | Trace also highlights the current message on the sequence diagram; reliability of Mermaid's sequence SVG mapping is recorded | Scenario is a sequence diagram (D3); unproven mapping |
| Deeper levels | Scenarios stay at participant level; inside a child diagram (e.g. `OrderService`) during a trace, show "scenario passes through parent" — no sub-step expansion | A5 (hierarchical scenarios) stays deferred |
| Corpus | Toy extended with one deeper level and one parallel-edge case (two messages between the same pair) | Exercise deep dive beyond 2 levels and A3 |
| A3 | Parallel-edge behaviour is **recorded** (correct or documented ambiguity), not required to pass | Message IDs are a deferred item; spike measures, does not solve |
| Gate | Binding pre-registered checklist, frozen before the verification run, verified headlessly with Playwright + owner qualitative yes/no; on fail: record, lower A2/A3 confidence, apply brief's "If wrong"; no re-gate | Same discipline as A1/A4 |
| Tooling | `mermaid` + `@playwright/test` as `spike/` devDependencies; plain HTML/TS page (no framework), bundled for the browser (esbuild/vite already in `node_modules`) and served locally | Reproducible, no CDN at test time |
| Deliverable | New `docs/viewer-findings.md` (pre-registration + results) + brief §8 A2/A3, §9 toy test, §10 updates | Same record shape as previous spikes |

### Scope

**In scope:** toy extension, additive `index.json` fields if needed, viewer page + build/serve scripts, Playwright spec, `docs/viewer-findings.md`, brief updates.
**Out of scope:** click-to-context, click-to-source, `<dyd-diagram>` custom-element packaging, live reload / `dyd watch`, A5 sub-step expansion, SSG wrappers (A7), MCP, dogfood (A6), v1 package.

### Invariants

- Toy docs remain pure Mermaid + YAML frontmatter (D1, D9) and render on GitHub.
- Existing CLI commands (`index`, `init`, `context`, `stats`, `lint`) and tests keep passing (`npm --prefix spike run typecheck`, `lint`, `test`).
- `index.json` shape may be extended, never broken (no renamed/removed fields).
- Pre-registration text is not edited after the verification run (dated addenda only).

### Acceptance criteria

- Pre-registered checklist committed in `docs/viewer-findings.md` before the verification run (checklist items, pass rule, on-fail rule).
- Playwright spec implements the checklist one-to-one and runs headlessly.
- Verdict = pass iff all checklist items pass **and** the owner answers yes to the qualitative question; A3 and sequence-SVG findings recorded regardless.
- `docs/viewer-findings.md` results and brief §8/§9/§10 updated.
- Config checks stay green.

## Tasks

- [x] T01: Write the pre-registration in `docs/viewer-findings.md` — frozen checklist (deep dive, breadcrumb/back, info panel fields, trace step/play/pause on every touched diagram, "passes through parent" indicator, sequence-diagram highlighting), pass rule, on-fail rule; A3 and sequence-SVG reliability marked "recorded, not gated"
- [x] T02: Extend the toy with one deeper level below `OrderService` and a parallel-edge case (pure Mermaid + frontmatter), then regenerate `spike/toy/index.json`
- [x] T03: Add additive `index.json` fields only if the viewer needs them (e.g. diagram → doc/block mapping); skip if not needed — skipped: viewer fetches the .md and takes the Nth mermaid block from the diagram id (`path#n`); no index field needed
- [x] T04: Add `mermaid` and `@playwright/test` devDependencies, a browser build (esbuild) and a local serve script for a plain HTML/TS viewer page
- [x] T05: Viewer shell — load `index.json`, render any diagram via `mermaid.render`, map index IDs to SVG nodes/edges for flowcharts
- [x] T06: Deep dive — click an element with a child doc to navigate; breadcrumb and back navigation
- [x] T07: Minimal info panel — appearsIn, scenarios, parent/children, src for the selected element
- [x] T08: Scenario trace on flowcharts — scenario picker, play/pause/step, applied on every diagram the scenario touches; "passes through parent" indicator inside child diagrams
- [x] T09: Scenario trace on the sequence diagram — highlight the current message and note SVG mapping reliability
- [x] T10: Playwright spec implementing the frozen checklist one-to-one and recording parallel-edge (A3) behaviour [integration]
- [x] T11: Run the verification once, record results plus A3/sequence findings in `docs/viewer-findings.md`, confirm config checks stay green
- [x] T12: Owner walkthrough — "does clicking `OrderService` and selecting the checkout scenario feel like understanding the system?" yes/no [UAT]
- [x] T13: Update brief §8 (A2/A3), §9 toy test result, §10 step 4 status
