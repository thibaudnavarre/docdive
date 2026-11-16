---
name: docdive-model
description: Builds or refreshes docdive.model.yaml, a committed sidecar that gives docdive a system model for any documentation folder (merged aliases, hierarchy, descriptions, src links, data entities) without editing the docs. Use when a docs folder has Mermaid diagrams but no docdive frontmatter (id, parent, src), when docdive lint reports sidecar-stale-sources, or when the user asks to model, index or zoom through existing docs.
---

# docdive-model

Read the docs, write one file, `<docs>/docdive.model.yaml`. Never edit the docs themselves. docdive merges the file into `index.json` and lints it. Precedence: doc frontmatter > sidecar > deterministic inference.

## Workflow

Copy and tick:

```
- [ ] 1. docdive index <docs> --out /tmp/ddv     (read /tmp/ddv/index.json)
- [ ] 2. Read the docs and the code they describe
- [ ] 3. Write or update <docs>/docdive.model.yaml
- [ ] 4. docdive model stamp <docs>
- [ ] 5. docdive lint --docs <docs> --root <repo>
- [ ] 6. Fix every error, re-run 4 and 5 until "0 errors"
```

Step 1 shows what docdive already found: `elements` (`appearsIn`, `parent`, `parentCandidates`), `diagrams[].nodes`, and `diagnostics` (`fuzzy-id-candidate` pairs are strong alias hints). Sidecar problems and an existing sidecar are merged in, so re-running after edits shows the effect.

On a refresh, lint warnings `sidecar-stale-sources` and `sidecar-orphan-element` name what to revisit. Touch only those entries, keep the rest.

## File format

```yaml
elements:
  Worker:                    # canonical element ID; becomes the element in index.json
    aliases: [Workers, Job Runner]   # other node IDs for the same thing
    parent: Backend          # element ID (or an alias of one)
    description: Pulls jobs from the queue and runs them.
    src: [src/worker/]       # real repo paths
    kind: element            # element (default) | entity
  Order:
    kind: entity             # a table, class or record, e.g. from an erDiagram
    parent: Database
    description: One customer order.
sources: {}                  # written by `docdive model stamp`, do not edit
```

All keys are optional per element. Keep YAML flat and minimal; no anchors.

## What to decide, and how

- **Aliases.** Merge node IDs only when they are the same thing in the code or in the prose (`Web`/`UI`, `Worker`/`Workers`, `Operateur`/`Operator`). Pick as canonical the ID that is most used across diagrams or that matches the code name. Every alias must be a node or participant ID that really appears in a diagram, spelled exactly. Never merge two things just because the names look alike.
- **Hierarchy.** `parent` states containment: the component inside its system, the module inside its service. Use the doc structure (a page about X that draws Y), `subgraph` nesting and the code layout as evidence. No cycles, no parent that appears nowhere. Leave `parent` out when unsure.
- **Descriptions.** One sentence taken from the docs' prose. Say what it does, not what it is called. Do not invent behavior the docs do not state.
- **`src`.** Only paths that exist, relative to the repo root, found by looking at the code. A directory beats a guessed file. Omit when you cannot find the code.
- **Entities.** Declare data entities from `erDiagram` and `classDiagram` blocks as `kind: entity` with the owning element as `parent`. They show up in `docdive context`, not as clickable diagram nodes.
- **Existing frontmatter wins.** If a doc already declares `id`, `parent` or `src`, do not repeat it in the sidecar.

## Lint feedback

`docdive lint` prints `error <rule> <file>: <message>`; sidecar rules are:

| Rule | Fix |
| --- | --- |
| `sidecar-invalid` | Bad YAML or a malformed entry: fix the shape named in the message. |
| `sidecar-alias-unused` | The alias is a node in no diagram: correct the spelling or delete the alias. |
| `sidecar-alias-conflict` | Two elements claim one alias (or it equals another element's ID): keep one owner. |
| `sidecar-unknown-parent` | `parent` names nothing documented or drawn: fix it or drop it. |
| `sidecar-parent-cycle` | The parent chain loops: cut one link. |
| `sidecar-missing-src` | The path does not exist: fix or drop it. |

Warnings: `sidecar-stale-sources` (docs changed since the last stamp: review what they say, update affected entries, re-stamp) and `sidecar-orphan-element` (nothing draws it any more: delete or fix the entry).

## Limits

Written for folders up to about 100 files. Do not call any LLM API from docdive; you are the inference. Do not run `lint --fix`: it edits the docs.
