import { defineConfig } from "@playwright/test";

// Static builds of the two example sites (with and without the docdive adapter), each served under /docdive/.
// Build first: npm run examples:build.
const site = (dir: string, port: number, probe: string) => ({
  command: `node scripts/serve-static.mjs ${dir} ${port} /docdive/`,
  url: `http://localhost:${port}/docdive/${probe}`,
  reuseExistingServer: true,
});

export default defineConfig({
  testDir: "e2e",
  testMatch: ["ssg.pw.ts", "trace-context.pw.ts", "host-mermaid.pw.ts"],
  workers: 1,
  webServer: [
    site("examples/docusaurus/build", 4201, "docdive/index.json"),
    site("examples/mkdocs/site", 4202, "docdive/index.json"),
    site("examples/docusaurus/build-plain", 4203, "docs/architecture/system"),
    site("examples/mkdocs/site-plain", 4204, "architecture/system/"),
    site("examples/docusaurus/build-mermaid11", 4205, "docdive/index.json"),
  ],
});
