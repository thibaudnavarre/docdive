import { loadDocs } from "./loader.js";
import { buildModel, globalElements } from "./model.js";

export interface FloorStats {
  docs: number;
  parentLinks: number;
  scenarios: number;
  sharedIds: number;
  floorMet: boolean;
}

/** Non-vacuity floor from the A4 pre-registration: a clean lint on an empty model must not count. */
export function floorStats(docsFolder: string, repoRoot: string): FloorStats {
  const docs = loadDocs(docsFolder, repoRoot);
  const index = buildModel(docsFolder, repoRoot);
  const parentLinks = docs.filter((d) => typeof d.frontmatter.parent === "string" && d.frontmatter.parent.trim()).length;
  const scenarios = index.diagrams.filter((d) => d.type === "sequence" && d.edges.length > 0).length;
  const sharedIds = Object.values(globalElements(index.elements)).filter((el) => new Set(el.appearsIn).size >= 2).length;
  return {
    docs: docs.length,
    parentLinks,
    scenarios,
    sharedIds,
    floorMet: docs.length >= 5 && parentLinks >= 1 && scenarios >= 1 && sharedIds >= 5,
  };
}
