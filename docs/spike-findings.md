# Spike findings — implicit model (week 1)

Toy system (3 files, pure Mermaid + frontmatter) → `spike/` indexer → `index.json` → `dyd context OrderService` + `spike/highlight.html`.

## Verdict

The implicit model held for the toy with **zero new syntax**. `dyd context OrderService` returns the expected bundle (parent `system`; children `Controller`/`Validator`/`Repository`; appearsIn `architecture/system.md#0` + `scenarios/checkout.md#0`; scenario `checkout-happy-path`; src `src/orders/`). The highlight page steps API → OrderService → PaymentGateway → (return, same edge) → OrdersDB, verified headlessly (Playwright/Chromium, Mermaid 11).

## What the implicit model could not express (or only by a rule we invented)

- **Children come from diagram membership, not frontmatter.** `Controller`/`Validator`/`Repository` are children of `OrderService` only because they appear in `OrderService`'s own doc. The brief's "explicit `parent:` only" decision is insufficient for the acceptance bundle: rule used = nodes of a doc's flowcharts are children of that doc's `id`. First owner wins (`parent ??=`). A node drawn in two docs has one parent.
- **Doc ownership vs. diagram appearance.** `system` is an element with no `appearsIn` (it owns a diagram, it isn't drawn). Fine for the toy; undefined for multi-level systems.
- **Return messages have no edge.** `PaymentGateway-->>OrderService` is matched against the forward edge in reverse. Works, but "either direction" also hides genuinely wrong-direction calls.
- **Undocumented elements** (`API`, `PaymentGateway`, `OrdersDB`, …) get `doc: null`, confidence 0.5. No way to attach prose to them without creating a doc.
- **Context text** is the whole body of the element's doc, which in the toy is only the Mermaid block (no prose). A "nearest section" rule is still open.
- **Edge identity.** Parallel edges between the same pair (A3) are not distinguished: the page highlights the first matching `L_A_B_n` link. **A3 status: not exercised by the toy; untested.**
- **Node labels vs. IDs.** `OrdersDB[(orders)]` gives label `orders`, ID `OrdersDB`; scenarios use the ID. Works; label is only held in the extractor result, not in `index.json`.

## Parsing surprises

- Mermaid IDs may contain `-`; naive `[\w-]*` swallowed the arrow in `A-->B`. Fixed with `\w+(-\w+)*`.
- Regex alternation order mattered for `A -- text --> B` (must be tried before the plain `--` arrow).
- `&` and `;` are statement splitters in the extractor, so labels containing them would break.
- Unsupported (fail loudly): `[[ ]]` subroutine, `@{shape:…}`, other exotic shapes. Ignored, not modelled: subgraphs, `classDef`/`style`/`click`, notes/loops/alt blocks in sequence diagrams.
- Mermaid 11 prefixes SVG ids with the render id (`<id>-flowchart-API-0`, `<id>-L_A_B_0`), and `mermaid.run` silently left the `<pre>` unrendered here; `mermaid.render` was used instead.
- `index.json` is written inside the indexed folder (`spike/toy/index.json`); it is derived output.
- `highlight.html` needs an HTTP server (`cd spike && python3 -m http.server`), since `fetch` fails on `file://`.

## Open questions for the next increment

1. Formalise ownership: should `children` come from frontmatter, diagram membership, or both?
2. Hierarchy from subgraphs / folders / headings (brownfield spike).
3. What distinguishes a wrong-direction scenario step from a legitimate return message? (`isReturn` is available.)
4. Message IDs or step indices to disambiguate parallel edges (A3).
5. Where a context bundle's prose ends ("nearest section" rule).
6. Highlighting beyond the top-level flowchart (elements only drawn in a deeper diagram).
