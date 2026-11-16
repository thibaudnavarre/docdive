# docdive-element

The `<docdive-diagram>` web component of [docdive](https://github.com/thibaudnavarre/docdive). It renders one Mermaid
fence, maps its nodes to a docdive `index.json`, and adds the info panel, deep dive, scenario trace and "copy context".

Most sites use it through `docusaurus-theme-docdive` or `mkdocs-docdive`. To use it directly, serve the output of
`docdive build` and load the element as a module:

```html
<script type="module" src="/docdive/docdive-element.js"></script>
<docdive-diagram doc="architecture/system.md" n="0" source="flowchart LR&#10;  API --> OrderService"></docdive-diagram>
```

Mermaid: the element uses an instance given to `setMermaid(...)`, then a valid `window.mermaid`, then a lazily loaded
bundled Mermaid 12. Optional peer: `mermaid >=11.6 <13`.

Theming: the element follows the host's light/dark scheme (Docusaurus `data-theme`, Material `data-md-color-scheme`,
else `prefers-color-scheme`). Override it with CSS custom properties on `docdive-diagram`:

```css
docdive-diagram { --docdive-accent: #0ea5e9; --docdive-radius: 4px; }
```

Available: `--docdive-bg`, `--docdive-border`, `--docdive-accent`, `--docdive-error`, `--docdive-node-fill`,
`--docdive-node-stroke`, `--docdive-edge`, `--docdive-radius`, `--docdive-space`, `--docdive-duration`. Mermaid
`classDef`, `style` and `linkStyle` always win over the defaults, and trace animation respects `prefers-reduced-motion`.

MIT.
