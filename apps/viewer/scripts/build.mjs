import { build } from "esbuild";
import { copyFileSync, mkdirSync, rmSync } from "node:fs";

rmSync("dist", { recursive: true, force: true });
mkdirSync("dist", { recursive: true });
await build({
  entryPoints: ["src/main.ts"],
  bundle: true,
  format: "esm",
  splitting: true,
  outdir: "dist",
  target: "es2022",
  logLevel: "error",
});
for (const f of ["index.html", "viewer.css"]) copyFileSync(f, `dist/${f}`);
