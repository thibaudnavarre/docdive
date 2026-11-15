// Docusaurus site over the toy fixture, served under /docdive/.
// DOCDIVE_ADAPTER=off builds the same site without the docdive theme (deletability check).
const path = require("node:path");

const adapter = process.env.DOCDIVE_ADAPTER !== "off";
// DOCDIVE_HOST_MERMAID=11 points the site's own `mermaid` (what theme-mermaid and the docdive theme both load)
// at Mermaid 11.17.2, to check that the element works on a host instance it did not bundle.
const host11 = process.env.DOCDIVE_HOST_MERMAID === "11";
const mermaid11 = () => ({
  name: "host-mermaid-11",
  configureWebpack: () => ({
    resolve: {
      alias: {
        mermaid$: path.join(path.dirname(require.resolve("mermaid11/package.json")), "dist/mermaid.core.mjs"),
      },
    },
  }),
});

/** @type {import('@docusaurus/types').Config} */
module.exports = {
  title: "docdive example",
  url: "http://localhost",
  baseUrl: "/docdive/",
  onBrokenLinks: "warn",
  markdown: { mermaid: true },
  // Order matters: the docdive theme must come after theme-mermaid so @theme-init/Mermaid points at it.
  plugins: host11 ? [mermaid11] : [],
  themes: ["@docusaurus/theme-mermaid", ...(adapter ? ["docusaurus-theme-docdive"] : [])],
  presets: [
    [
      "classic",
      {
        docs: { path: "../../fixtures/toy", routeBasePath: "docs" },
        blog: false,
        pages: false,
      },
    ],
  ],
};
