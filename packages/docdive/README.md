# docdive

Indexer and CLI for [docdive](https://github.com/thibaudnavarre/docdive): turns a Markdown folder with plain Mermaid
diagrams (or bare `.mmd` files) into a system model (`index.json`), lints it, and renders agent-ready context for any element.

```bash
npx docdive lint --docs docs
npx docdive context OrderService --folder docs
npx docdive build docs --out build/docdive   # index.json, contexts.json and the <docdive-diagram> assets
npx docdive watch docs --out build/docdive   # same, then rebuild index.json and contexts.json on every Markdown or `.mmd` change
```

## Config file

An optional `docdive.config.json` in the folder you run `docdive` from sets defaults for `index`, `build` and `watch`:

```json
{ "docs": "docs", "src": ".", "out": "build/docdive" }
```

Then `npx docdive build` is enough. The `<folder>` argument, `--src` and `--out` override the file. Paths are relative to
the file. Unknown keys and non-string values are errors. `index` still prints to stdout unless `--out` is passed.

## Normalizing IDs with an agent

`docdive init <folder>` prints an adoption report (`--json` for the raw data). `docdive init <folder> --agent` prints one
prompt instead, to paste into your coding agent: the top 20 pairs of near-duplicate IDs (edit distance, e.g.
`Workflow` / `Workflows`) with the files where each appears, the rule "merge only if both name the same concept, report
each decision", and the conventions. It starts with `docdive lint --fix --docs <folder>`, which already merges the pure
spelling variants. It prints `nothing to normalize` when there is no pair. `--agent` and `--json` cannot be combined.

## Context bundles

`docdive context <id> --folder docs [--src <repoRoot>]` prints what an agent needs about one element. For an element without
its own doc, the "nearest section" is the matching list item or paragraph (about 400 characters, cut at a word boundary).
The bundle also lists the inferred `src` (with `--src`, or `src` in `docdive.config.json`) and falls back to the nearest
ancestor's doc and declared `src`, labeled `inherited from <ancestor>`. Declared `doc` and `src` always win.

Binaries: `docdive` and `ddv`. Run `docdive --help` for every command. Exit codes: `0` ok, `1` errors, `2` usage.

The authoring conventions for coding agents ship in `skill/conventions.md`. For docs that do not follow them, `skill/SKILL.md` has an agent write a committed `docdive.model.yaml` (aliases, hierarchy, descriptions, `src`, entities); `docdive model stamp <folder>` records the doc hashes so `docdive lint` can flag a stale model.

Requires Node >= 22.12. MIT.
