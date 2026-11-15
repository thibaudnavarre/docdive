import { execFileSync } from "node:child_process";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";

const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".md": "text/markdown" };
const port = Number(process.env.PORT ?? 4173);
const app = resolve(import.meta.dirname, "..");
const fixtures = resolve(process.env.FIXTURES ?? join(app, "../../fixtures"));
const cli = resolve(app, "../../packages/docdive/dist/cli.js");

// The index is generated, never stored next to the docs: build it once at startup.
const toyIndex = execFileSync(process.execPath, [cli, "index", join(fixtures, "toy")], { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] });

// `/toy/*` is served from the fixtures folder; everything else from the built viewer.
createServer(async (req, res) => {
  const path = normalize(new URL(req.url ?? "/", "http://x").pathname).replace(/^(\.\.[/\\])+/, "");
  if (path === "/toy/index.json") return void res.writeHead(200, { "content-type": TYPES[".json"] }).end(toyIndex);
  const file = path.startsWith("/toy/") ? join(fixtures, path) : join(app, "dist", path === "/" ? "index.html" : path);
  try {
    const body = await readFile(file);
    res.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream" });
    res.end(body);
  } catch {
    res.writeHead(404).end("not found");
  }
}).listen(port, () => console.log(`viewer on http://localhost:${port}`));
