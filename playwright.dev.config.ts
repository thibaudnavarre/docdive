import { defineConfig } from "@playwright/test";

// `docusaurus start` on the example site (docdive theme in dev mode), served under /docdive/.
export default defineConfig({
  testDir: "e2e",
  testMatch: "dev.pw.ts",
  workers: 1,
  webServer: {
    command: "npx docusaurus start --no-open --port 4301",
    cwd: "examples/docusaurus",
    url: "http://localhost:4301/docdive/docdive/index.json",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
