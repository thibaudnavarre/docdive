# docdive-element

The web components of [docdive](https://github.com/thibaudnavarre/docdive):

- `<docdive-diagram>` renders one Mermaid fence, maps its nodes to a docdive `index.json`, and adds the inspector
  (description, "Dive into", relations, source, copy context / copy link), the scenario player and the breadcrumb.
  Boxes with a diagram of their own are drawn heavier; click one (or focus it and press Enter) to inspect it. When the
  element is at least 960px wide the inspector docks to the right of the diagram, otherwise it sits below.
  The player is one play/pause glyph, a rail you click, drag or move with ←/→ (one mark per step; a dot marks the
  steps that write state) and the step sentence. A sequence diagram keeps its natural width: the diagram card
  scrolls and follows the active message, and clicking a message jumps to its step. Under it, the state strip shows what each participant holds at
  this step, read from the scenario's `Note over X: Entity k=v …` lines, by participant or by entity (each entity's
  trail across the steps); the inspector repeats the selected element's state. Fields are listed alphabetically.
- `<docdive-map>` is the system at a glance: the element tree and the flows, each linking to its page. Drop
  `<docdive-map></docdive-map>` into any Markdown page of a site using one of the adapters.

Most sites use it through `docusaurus-theme-docdive` or `mkdocs-docdive`. To use it directly, serve the output of
`docdive build` and load the element as a module:

```html
<script type="module" src="/docdive/docdive-element.js"></script>
<docdive-diagram doc="architecture/system.md" n="0" source="flowchart LR&#10;  API --> OrderService"></docdive-diagram>
<docdive-map></docdive-map>
```

Mermaid: the element uses an instance given to `setMermaid(...)`, then a valid `window.mermaid`, then a lazily loaded
bundled Mermaid 12. Optional peer: `mermaid >=11.6 <13`.

Theming: both elements follow the host's light/dark scheme (Docusaurus `data-theme`, Material `data-md-color-scheme`,
else `prefers-color-scheme`) and inherit the host font. Override with CSS custom properties:

```css
docdive-diagram, docdive-map { --docdive-accent: #0ea5e9; --docdive-radius: 6px; }
docdive-diagram::part(panel) { box-shadow: none; }
```

Tokens: `--docdive-bg`, `--docdive-surface`, `--docdive-surface-2`, `--docdive-fg`, `--docdive-fg-muted`,
`--docdive-border`, `--docdive-accent`, `--docdive-on-accent`, `--docdive-selected`, `--docdive-ok`, `--docdive-error`,
`--docdive-node-fill`, `--docdive-node-stroke`, `--docdive-edge`, `--docdive-font`, `--docdive-font-mono`,
`--docdive-radius`, `--docdive-space`, `--docdive-duration`, `--docdive-shadow`. Parts: `crumbs`, `trace`, `state`, `diagram`,
`panel` on `docdive-diagram`, `map` on `docdive-map`. Mermaid `classDef`, `style` and `linkStyle` always win over the
defaults, and motion respects `prefers-reduced-motion`.

MIT.
