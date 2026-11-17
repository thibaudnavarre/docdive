import type { Doc } from "./loader.js";
import type { Index } from "./model.js";
import type { StateNote } from "./sequence.js";

/** `\n   state: Order status=paid …` for the notes over `id` at a step; empty when none. */
const stateLine = (notes: StateNote[] | undefined, id: string): string =>
  (notes ?? [])
    .filter((n) => n.over.includes(id))
    .map((n) => `\n   state: ${[n.entity, ...Object.entries(n.fields ?? {}).map(([k, v]) => `${k}=${v}`), n.text].filter(Boolean).join(" ")}`)
    .join("");

/** Markdown context of one element, ready to paste into a coding agent ("Copy context" in the viewer). */
function renderContextMarkdown(index: Index, docs: Doc[], id: string): string {
  const el = index.elements[id];
  if (!el) throw new Error(`Unknown element "${id}"`);
  const list = (items: string[]) => (items.length ? items.map((i) => `- ${i}`).join("\n") : "- (none)");
  const scenarios = Object.entries(index.scenarios)
    .filter(([, s]) => s.steps.some((st) => st.from === id || st.to === id))
    .map(([sid, s]) => `### ${sid} (${s.doc})\n` + s.steps.map((st, i) => `${i + 1}. ${st.from} -> ${st.to}: ${st.label}${stateLine(st.notes, id)}`).join("\n"));
  const head = [
    `- parent: ${el.parent ?? "(none)"}`,
    `- doc: ${el.doc ?? "(none)"}`,
    ...(el.description ? [`- description: ${el.description}`] : []),
  ];
  const parts = [
    `# Context: ${id}\n\n${head.join("\n")}`,
    `## Children\n${list(el.children)}`,
    `## Appears in\n${list(el.appearsIn)}`,
    `## Scenarios\n${scenarios.length ? scenarios.join("\n\n") : "- (none)"}`,
    `## Source\n${list(el.src)}`,
  ];
  const body = el.doc ? docs.find((d) => d.path === el.doc)?.body.trim() : undefined;
  if (body) parts.push(`## Doc\n${body}`);
  return parts.join("\n\n") + "\n";
}

export function renderAllContexts(index: Index, docs: Doc[]): Record<string, string> {
  return Object.fromEntries(
    Object.keys(index.elements)
      .sort()
      .map((id) => [id, renderContextMarkdown(index, docs, id)]),
  );
}
