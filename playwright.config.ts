import { defineConfig } from "@playwright/test";

// Static builds of the two example sites over fixtures/toy, each served under /docdive/. Build first: npm run examples:build.
const site = (dir: string, port: number) => ({
  command: `node scripts/serve-static.mjs ${dir} ${port} /docdive/`,
  url: `http://localhost:${port}/docdive/docdive/index.json`,
  reuseExistingServer: true,
});

export default defineConfig({
  testDir: "e2e",
  testMatch: "*.pw.ts",
  workers: 1,
  webServer: [site("examples/docusaurus/build", 4201), site("examples/mkdocs/site", 4202)],
});
