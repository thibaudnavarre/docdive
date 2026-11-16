# docusaurus-theme-docdive

[docdive](https://github.com/thibaudnavarre/docdive) adapter for Docusaurus 3: renders Mermaid fences as interactive
`<docdive-diagram>` elements and, after the build, writes the index and assets to `build/docdive/`.

```bash
npm install docusaurus-theme-docdive
```

```js
// docusaurus.config.js
module.exports = {
  markdown: { mermaid: true },
  // docdive must come after theme-mermaid
  themes: ["@docusaurus/theme-mermaid", "docusaurus-theme-docdive"],
};
```

Remove the theme line and the site falls back to the native Mermaid component. The docs folder is taken from the docs
plugin. Optional theme option: `src` (repo root that `src:` frontmatter paths are relative to, relative to the site dir).

## Dev mode

`docusaurus start` works with no extra config. The theme runs `docdive watch` on the docs folder, writes its output to
`.docusaurus/docdive/` and serves it at `<baseUrl>docdive/`. Diagrams are interactive right away. After you edit a
Markdown file, reload the page to see the new data (no auto-reload). A build error in the docs is logged and the last
good data is kept. `docusaurus build` is unchanged.

Peers: `@docusaurus/core` and `@docusaurus/theme-mermaid` ^3.10, `mermaid` >=11.6 <13. Requires Node >= 22.12. MIT.
