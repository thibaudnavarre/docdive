// CommonJS on purpose: Docusaurus loads theme modules through jiti, which cannot evaluate `import.meta`.
const { execFileSync, spawn } = require("node:child_process");
const { mkdirSync, writeFileSync } = require("node:fs");
const { dirname, join, relative, resolve, sep } = require("node:path");

const docdiveCli = join(dirname(require.resolve("docdive/package.json")), "dist", "cli.js");

let watcherStarted = false;

/**
 * docdive adapter for Docusaurus. A theme (not a plain plugin), listed after @docusaurus/theme-mermaid so its
 * Mermaid component wraps @theme-init/Mermaid. Data only: the product logic lives in the `docdive` CLI.
 *
 * Options: `src` (repo root for `src:` frontmatter paths, relative to the site dir; optional).
 */
module.exports = function docdiveTheme(context, options = {}) {
  let docsDir;
  let docMap = {};
  const devDir = join(context.generatedFilesDir, "docdive");
  const srcArgs = () => (options.src ? ["--src", resolve(context.siteDir, options.src)] : []);
  const writeMap = (dir) => {
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "docdive-map.json"), JSON.stringify(docMap, null, 2) + "\n");
  };

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
      // Re-runs on every docs reload under `docusaurus start`, which keeps the dev map fresh.
      writeMap(devDir);
    },

    // `devServer` is only read by webpack-dev-server, so `docusaurus build` is unaffected.
    configureWebpack(_config, isServer) {
      if (isServer) return {};
      return {
        devServer: {
          static: [{ directory: devDir, publicPath: `${context.baseUrl}docdive`, watch: false }],
          // onListening is only called by webpack-dev-server. Never define setupMiddlewares here: Docusaurus does.
          onListening() {
            if (watcherStarted || !docsDir) return;
            watcherStarted = true;
            const child = spawn(process.execPath, [docdiveCli, "watch", docsDir, "--out", devDir, ...srcArgs()], {
              stdio: "inherit",
            });
            process.on("exit", () => child.kill());
          },
        },
      };
    },

    async postBuild({ outDir }) {
      if (!docsDir) throw new Error("docusaurus-theme-docdive: the docs plugin has no content to index");
      const dest = join(outDir, "docdive");
      execFileSync(process.execPath, [docdiveCli, "build", docsDir, "--out", dest, ...srcArgs()], { stdio: "inherit" });
      writeMap(dest);
    },
  };
};
