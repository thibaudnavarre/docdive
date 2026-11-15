import { defineConfig } from "@playwright/test";

// Standalone viewer over the toy fixture.
export default defineConfig({
  testDir: "e2e",
  testMatch: "viewer.pw.ts",
  use: { baseURL: "http://localhost:4173" },
  webServer: {
    command: "npm run serve --workspace docdive-viewer",
    url: "http://localhost:4173",
    reuseExistingServer: true,
  },
});
