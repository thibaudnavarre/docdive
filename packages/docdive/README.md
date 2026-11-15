# docdive

Indexer and CLI for [docdive](https://github.com/thibaudnavarre/docdive): turns a Markdown folder with plain Mermaid
diagrams into a system model (`index.json`), lints it, and renders agent-ready context for any element.

```bash
npx docdive lint --docs docs
npx docdive context OrderService --folder docs
npx docdive build docs --out build/docdive   # index.json, contexts.json and the <docdive-diagram> assets
```

Binaries: `docdive` and `ddv`. Run `docdive --help` for every command. Exit codes: `0` ok, `1` errors, `2` usage.

The authoring conventions for coding agents ship in `skill/conventions.md`.

Requires Node >= 22.12. MIT.
