// Docusaurus site over the toy fixture, served under /docdive/.

/** @type {import('@docusaurus/types').Config} */
module.exports = {
  title: "docdive example",
  url: "http://localhost",
  baseUrl: "/docdive/",
  onBrokenLinks: "warn",
  markdown: { mermaid: true },
  // Order matters: the docdive theme must come after theme-mermaid so @theme-init/Mermaid points at it.
  // `root`: the toy fixture is its own "repo", so its `src/` files are copied into the site and shown inline.
  themes: ["@docusaurus/theme-mermaid", ["docusaurus-theme-docdive", { root: "../../fixtures/toy" }]],
  presets: [
    [
      "classic",
      {
        docs: {
          path: "../../fixtures/toy",
          routeBasePath: "docs",
          // Feeds the panel's Source link (rewritten from /edit/ to /blob/).
          editUrl: "https://github.com/thibaudnavarre/docdive/edit/main/fixtures/toy/",
        },
        blog: false,
        pages: false,
      },
    ],
  ],
};
