// docdive documents itself: the docs path is docs/architecture, `src` is the repo root for `src:` frontmatter paths.
/** @type {import('@docusaurus/types').Config} */
module.exports = {
  title: "docdive architecture",
  url: "http://localhost",
  baseUrl: "/",
  onBrokenLinks: "warn",
  markdown: { mermaid: true },
  // Order matters: the docdive theme must come after theme-mermaid so @theme-init/Mermaid points at it.
  themes: ["@docusaurus/theme-mermaid", ["docusaurus-theme-docdive", { src: "../.." }]],
  presets: [
    [
      "classic",
      {
        docs: { path: "../../docs/architecture", routeBasePath: "/" },
        blog: false,
        pages: false,
      },
    ],
  ],
};
