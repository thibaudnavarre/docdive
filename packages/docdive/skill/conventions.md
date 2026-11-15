# Architecture docs conventions

Document the system as Markdown files under `docs/architecture/`. Each file has YAML frontmatter and one or more ```` ```mermaid ```` blocks. IDs are the glue: the same thing always has the same ID, in every file.

## IDs
- An element is a service, module, component, table or actor. Its **ID** is the Mermaid node ID (`OrderService`), never the label (`OrderService[Order Service]`).
- Use PascalCase, 3+ characters, no spaces, no abbreviations. One concept = one spelling everywhere (not `OrderSvc`, `order_service`, `Orders`).
- Before using an ID, check the docs you already wrote and reuse the exact spelling. Do not reuse one ID for two different things.
- Names of 1–2 characters (`A`, `B1`) are throwaway placeholders and are ignored.

## Frontmatter (all keys optional)
```yaml
id: OrderService     # the element this file describes
kind: scenario       # only for a sequence-diagram file (omit for elements)
parent: system       # the id of the file that contains this one
src: [src/orders/]   # real paths in the repo that implement it
```
- `parent` must be the `id` of another file you wrote. `src` paths must exist in the repo (relative to its root).
- Two files under the same `parent` must not have the same `id`.

## Structure
- `docs/architecture/system.md` (`id: system`): the top-level flowchart of the main modules.
- One file per important module, with `id`, `parent: system`, `src`, and a flowchart of its internals. Reuse the module's ID inside `system.md` and other files.
- Mermaid `subgraph` groups nodes at the same level of detail. A separate file with `parent:` is a deeper zoom. Do not do both for the same thing.
- One scenario file per key flow (`kind: scenario`, a `sequenceDiagram`). Participants use the element IDs. Actors (`User`) and external systems may have no file.

## Lint feedback
You may be shown JSON `{errors, warnings}`. Each error has `rule`, `file`, `message`, often `suggestion`:
- `unresolved-participant`: the participant is a misspelling of an existing ID; rename it to `suggestion`.
- `duplicate-id-siblings`: two files claim one `id`; rename or remove one.
- `missing-parent`: `parent` is not any file's `id`; fix the spelling or create that file.
- `missing-src`: the path does not exist; fix it or delete the key.
Warnings (`fuzzy-id-candidate`, ...) are hints: unify spellings if both name the same thing.
Fix every error in a single pass. Do not run anything else.
