# docdive model conventions

The model is plain Markdown: YAML frontmatter plus ```` ```mermaid ```` fences. Bare `.mmd` files are indexed too (one diagram each), but only Markdown can carry frontmatter.

## IDs
- An element is a service, module, component, store or actor. Its ID is the Mermaid node ID (`OrderService`), never the label (`OrderService[Order Service]`).
- The same ID in two diagrams is the same element. One concept = one spelling everywhere (not `OrderSvc`, `order_service`, `Orders`). Do not reuse one ID for two things.
- PascalCase, 3+ characters, no spaces. IDs of 1–2 characters (`A`, `B1`) are placeholders and never become elements.

## Frontmatter
```yaml
id: OrderService            # the element this doc describes (required to be divable)
parent: system              # the id of the doc that contains this one
src: [src/orders/]          # repo paths that implement it, relative to the repo root
description: Takes and stores customer orders.   # one sentence, shown in the viewer panel
kind: scenario              # only on a flow doc (see Scenarios); omit otherwise
```
- `parent` must be the `id` of another doc. Two docs under the same `parent` must not share an `id`.
- Nodes get a parent without frontmatter. In one diagram, the innermost container wins: a `subgraph` member belongs to the subgraph, other nodes to the doc's `id`. Across diagrams, the outermost container wins, so a zoom diagram that redraws its neighbours (API, DB, Bus…) does not adopt them. When two unrelated containers draw a node, it gets no parent.

## Diving
- One root doc (`id: system`) with the top-level flowchart.
- One doc per element worth zooming into: `id: <NodeId>`, `parent: <id of the doc that draws it>`, and a flowchart of its internals. Every node in a doc's flowchart becomes a child of that doc's element.
- `subgraph` groups nodes at the same zoom level. A separate doc with `parent` is a deeper zoom. Do not do both for one thing.

## Scenarios (animated flows)
- One doc per feature or flow: `id: <kebab-case-flow-name>`, `kind: scenario`, one `sequenceDiagram`.
- Participants are element IDs, spelled exactly as in the flowcharts. The viewer animates each message on every flowchart that draws both ends.
- Each `A->>B` message should match an edge `A --> B` (either direction) in the flowcharts that draw both; otherwise lint warns `edge-not-in-diagram`.
- A `sequenceDiagram` in a doc without `kind: scenario` still animates, under the id `<doc id or path>#<fence index>`.
- Animation shows on any flowchart that draws a step's participants, or one of their ancestors. Use participants at the zoom level where the flow should be seen, and include actors (`Operator`) only if a flowchart draws them.

## Lint
`docdive lint <docs> --root <repo>` exits 1 on errors, 0 otherwise.

| Error | Fix |
| --- | --- |
| `unresolved-participant` | The participant misspells an element ID: rename it to `suggestion`. |
| `duplicate-id-siblings` | Two docs under one `parent` claim one `id`: rename or merge. |
| `missing-parent` | `parent` is no doc's `id`: fix the spelling (`suggestion`) or create that doc. |
| `missing-src` | The path does not exist under `--root`: fix it or drop it. |

Warnings (`--json`): `fuzzy-id-candidate` (two IDs look like one thing: unify if they are), `duplicate-id-different-labels` (one ID, different labels: harmless when both labels name the same thing; split the ID when they don't), `edge-not-in-diagram`, `parse-failed` (a fence docdive cannot read: simplify the syntax).
