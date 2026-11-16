import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

export const ROOT = join(import.meta.dirname, "..");
export const TOY = join(ROOT, "fixtures", "toy");
const CLI = join(ROOT, "packages", "docdive", "dist", "cli.js");

/** Runs the built docdive CLI; stderr (diagnostics) is dropped so only the data is returned. */
export const docdive = (...args: string[]): string =>
  execFileSync(process.execPath, [CLI, ...args], { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });

export const toyIndex = <T>(): T => JSON.parse(docdive("index", TOY)) as T;

/** Number of Mermaid fences in a fixture doc (path relative to fixtures/toy). */
export const fenceCount = (doc: string): number => readFileSync(join(TOY, doc), "utf8").match(/^```mermaid$/gm)?.length ?? 0;
