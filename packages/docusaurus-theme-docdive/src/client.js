import siteConfig from "@generated/docusaurus.config";

// The element is a standalone ESM bundle that `docdive build` copies to <outDir>/docdive/ at build time.
// Hand it the site's own Mermaid so only one copy is on the page; the element never initializes it.
if (typeof window !== "undefined") {
  const url = `${siteConfig.baseUrl}docdive/docdive-element.js`;
  window.__docdiveLoad = import(/* webpackIgnore: true */ url).then((element) => {
    element.setMermaid(() => import("mermaid"));
    return element;
  });
}
