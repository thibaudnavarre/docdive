---
name: docdive-convert
description: Converts existing Markdown documentation that contains Mermaid diagrams into the docdive model (frontmatter ids, parents, src, scenario docs) so diagrams become divable and flows animate in the Docusaurus or MkDocs viewer. Use when asked to adopt docdive, make docs divable or animated, model architecture docs, add scenarios for features or flows, or fix docdive lint errors.
---

# docdive-convert

Edit the docs in place so they follow [references/conventions.md](references/conventions.md). Read it first. Keep every diagram rendering as plain Mermaid; change prose only where an ID is renamed.

## Workflow

Copy and tick:

```
- [ ] 1. Inventory: list docs and their mermaid fences; note every node ID and participant
- [ ] 2. Make diagrams interactive: a flowchart/sequence fence hidden in <details> next to a static image becomes the shown diagram
- [ ] 3. Pick canonical IDs; rename variants in every fence (node IDs only, labels stay)
- [ ] 4. Hierarchy: root doc `id: system`, then `id` + `parent` on each doc that zooms into a node
- [ ] 5. `src` and `description` on each doc with an `id`; `entities` where state notes name data the code defines
- [ ] 6. Scenarios: one `kind: scenario` doc per feature or flow
- [ ] 7. npx docdive lint <docs> --root <repo>; fix; repeat until "0 errors"
- [ ] 8. npx docdive lint <docs> --root <repo> --json; resolve the warnings that are real
- [ ] 9. npx docdive build <docs> --out /tmp/docdive; check index.json
```

Do not stop while step 7 reports errors.

## Decisions

- **Same thing or not.** Merge two IDs only when the docs or the code show they are one thing (`Worker`/`Workers` both being the job consumer). Names that merely look alike stay apart. When unsure, keep both and say so in the summary.
- **Canonical ID.** The spelling used most across diagrams, or the code's name for it.
- **Where a zoom doc goes.** If a doc already describes a node in depth, give it that node's `id` and the `parent` of the doc that draws the node. Do not create docs for every node: only for elements the docs already explain or that have an internals diagram.
- **Static image + hidden source.** Retro-docs often show an exported `.svg`/`.png` and keep the Mermaid in a collapsed `<details>`. The viewer only enhances the fence, so delete the image and the `<details>` wrapper and keep the fence. Leave `erDiagram`/`classDiagram` blocks as they are.
- **Duplicated diagrams.** The same diagram in several files (a chapter, a consolidated doc, a bare `.mmd`) is indexed once per copy: extra scenarios and repeated warnings. Rename IDs in every copy. Give `id`/`parent` to one doc only (the chapter). Bare `.mmd` copies of a fenced diagram add nothing: list them in the report and leave them to the user rather than deleting them.
- **One doc, several elements.** Give the doc the `id` of the element it is mainly about; the others stay nodes of its diagram.
- **Diagram types.** Only `flowchart`/`graph` and `sequenceDiagram` join the model. Leave other diagram types untouched.
- **Scenarios.** Take flows from what the docs describe (numbered steps, existing sequence diagrams, "when a user…" prose). Turn each into a `sequenceDiagram` whose participants are element IDs. Never invent a step the docs or code do not support. When the docs or code say what the data looks like at a step (a status, an id, a row written), add a `Note over <holder>: Entity k=v …` after that message (see conventions, "State notes"); never invent fields.
- **`src`.** Only paths you verified exist. A directory beats a guessed file. Omit when unsure.
- **`entities`.** When a state note names an entity (`Order`) and the code has a file for it (a model, schema or type), declare `entities: { Order: [path] }` once, on the doc of the element that owns that data. Same rule as `src`: verified paths only.
- **`description`.** One sentence from the docs: what it does.
- **Docusaurus.** Frontmatter `id` is also the Docusaurus doc id. Keep it unique across the docs folder.

## Done

Report: IDs renamed (old → new), docs given an `id`/`parent`, scenarios created, warnings left on purpose and why.
