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
plugin. Optional theme option `sourceUrl`: template for the panel's Source link, with `{path}` (doc path relative to
the docs dir) and `{line}`, e.g. `https://git.example.com/org/repo/src/main/docs/{path}#L{line}`. Wins over `editUrl`.

## Source link

Selecting a node can show a **Source** link that opens the repo page at the Markdown line where the node is declared
(or first mentioned). The URL comes from the docs plugin's `editUrl`: a GitHub `/edit/` or GitLab `/-/edit/` URL is
rewritten to its `/blob/` view with `#L<line>`. Other hosts need `sourceUrl`. With neither, the link is hidden.

The same edit URL turns the panel's `src` paths and the state entities declared with `entities:` into links to the
repo (`https://github.com/org/repo/blob/main/<path>`). Other hosts, or a branch name containing `/`, need the theme
option `srcUrl`: a template with `{path}` (repo-root-relative), e.g. `https://git.example.com/org/repo/src/main/{path}`.
Files that exist under the repo root (theme option `root`, relative to the site dir, default `.`) are copied into
`<site>/docdive/src/` and a plain click shows them in the page; ⌘/ctrl-click still opens the repo. Directories only link.

## Dev mode

`docusaurus start` works with no extra config. The theme runs `docdive watch` on the docs folder, writes its output to
`.docusaurus/docdive/` and serves it at `<baseUrl>docdive/`. Diagrams are interactive right away. After you edit a
Markdown file, reload the page to see the new data (no auto-reload). A build error in the docs is logged and the last
good data is kept. `docusaurus build` is unchanged.

Peers: `@docusaurus/core` and `@docusaurus/theme-mermaid` ^3.10, `mermaid` >=11.6 <13. Requires Node >= 22.12. MIT.

Overview page: write `<docdive-map></docdive-map>` in any Markdown page to show the element tree and the flows, each
linking to its page. The element script is loaded on every page, so no extra setup is needed.
