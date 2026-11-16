# docdive

Indexer and CLI for [docdive](https://github.com/thibaudnavarre/docdive): turns Markdown docs with Mermaid diagrams
(and bare `.mmd` files) into a divable, animated system model (`index.json`) for the `<docdive-diagram>` viewer.

```bash
npx docdive lint docs --root .           # check the model (exit 1 on errors; --json lists warnings too)
npx docdive build docs --out build/docdive   # index.json, contexts.json and the viewer assets
npx docdive watch docs --out build/docdive   # same, then rebuild on every Markdown change (used by the Docusaurus dev mode)
```

The model format and the agent skill that converts existing docs to it ship in
[`skills/docdive-convert`](skills/docdive-convert/SKILL.md).

Exit codes: `0` ok, `1` errors, `2` usage. Requires Node >= 22.12. MIT.
