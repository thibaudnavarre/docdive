import { build } from "esbuild";
import { rmSync } from "node:fs";

rmSync("dist", { recursive: true, force: true });
// Ships as a directory: the entry plus lazy Mermaid chunks.
await build({
  entryPoints: { "docdive-element": "src/element.ts" },
  bundle: true,
  format: "esm",
  splitting: true,
  outdir: "dist",
  target: "es2022",
  logLevel: "error",
});
