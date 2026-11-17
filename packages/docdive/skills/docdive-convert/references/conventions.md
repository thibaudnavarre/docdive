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
entities:                   # code behind the entities named in state notes (see State notes); repo-root paths
  Order: [src/orders/order.ts]
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

### State notes (what the data looks like at a step)
- A `Note over X: …` placed right after a message is the state X holds at that step; the viewer shows it under the player and in X's inspector. A note before the first message is the initial state. `Note over A,B` applies to both.
- Write `Entity key=value key=value … free text`: a leading PascalCase word is the entity (`Order`, `Payment`), `k=v` tokens are fields (no spaces in a value), anything else is text shown muted. `Note over OrdersDB: Order id=42 status=paid row in orders`.
- Add a note only where state changes (a new or updated field), on the participant that holds it: the frontend or API for what the client sees, the service for in-flight state, the store for what is persisted. Fields accumulate across steps; later values win.
- Keep one spelling per entity and per field across notes. Notes render as plain Mermaid notes on GitHub.
- `entities: { Order: [src/orders/order.ts] }` in any doc's frontmatter (string or list, repo-root paths like `src`) links the entity to its code in the viewer. Declare it once, on the doc of the element that owns the data, spelled as in the notes. Declarations from several docs are merged.

## Lint
`docdive lint <docs> --root <repo>` exits 1 on errors, 0 otherwise.

| Error | Fix |
| --- | --- |
| `unresolved-participant` | The participant misspells an element ID: rename it to `suggestion`. |
| `duplicate-id-siblings` | Two docs under one `parent` claim one `id`: rename or merge. |
| `missing-parent` | `parent` is no doc's `id`: fix the spelling (`suggestion`) or create that doc. |
| `missing-src` | A `src` or `entities` path does not exist under `--root`: fix it or drop it. |

Warnings (`--json`): `note-participant-unknown` (a state note over a name that sends or receives no message in that scenario: fix the spelling), `fuzzy-id-candidate` (two IDs look like one thing: unify if they are), `duplicate-id-different-labels` (one ID, different labels: harmless when both labels name the same thing; split the ID when they don't), `edge-not-in-diagram`, `parse-failed` (a fence docdive cannot read: simplify the syntax).
