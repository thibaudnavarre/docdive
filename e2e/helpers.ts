import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Page } from "@playwright/test";

const ROOT = join(import.meta.dirname, "..");
const TOY = join(ROOT, "fixtures", "toy");
const CLI = join(ROOT, "packages", "docdive", "dist", "cli.js");

export const SITES = [
  { name: "docusaurus", origin: "http://localhost:4201" },
  { name: "mkdocs", origin: "http://localhost:4202" },
];

let built: string | undefined;
/** `docdive build fixtures/toy` into a temp folder, once per worker. */
function toyBuild(file: string): unknown {
  if (!built) {
    built = mkdtempSync(join(tmpdir(), "docdive-e2e-"));
    execFileSync(process.execPath, [CLI, "build", TOY, "--out", built], { stdio: "ignore" });
  }
  return JSON.parse(readFileSync(join(built, file), "utf8"));
}
export const toyIndex = <T>(): T => toyBuild("index.json") as T;
export const toyContexts = (): Record<string, string> => toyBuild("contexts.json") as Record<string, string>;

/** Doc path -> page URL, written by the adapter next to the index. */
export async function docMap(origin: string): Promise<Record<string, string>> {
  return (await (await fetch(`${origin}/docdive/docdive/docdive-map.json`)).json()) as Record<string, string>;
}

export function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  return errors;
}
