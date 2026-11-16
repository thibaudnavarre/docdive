---
id: system
slug: /
src: [packages/]
---

# docdive system

docdive indexes Mermaid diagrams in Markdown docs. `DocdiveCli` builds the model and assets at build time, `DocdiveElement` renders the diagrams in the browser, and the SSG adapters wire both into a documentation site.

```mermaid
flowchart LR
  MarkdownDocs --> DocdiveCli
  DocdiveCli -->|index.json, contexts.json, element assets| DocdiveElement
  DocusaurusAdapter -->|runs build and watch| DocdiveCli
  MkdocsAdapter -->|runs build| DocdiveCli
  DocusaurusAdapter -->|mounts| DocdiveElement
  MkdocsAdapter -->|wraps fences for| DocdiveElement
  DocdiveElement --> Browser
```

- `DocdiveCli`: indexer, linter and context renderer. Holds all product logic.
- `DocdiveElement`: the `<docdive-diagram>` web component.
- `DocusaurusAdapter` and `MkdocsAdapter`: data-only glue; no product logic.
