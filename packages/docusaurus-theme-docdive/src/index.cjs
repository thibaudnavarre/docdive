// CommonJS on purpose: Docusaurus loads theme modules through jiti, which cannot evaluate `import.meta`.
const { execFileSync } = require("node:child_process");
const { mkdirSync, writeFileSync } = require("node:fs");
const { dirname, join, relative, resolve, sep } = require("node:path");

const docdiveCli = join(dirname(require.resolve("docdive/package.json")), "dist", "cli.js");

/**
 * docdive adapter for Docusaurus. A theme (not a plain plugin), listed after @docusaurus/theme-mermaid so its
 * Mermaid component wraps @theme-init/Mermaid. Data only: the product logic lives in the `docdive` CLI.
 *
 * Options: `src` (repo root for `src:` frontmatter paths, relative to the site dir; optional).
 */
module.exports = function docdiveTheme(context, options = {}) {
  let docsDir;
  let docMap = {};

  return {
    name: "docusaurus-theme-docdive",
    getThemePath: () => join(__dirname, "theme"),
    getClientModules: () => [join(__dirname, "client.js")],

    // doc path (relative to the docs dir) -> permalink, which already includes baseUrl.
    allContentLoaded({ allContent }) {
      const version = allContent["docusaurus-plugin-content-docs"]?.default?.loadedVersions?.[0];
      docsDir = version?.contentPath;
      docMap = {};
      for (const doc of version?.docs ?? []) {
        const abs = resolve(context.siteDir, doc.source.replace(/^@site\//, ""));
        docMap[relative(docsDir, abs).split(sep).join("/")] = doc.permalink;
      }
    },

    async postBuild({ outDir }) {
      if (!docsDir) throw new Error("docusaurus-theme-docdive: the docs plugin has no content to index");
      const dest = join(outDir, "docdive");
      const args = [docdiveCli, "build", docsDir, "--out", dest];
      if (options.src) args.push("--src", resolve(context.siteDir, options.src));
      execFileSync(process.execPath, args, { stdio: "inherit" });
      mkdirSync(dest, { recursive: true });
      writeFileSync(join(dest, "docdive-map.json"), JSON.stringify(docMap, null, 2) + "\n");
    },
  };
};
