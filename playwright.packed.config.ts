import { defineConfig } from "@playwright/test";

// The sites built by scripts/pack-test.sh from the packed tarballs, served under /docdive/.
const dir = process.env.PACK_DIR;
if (!dir) throw new Error("PACK_DIR is not set; run scripts/pack-test.sh");

const site = (path: string, port: number) => ({
  command: `node scripts/serve-static.mjs ${dir}/${path} ${port} /docdive/`,
  url: `http://localhost:${port}/docdive/docdive/index.json`,
  reuseExistingServer: false,
});

export default defineConfig({
  testDir: "e2e",
  testMatch: "packed.pw.ts",
  workers: 1,
  webServer: [site("docusaurus/build", 4301), site("mkdocs/site", 4302)],
});
