import js from "@eslint/js";
import { defineConfig } from "eslint/config";
import tseslint from "typescript-eslint";

export default defineConfig(
  {
    ignores: [
      "corpus/",
      "**/node_modules/",
      "**/dist/",
      "**/dist-*/",
      "**/build/",
      "**/build-*/",
      "**/site/",
      "**/site-*/",
      "**/test-results/",
      "**/playwright-report/",
      "**/.docusaurus/",
      "fixtures/",
      ".agents/",
      ".claude/",
      ".github/extensions/",
    ],
  },
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    files: ["packages/docusaurus-theme-docdive/src/**/*.{js,cjs}", "**/docusaurus.config.js"],
    languageOptions: { globals: { process: "readonly", window: "readonly", console: "readonly", __dirname: "readonly", require: "readonly", module: "writable" } },
  },
  { files: ["**/*.cjs", "**/docusaurus.config.js"], rules: { "@typescript-eslint/no-require-imports": "off" } },
  {
    files: ["**/*.mjs", "**/*.cjs"],
    languageOptions: { globals: { process: "readonly", URL: "readonly", console: "readonly" } },
  },
);
