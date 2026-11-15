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

Peers: `@docusaurus/core` and `@docusaurus/theme-mermaid` ^3.10, `mermaid` >=11.6 <13. Requires Node >= 22.12. MIT.
