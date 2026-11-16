# COR Plan — Agent-built model sidecar

## Context

Make docdive model **any** documentation folder, not only docs written to its conventions. A coding agent, driven by a skill shipped in the `docdive` package, reads the docs and writes a committed sidecar model. The indexer merges it into `index.json` deterministically and lints it.

### Root cause / current state

- The model comes only from exact node IDs reused across diagrams plus doc frontmatter (`id`, `parent`, `src`). Brownfield docs have neither: A1 is "gate passed, assumption not validated" ([brownfield-findings-2.md](../docs/brownfield-findings-2.md)); A8 showed speed only, no correctness gain ([day0-findings.md](../docs/day0-findings.md)).
- On `AIR_FRANCE_ANALYSE_EAUX/_retrodoc` (12 `.md` and 6 `.mmd` files, no frontmatter): no zoom levels, no element docs, no `src`. Variant IDs for one concept (`Web`/`UI`, `Worker`/`Workers`, `Operateur`/`Operator`). `erDiagram`/`classDiagram` are counted but not modelled.
- Only `flowchart` and `sequenceDiagram` are extracted (`packages/docdive/src/model.ts`). The viewer maps SVG nodes by `diagram.nodes.includes(id)` (`packages/docdive-element/src/shared.ts:40`, `:129`, `:229`).
- `.mmd` indexing is implemented but uncommitted: `loader.ts` (`DOC_EXT`, `parseDoc` with an empty body), `infer.ts`, `model.ts`, `run.ts`, `brownfield.test.ts`, `apps/viewer/src/main.ts`.

### Decisions locked in Think

| Subject | Decision | Why |
| --- | --- | --- |
| Who infers | The user's coding agent, via a skill shipped in `packages/docdive/skill/`. No LLM or API key inside docdive. | Follows D6 (CLI → skill → MCP). The indexer stays deterministic and testable. |
| Storage | Committed sidecar `docdive.model.yaml` at the docs root. Docs are never edited by the skill. | Reviewable diff; keeps D9 (deletable, docs untouched). |
| What is inferred | Alias merging, hierarchy, descriptions from prose, `src` links, ER/class entities. | Owner wants all five. |
| Precedence | Doc frontmatter > sidecar > deterministic inference. | Explicit author intent wins over agent guesses. |
| Staleness | Sidecar records `sources: {path: sha}`. Lint **warns** on changed or missing sources and on entries whose IDs no longer appear; the agent re-runs the skill on those. | Docs keep changing; lint warns instead of blocking the build. |
| ER/class in viewer | Model only for v1 (entities appear in context bundles). Clickable later. | Keeps v1 small. |
| Scale | ≤ ~100 files for v1. | Large sites need chunked agent passes; deferred. |

### Scope

**In scope:** `.mmd` indexing; sidecar schema, loader, merge, lint, `model stamp` command; node→element mapping in the shared viewer code; context bundle fields; `SKILL.md`; tests; `_retrodoc` trial.
**Out of scope:** docdive calling an LLM API; headless or CI inference; clickable ER/class diagrams; deterministic ER/class extractors; large-site chunking; MCP.

### Invariants

- Without a sidecar, `index.json` and all CLI output stay byte-identical to today.
- `index.json` changes are additive optional fields only.
- Docusaurus and MkDocs adapters keep working unchanged (they call `docdive build`, which picks up the sidecar on its own).
- The skill writes only `docdive.model.yaml`, never the docs.

### Acceptance criteria

On a copy of `_retrodoc` with an agent-written, lint-clean sidecar, the owner confirms in the viewer:

- deep dive from the system view into a component;
- a scenario lights up across diagrams, including nodes reached through aliases;
- `docdive context <id>` returns a useful bundle (description, aliases, parent/children, entities, `src`).

## Tasks

- [x] T01: Land `.mmd` indexing (already implemented, uncommitted) and mention `.mmd` in the README and `skill/conventions.md`.
- [x] T02: Define the `docdive.model.yaml` schema. Per element: `aliases`, `parent`, `description`, `src`, `kind` (`element` | `entity`). Plus top-level `sources: {path: sha}`. The loader parses and validates it; bad YAML or a bad shape becomes a diagnostic, not a crash.
- [x] T03: Merge the sidecar into the model with frontmatter > sidecar > inference. Alias node IDs resolve to the canonical element in `appearsIn`, `children` and scenario participants. Add optional `aliases`, `description`, `origin` on elements and an optional `nodeElement` (node ID → element ID) map on diagrams.
- [ ] T04: Add sidecar lint rules. Errors: alias used by no diagram, alias claimed by two elements, unknown parent or parent cycle, missing `src`. Warnings: changed or missing `sources`, listing the affected entries.
- [ ] T05: Add `docdive model stamp <folder>` to write the `sources` hashes into the sidecar.
- [ ] T06: In `packages/docdive-element/src/shared.ts`, resolve SVG node → element through `nodeElement` (fall back to the node ID), so highlight, deep dive and scenario trace work across aliases. Show `description` in the panel.
- [ ] T07: Show `aliases`, `description` and entity children in the `docdive context` bundle.
- [ ] T08: Write `packages/docdive/skill/SKILL.md`: workflow (`docdive index` → read docs and code → write sidecar → `docdive model stamp` → `docdive lint` → fix) and guidance on judging merges, hierarchy, descriptions, `src` and entities.
- [ ] T09: Unit tests: sidecar parsing and validation, merge precedence, alias resolution, each lint rule, and the no-sidecar byte-identical invariant. [unit]
- [ ] T10: A fresh agent runs the skill on a copy of `_retrodoc`; the resulting sidecar must lint clean. [integration]
- [ ] T11: Owner walkthrough in the viewer on the `_retrodoc` copy: deep dive, scenario trace across aliases, context bundle. [UAT]
