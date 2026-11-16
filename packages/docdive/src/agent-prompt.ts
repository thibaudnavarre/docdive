import { readFileSync } from "node:fs";
import type { Index } from "./model.js";

const MAX_PAIRS = 20;

interface Pair {
  a: string;
  b: string;
  confidence: number;
}

const MAX_FILES = 5;

const files = (index: Index, id: string): string => {
  const el = index.elements[id];
  const all = [...new Set((el?.appearsIn ?? []).map((d) => d.slice(0, d.lastIndexOf("#"))))].sort();
  // An ID declared only in frontmatter has no diagram appearance; its doc is still where the agent must look.
  if (!all.length) return el?.doc ?? "-";
  return all.slice(0, MAX_FILES).join(", ") + (all.length > MAX_FILES ? ` (+${all.length - MAX_FILES} more)` : "");
};

/** conventions.md minus its `## Lint feedback` section: that part addresses the lint-loop agent and forbids running commands, which this prompt asks for. */
export function loadConventions(): string {
  const text = readFileSync(new URL("../skill/conventions.md", import.meta.url), "utf8");
  return text.split(/^## Lint feedback\s*$/m)[0].trim();
}

/** One self-contained prompt asking an agent to unify near-duplicate element IDs; null when there is nothing to ask. */
export function renderAgentPrompt(index: Index, folder: string, conventions: string): string | null {
  const pairs = (index.diagnostics.filter((d) => d.rule === "fuzzy-id-candidate") as unknown as (Pair & { kind: string })[])
    .filter((d) => d.kind === "edit-distance")
    .sort((x, y) => y.confidence - x.confidence || x.a.localeCompare(y.a) || x.b.localeCompare(y.b));
  if (!pairs.length) return null;

  const shown = pairs.slice(0, MAX_PAIRS);
  const lines = shown.map(
    (p, i) => `${i + 1}. \`${p.a}\` / \`${p.b}\` (confidence ${p.confidence})\n   - \`${p.a}\`: ${files(index, p.a)}\n   - \`${p.b}\`: ${files(index, p.b)}`,
  );
  const omitted = pairs.length - shown.length;

  return [
    `# Normalize element IDs in \`${folder}\``,
    "",
    "Some Mermaid node IDs in these docs look like spellings of the same element. Unify only the ones that are really the same concept.",
    "",
    "## Steps",
    "",
    `1. Run \`docdive lint --fix --docs ${folder}\` first: it already merges the mechanical spelling variants (case, separators).`,
    "2. For each pair below, open the listed files and compare the node labels and the diagrams around them.",
    "   - Same concept: rename every occurrence of one ID to the other, in the Mermaid blocks and in any `id:` / `parent:` frontmatter.",
    "   - Different concepts (e.g. `CPUPool` vs `GPUPool`): leave both untouched.",
    "3. Report each decision as `merged A -> B (reason)` or `kept A / B (reason)`.",
    "",
    "## Candidate pairs",
    "",
    ...lines,
    ...(omitted ? ["", `${omitted} more pair${omitted === 1 ? "" : "s"} omitted.`] : []),
    "",
    "## Conventions",
    "",
    conventions,
  ].join("\n");
}
