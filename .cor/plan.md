# COR Plan — Week 1 toy system + throwaway indexer spike

## Context

Validate the "implicit model by convention" bet from `docs/product-brief.md` (§10 step 1): from the 3-file toy system written in pure Mermaid + YAML frontmatter, a disposable TypeScript indexer must produce `index.json` and a correct `context OrderService` bundle, and a static HTML page must step a scenario trace across a flowchart. Everything the implicit model cannot express gets recorded for the next Think.

### Current state

- Repo contains only `docs/product-brief.md`, `.cor/config.md`, and skill folders. No source code, no package.json, no toy docs yet.
- Stack per `.cor/config.md`: TypeScript (Node) core; checks are `npx tsc --noEmit`, `npx eslint . --fix`, `npx vitest run --passWithNoTests`, `ruff check . --fix` (Python shim not relevant to this spike).

### Decisions locked in Think

| Subject | Decision | Why |
| --- | --- | --- |
| Slice | §10 step 1 only: toy + indexer spike + minimal highlight page | Brownfield spike, skill, viewer, wrappers are separate increments |
| Code lifetime | Disposable — optimise for learning speed | Rewrite after findings; do not set up real package layout |
| Toy content | Exactly the 3 files from brief §5.4 (`system`, `OrderService`, `checkout-happy-path`) | Smallest system that exercises deep dive + scenario + src |
| Diagram types | `flowchart`/`graph` + `sequenceDiagram` only | ER/class/C4 are a later increment once the extractor shape is stable |
| Parsing | Lightweight regex / line-based extractor | Brief §11 recommendation; mermaid's own parser is heavy and browser-oriented |
| Node shapes | Must handle `[ ]`, `( )`, `[( )]`, `{ }`, `(( ))`, `> ]` and chained `A --> B --> C`; exotic shapes fail loudly | Toy + common real-world usage; silent misparse would corrupt the model |
| Hierarchy | Explicit `parent:` frontmatter only | Folder/heading/subgraph inference deferred to brownfield spike |
| Scenario detection | Explicit `kind: scenario` only | Inference from "main diagram is a sequenceDiagram" deferred |
| Context text | Whole body of the element's own doc (frontmatter `id` match); no cross-doc inference | Predictable rule; "nearest section" heuristic deferred |
| Undocumented nodes | Become elements with `doc: null`, low confidence, **no** diagnostic | API/PaymentGateway/OrdersDB/Controller… are legitimate elements without docs in the toy |
| Return messages (`-->>`) | Match flowchart edge in either direction; highlight that edge + receiving node | Toy step 3 `PaymentGateway-->>OrderService` has no forward edge |
| Missing edge | Scenario step with no edge (either direction) in a flowchart containing both endpoints → `edge-not-in-diagram` diagnostic in `index.json` | Cross-layer inconsistency is exactly what the model should surface |
| Runtime | Plain TS via `tsx`, minimal deps (`gray-matter` or hand-rolled YAML) | Disposable; no pnpm workspace / eslint setup |
| Highlight page | Static HTML, Mermaid from CDN `<script>`, no bundler | Fastest path to "does the trace feel right" |
| Findings | `docs/spike-findings.md` running log | Read by Plan and later Think rounds |

### Scope

**In scope:** toy docs, loader, flowchart + sequence extractors, model builder, one lint rule, `index` + `context` commands, static highlight page, extractor unit tests, findings log.

**Out of scope:** brownfield inference (fuzzy ID match, folder/heading hierarchy, `src` symbol search), `lint --fix`, `init`, `watch`, `<dyd-diagram>` web component, SSG wrappers, conventions skill, MCP, ER/class/C4 extraction, message IDs / A3 collision handling (not exercised by the toy — only record status).

### Invariants

- D1 — zero non-Mermaid syntax beyond doc-level YAML frontmatter.
- D2 — no central model file; `index.json` is derived output only.
- D9 — deleting the spike leaves the toy docs as valid Mermaid + valid YAML that render on GitHub.
- `index.json` follows the §5.5 shape (`version`, `elements`, `diagrams`, `scenarios`, `diagnostics`).

### Acceptance criteria

- `dyd context OrderService` on the toy prints: `parent: system`; children `Controller`, `Validator`, `Repository`; `appearsIn` = `system.md#0` and `checkout.md#0`; 1 scenario `checkout-happy-path`; `src: [src/orders/]`. Verified by manual eyeball.
- Opening `highlight.html`, picking `checkout-happy-path`, and pressing step highlights `system.md` nodes/edges in order API → OrderService → PaymentGateway → (return, same edge) → OrdersDB.
- `docs/spike-findings.md` exists and lists anything the implicit model could not express, plus parsing surprises.
- Solo validation by owner.

## Tasks

- [x] T01: Create the 3 toy docs under `spike/toy/` exactly as brief §5.4 (`architecture/system.md`, `architecture/order-service.md`, `scenarios/checkout.md`)
- [x] T02: Scaffold `spike/` with `package.json` (tsx, gray-matter, vitest), `tsconfig.json`, and a `npx tsx spike/src/cli.ts` entry
- [x] T03: Implement the Markdown loader: walk a folder, parse doc-level frontmatter, extract fenced mermaid blocks with their start line numbers
- [x] T04: Implement the flowchart extractor: node IDs + labels for `[ ]` `( )` `[( )]` `{ }` `(( ))` `> ]` shapes, chained arrows `A --> B --> C`, and edges; throw a loud error on unrecognised node syntax
- [x] T05: Implement the sequenceDiagram extractor: participants (explicit `participant`/`actor` lines + implicit from messages), ordered steps with `from`/`to`/`label`/`isReturn` (`-->>` family)
- [x] T06: Build the implicit model: elements keyed by ID with `doc`/`parent`/`children`/`src`/`appearsIn`/`confidence`, `diagrams` list, `scenarios` (from docs with `kind: scenario`), per §5.5 shape
- [x] T07: Add the `edge-not-in-diagram` rule: for each scenario step, match an edge in either direction in every flowchart where both endpoints appear; emit a diagnostic when none matches
- [x] T08: Implement `dyd index <folder>` → writes `index.json` with deterministic key ordering
- [x] T09: Implement `dyd context <elementId>` → Markdown and `--json` output: element doc body, parent/children, appearsIn, scenarios through it, src
- [x] T10: Build `spike/highlight.html`: static page loading Mermaid from CDN, renders `system.md`'s flowchart, loads `index.json`, scenario picker + step/reset buttons; highlights nodes and the bidirectionally-matched edge in step order
- [x] T11: Write unit tests for the flowchart and sequence extractors (shapes, chained arrows, return messages, loud failure) [unit]
- [x] T12: Run `dyd index` + `dyd context OrderService` on the toy and verify the bundle: parent=system, children=Controller/Validator/Repository, 2 appearsIn, 1 scenario, src=src/orders/ [UAT]
- [x] T13: Open `highlight.html`, pick `checkout-happy-path`, step through; verify API→OrderService→PaymentGateway→(return)→OrdersDB highlight order [UAT]
- [x] T14: Write `docs/spike-findings.md`: anything the implicit model could not express, parsing surprises, A3 collision status, open questions for the next increment
