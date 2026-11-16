---
id: DocdiveElement
parent: system
src: [packages/docdive-element/src/element.ts, packages/docdive-element/src/shared.ts, packages/docdive-element/src/mermaid-resolver.ts, packages/docdive-element/scripts/build.mjs]
---

# DocdiveElement

`<docdive-diagram>` renders one Mermaid fence into an open shadow root, maps SVG nodes to IDs through `index.json`, and shows an info panel on click.

```mermaid
flowchart TD
  DiagramComponent --> MermaidResolver
  DiagramComponent --> SvgAnnotator
  DiagramComponent --> InfoPanel
  DiagramComponent --> Breadcrumb
  DiagramComponent --> ScenarioTrace
  SvgAnnotator --> SharedHelpers
  Breadcrumb --> SharedHelpers
  ScenarioTrace --> SharedHelpers
  InfoPanel --> SharedHelpers
```

- `DiagramComponent` (`element.ts`): lifecycle, JSON loading (`index.json`, `docdive-map.json`, `contexts.json`), click handling.
- `MermaidResolver` (`mermaid-resolver.ts`): host instance from `setMermaid`, then `window.mermaid`, then a lazily bundled copy.
- `SvgAnnotator` (`shared.ts`): tags flowchart nodes and sequence participants with element IDs.
- `InfoPanel`: shows the selected element's fields, a "Copy context" button (text from `contexts.json`), a "Copy link" button (current page URL with `docdive-select` plus the active `docdive-scenario`/`docdive-step`, restored on load) and an "Open" link emitting a cancelable `docdive-navigate` event.
- `Breadcrumb`: `<nav data-docdive-breadcrumb>` above the diagram, root ancestor down to the element owning the page (`data-docdive-crumb="<id>"`, the last one `aria-current="page"`). Ancestors with a mapped URL are links that carry the active trace and emit `docdive-navigate`; others are plain text. Absent when the doc has no owner, several owners or an owner without parent; a parent cycle ends the trail at the first repeat.
- `ScenarioTrace`: play/pause/step bar, shown when a scenario touches the diagram; state in the `docdive-scenario` and `docdive-step` query params.
- `SharedHelpers` (`shared.ts`): index types, panel fields, breadcrumb trail, trace application.
- Built by esbuild (`scripts/build.mjs`) into `dist/`, which `DocdiveCli` copies at build time.
