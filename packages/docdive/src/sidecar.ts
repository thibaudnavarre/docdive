import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";

export const SIDECAR_NAME = "docdive.model.yaml";

export type SidecarKind = "element" | "entity";

export interface SidecarElement {
  aliases: string[];
  parent?: string;
  description?: string;
  src: string[];
  kind: SidecarKind;
}

export interface Sidecar {
  /** Docs root-relative path of the sidecar file. */
  file: string;
  /** Doc path (relative to the docs root) -> content hash recorded by `docdive model stamp`. */
  sources: Record<string, string>;
  elements: Record<string, SidecarElement>;
}

export interface SidecarProblem {
  rule: "sidecar-invalid";
  file: string;
  message: string;
  element?: string;
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const isStringList = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === "string");

function parseElement(raw: unknown, problem: (message: string) => void): SidecarElement | null {
  const bad = (message: string) => {
    problem(message);
    return null;
  };
  if (!isRecord(raw)) return bad("element must be a mapping");
  const { aliases = [], parent, description, src = [], kind = "element" } = raw;
  if (!isStringList(aliases)) return bad("`aliases` must be a list of strings");
  if (!isStringList(src)) return bad("`src` must be a list of strings");
  if (parent !== undefined && typeof parent !== "string") return bad("`parent` must be a string");
  if (description !== undefined && typeof description !== "string") return bad("`description` must be a string");
  if (kind !== "element" && kind !== "entity") return bad("`kind` must be `element` or `entity`");
  return { aliases, src, kind, ...(parent !== undefined && { parent }), ...(description !== undefined && { description }) };
}

/** Read `<folder>/docdive.model.yaml`. A missing file is not an error; a bad file or entry becomes a problem, never a throw. */
export function loadSidecar(folder: string): { sidecar: Sidecar | null; problems: SidecarProblem[] } {
  const path = join(folder, SIDECAR_NAME);
  if (!existsSync(path)) return { sidecar: null, problems: [] };
  const problems: SidecarProblem[] = [];
  const fail = (message: string, element?: string) =>
    problems.push({ rule: "sidecar-invalid", file: SIDECAR_NAME, message, ...(element && { element }) });

  let data: unknown;
  try {
    data = parse(readFileSync(path, "utf8"));
  } catch (error) {
    fail(`invalid YAML: ${(error as Error).message.split("\n")[0]}`);
    return { sidecar: null, problems };
  }
  if (data === null || data === undefined) return { sidecar: { file: SIDECAR_NAME, sources: {}, elements: {} }, problems };
  if (!isRecord(data)) {
    fail("top level must be a mapping with `sources` and `elements`");
    return { sidecar: null, problems };
  }

  const sources: Record<string, string> = {};
  if (data.sources !== undefined) {
    if (!isRecord(data.sources)) fail("`sources` must map a doc path to a hash");
    else
      for (const [doc, sha] of Object.entries(data.sources)) {
        if (typeof sha === "string") sources[doc] = sha;
        else fail(`\`sources.${doc}\` must be a string`);
      }
  }

  const elements: Record<string, SidecarElement> = {};
  if (data.elements !== undefined) {
    if (!isRecord(data.elements)) fail("`elements` must map an element ID to its entry");
    else
      for (const [id, raw] of Object.entries(data.elements)) {
        const el = parseElement(raw, (message) => fail(`${id}: ${message}`, id));
        if (el) elements[id] = el;
      }
  }
  return { sidecar: { file: SIDECAR_NAME, sources, elements }, problems };
}
