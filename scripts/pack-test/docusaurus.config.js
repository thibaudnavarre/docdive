/** @type {import('@docusaurus/types').Config} */
module.exports = {
  title: "docdive pack test",
  url: "http://localhost",
  baseUrl: "/docdive/",
  onBrokenLinks: "warn",
  markdown: { mermaid: true },
  themes: ["@docusaurus/theme-mermaid", "docusaurus-theme-docdive"],
  presets: [["classic", { docs: { path: "docs", routeBasePath: "docs" }, blog: false, pages: false }]],
};
