# COR Plan — A6 dogfood: docdive documents itself, deep-link copy through the loop

## Context

Test brief assumption **A6** ("click-to-context is a sufficient v1 agent handoff without a live endpoint", `docs/product-brief.md` §8) and the §9 **Dogfood** criterion: one real change end-to-end (diagram click → Copy context → agent → docs + code updated). Corpus = this repo's own architecture; the real change = **deep-link copy** in `<docdive-diagram>`.

### Current state

- The repo has no architecture docs about itself. The Mermaid in `docs/` sits in findings and brief files that don't follow the conventions. The only Docusaurus site, `examples/docusaurus`, points at `fixtures/toy` and is used by `e2e:ssg`, `e2e:dev` and `pack-test`.
- The conventions skill (frozen v0, the one A4 tested) is `packages/docdive/skill/conventions.md`. It writes to `docs/architecture/`.
- `docusaurus-theme-docdive` (`packages/docusaurus-theme-docdive/src/index.cjs`) indexes the docs plugin's `contentPath`. It takes an optional `src` option (repo root for `src:` paths), runs `docdive watch` under `docusaurus start` and `docdive build` in `postBuild`.
- Element URL state (`packages/docdive-element/src/element.ts`): `docdive-scenario` / `docdive-step` are read on load and carried by `openUrl()` into the child URL. **The selected element is not in the URL**: `onClick()` sets `this.selected` only in memory, and `renderPanel()` shows "Copy context" (from `contexts.json`) and "Open <id>".
- `docdive lint` defaults to `<root>/docs`, which would also pick up the findings files, so it must be given `--docs docs/architecture`.
- CI (`.github/workflows/ci.yml`) runs build, typecheck, lint, test, ruff, `examples:build`, `e2e`, `e2e:ssg`, `e2e:dev`. There is no docs lint step.

### Decisions locked in Think

| Subject | Decision | Why |
| --- | --- | --- |
| Corpus | docdive's own architecture (CLI, element, adapters) in `docs/architecture/` | Real system the owner knows, same layout as the A4 runs |
| Authoring | Fresh subagent with the conventions skill; owner reviews | Exercises the intended agent workflow |
| Host | New `apps/docs-site` Docusaurus, local only, using `docusaurus start` + watch | `examples/docusaurus` stays untouched for the e2e suites |
| Site build | Own root scripts `docs:dev` / `docs:build`; the workspace has **no** `build` script | Keeps it out of `npm run build`, CI and release |
| CI | Add `docdive lint --docs docs/architecture` | Keeps the dogfood docs valid without building the site |
| Real change | Deep-link copy: a "Copy link" action that puts on the clipboard the page URL + the selected element + the active `docdive-scenario` / `docdive-step`. On load, the link restores the same view (element selected, panel open) | Smallest brief backlog item; reuses the existing URL state |
| Deep-link edge cases | Each `<docdive-diagram>` on the page selects the element only if its diagram contains it; otherwise it ignores it silently | Multi-fence pages and stale links must not error |
| Loop agent | Fresh isolated subagent gets only the pasted context + a one-line task (that includes "with an e2e test"), with repo access | Measures whether the context alone is a sufficient handoff |
| Test gaps | cor-code only fills what the subagent missed; each gap is recorded as a miss | Keeps the measurement honest |
| Verdict | Pre-registered checklist + owner yes/no as the final gate | Same style as the A4/A7 gates |

### Scope

**In scope:** architecture docs, docs-site, CI lint step, the deep-link copy feature (element code, e2e, docs), findings doc, brief/CHANGELOG updates.
**Out of scope:** publishing the site (GitHub Pages), building it in the root build or CI, MkDocs dogfood, a dev-mode context endpoint, a week-long dogfood log, conventions-skill changes, changes to `examples/docusaurus`.

### Invariants

- `examples/docusaurus`, `fixtures/toy` and every existing e2e suite stay unchanged and green.
- `npm run build` output and the release workflow are unaffected by `apps/docs-site`.
- Existing URL params (`docdive-scenario`, `docdive-step`, `docdive-interval`) keep their meaning, and "Copy context" keeps working.
- The subagent in T07 gets no hints beyond the paste and the one-line task fixed in T01.

### Acceptance criteria

Pre-registered in `docs/dogfood-findings.md` (T01):
1. The agent found the right files from the context alone (no extra hints).
2. The code change works: checks + the new deep-link e2e + `e2e`, `e2e:ssg`, `e2e:dev` pass.
3. Docs updated in the same change; `docdive lint --docs docs/architecture` has 0 errors.

Final gate: owner yes/no after the walkthrough.

## Tasks

- [x] T01: Pre-register the A6 gate in `docs/dogfood-findings.md`: the 3 checklist items, the owner yes/no final gate, the deep-link spec, and the exact subagent prompt template (paste + one-line task with "with an e2e test"). Frozen before any run; later changes only as dated amendments
- [x] T02: Run a fresh subagent with `packages/docdive/skill/conventions.md` to write `docs/architecture/` (system, CLI, element, adapters, 1–2 scenarios, real `src:` paths); reach 0 errors on `npm run docdive -- lint --root . --docs docs/architecture`
- [x] T03: Owner reviews the architecture docs (IDs, hierarchy, scenarios make sense) [UAT]
- [x] T04: Scaffold `apps/docs-site` (Docusaurus 3.10.2 + `@docusaurus/theme-mermaid` + `docusaurus-theme-docdive` with `src` = repo root, docs path `../../docs/architecture`) with no `build` script; add root `docs:dev` / `docs:build` scripts
- [x] T05: Add a CI step in `.github/workflows/ci.yml` running `docdive lint --docs docs/architecture` after the build
- [x] T06: Check the site under `npm run docs:dev`: diagrams render, deep dive, scenario trace and Copy context work on the dogfood docs [UAT]
- [x] T07: Run the loop: the owner clicks the element in the docs-site → Copy context → a fresh isolated subagent gets only the paste + the T01 one-line task, then implements deep-link copy (code, e2e, `docs/architecture` update). Record the files it opened and any hints needed
- [x] T08: Run `npm run typecheck`, `npm run lint`, `npm test`, `uvx ruff check .`, `e2e`, `e2e:ssg`, `e2e:dev` and the docs lint on the subagent's change; fill only missing gaps and record each as a miss [integration]
- [x] T09: Owner walkthrough of deep-link copy in the docs-site (copy link → open in a new tab → same element, panel and trace step) and the A6 yes/no [UAT]
- [x] T10: Record the results against the gate in `docs/dogfood-findings.md`; update `docs/product-brief.md` (A6 row, §9 Dogfood, §10 item 5) and the CHANGELOG Unreleased entry for deep-link copy
