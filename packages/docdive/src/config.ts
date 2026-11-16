import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

export const CONFIG_FILE = "docdive.config.json";

/** Defaults for `index`, `build` and `watch`; CLI flags win. Paths are relative to the config file's folder. */
export interface Config {
  docs?: string;
  src?: string;
  out?: string;
}

const KEYS = ["docs", "src", "out"] as const;

/** Reads `docdive.config.json` from `dir` (no upward search). Returns `{}` when the file is absent; paths come back absolute. */
export function loadConfig(dir: string): Config {
  const file = join(dir, CONFIG_FILE);
  if (!existsSync(file)) return {};
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(file, "utf8"));
  } catch (e) {
    throw new Error(`${CONFIG_FILE}: ${(e as Error).message}`, { cause: e });
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error(`${CONFIG_FILE}: expected a JSON object`);
  const config: Config = {};
  for (const [key, value] of Object.entries(raw)) {
    if (key === "$schema") continue;
    if (!(KEYS as readonly string[]).includes(key)) throw new Error(`${CONFIG_FILE}: unknown option "${key}" (known: ${KEYS.join(", ")})`);
    if (typeof value !== "string" || !value) throw new Error(`${CONFIG_FILE}: "${key}" must be a non-empty string`);
    config[key as (typeof KEYS)[number]] = resolve(dir, value);
  }
  return config;
}
