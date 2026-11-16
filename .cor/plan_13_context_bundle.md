# COR Plan — Richer context bundle for undocumented nodes

## Context

Address the A6 dogfood known limit "thin context for undocumented nodes" (`docs/dogfood-findings.md`). The "Copy context" bundle for `InfoPanel` had no `src`, `doc: (none)` and a nearest-section excerpt cut before the matching bullet. Nodes without their own doc should carry the matching text, their inferred `src`, and their nearest ancestor's doc and `src`.

### Root cause / current state

- `packages/docdive/src/prose.ts` `sectionsOf`: consecutive non-blank lines are merged into one paragraph, so a bullet list counts as a single paragraph. `attachProse` then excerpts its first 400 chars. For `InfoPanel` (the 4th bullet of `docs/architecture/docdive-element.md:22`), the excerpt stops at `shows the selected element's …`.
- `packages/docdive/src/src.ts` `inferSrc` sets `srcInferred` (only when a src root is given, `model.ts:283`), but `context.ts` `buildContext`/`renderContextMarkdown` never output it. They show only declared `src`.
- No inheritance: `InfoPanel.parent = DocdiveElement`, which declares `doc` and 4 `src` files, but the child bundle shows `doc: (none)` and `Source: (none)`.
- `docdive context` (`run.ts:234`) calls `buildModel(root, root)` with no src root, and it has no `--src` flag. `docdive.config.json` (`config.ts`) already has a `src` key, used by index/build/watch.
- `<docdive-diagram>` refuses an `index.json` version it does not read (`version: 1`, `model.ts:56`).

### Decisions locked in Think

| Subject | Decision | Why |
| --- | --- | --- |
| Gaps in scope | Excerpt, inferred src shown, ancestor fallback | The three causes of the thin `InfoPanel` bundle |
| Excerpt boundary | The matching list item (with continuation lines), or the matching paragraph for prose; capped at ~400 chars, cut at a word boundary with `…` | Answers brief §11 "where does the nearest section end" with a rule agents can predict |
| Fallback depth | Nearest ancestor that has a doc / declared `src` (walk up the parent chain) | The direct parent may itself be undocumented |
| Inherited doc | Path only, labeled `(inherited from X)`; no parent body | Keeps the bundle small; the excerpt stays the text |
| Src precedence | Declared `src` beats everything. Otherwise show both inferred (with confidence, `via`) and inherited (`from X`), each labeled. | Declared is authoritative; guessed and inherited are complementary hints |
| Surfaces | `contexts.json`, `docdive context` (md + `--json`), new optional `index.json` element fields | One model, all outputs |
| Contract | Additive only: new optional fields, nothing renamed or removed; `index.json` stays `version: 1` | The element rejects unknown versions; 0.x consumers keep working |
| CLI src | `docdive context --src <repoRoot>`, defaulting to `src` in `docdive.config.json` | Same behavior as build/watch, so the CLI shows inferred src too |
| Corpus | Excerpt changes on the brownfield corpus are accepted by design; no corpus gate | The change is intended |

### Scope

**In scope:** list-item excerpts, `srcInferred` in the bundle, nearest-ancestor doc/src inheritance, `context --src`, unit tests, docs.
**Out of scope:** TS/JS definition inference in `inferSrc` (the `DEF` regex stays `class|module|def`), the parent doc body in the bundle, the element package and its UI, an `index.json` version bump, a corpus regression gate, re-running the A6 loop agent.

### Invariants

- Elements with their own `doc` and declared `src` produce the same bundle as before.
- Existing `index.json` fields keep their names, shapes and meaning; `version` stays 1.
- The `docdive-element` API and the `contexts.json` shape (`{ id: markdown }`) are unchanged.

### Acceptance criteria

- Unit tests cover the excerpt rule, the ancestor walk, precedence, rendering and `context --src`. All checks pass.
- The docs-site `InfoPanel` bundle in `contexts.json` shows:
  - the full `InfoPanel` bullet
  - `doc: docdive-element.md (inherited from DocdiveElement)`
  - `packages/docdive-element/src/element.ts` among the inherited `src`

## Tasks

- [x] T01: Excerpt by list item.
  - In `prose.ts` `sectionsOf`, each list item (`-`/`*`/`+`/`1.`, plus its continuation lines) becomes its own unit.
  - `attachProse` excerpts the matching item or paragraph, capped at ~400 chars and cut at a word boundary with `…`.
- [x] T02: Unit tests for the excerpt rule. A match in the 4th item of a list returns that item; a long item is cut at a word boundary; plain paragraphs are unchanged. [unit]
- [x] T03: Inheritance in `model.ts`, after `attachProse`/`inferSrc`.
  - An element with no `doc` gets an optional `docInherited: { path, from }` from the nearest ancestor that has a doc.
  - An element with no declared `src` gets an optional `srcInherited: { paths, from }` from the nearest ancestor that declares `src`.
  - Add both as optional fields on `Element`.
- [x] T04: Bundle and rendering in `context.ts`.
  - `ContextBundle` gains the optional `srcInferred`, `docInherited` and `srcInherited` fields.
  - `renderContextMarkdown` prints `doc: X (inherited from Y)`.
  - The Source section lists declared, then inferred (`path (inferred, confidence, via)`), then inherited (`path (inherited from Y)`).
- [x] T05: `docdive context` accepts `--src <repoRoot>`, defaulting to `src` in `docdive.config.json`, and passes it to `buildModel` for both single-element and `--all`. Update the usage text.
- [x] T06: Unit tests for T03–T05 [unit]:
  - nearest-ancestor walk, skipping an undocumented parent
  - declared values beat inherited ones
  - inferred and inherited `src` shown together
  - md and `--json` output
  - `context --src` and its config default
- [x] T07: Docs:
  - context section of `packages/docdive/README.md`
  - CHANGELOG Unreleased entry
  - answer the brief §11 "nearest section" question in `docs/product-brief.md`
  - mark the "thin context" limit in `docs/dogfood-findings.md` as addressed
- [x] T08: Build the docs-site (`npm run docs:build`) and check that the `InfoPanel` entry in `apps/docs-site/build/docdive/contexts.json` meets the acceptance criteria. [UAT]
