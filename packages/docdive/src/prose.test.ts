import { describe, expect, it } from "vitest";
import type { Doc } from "./loader.js";
import { attachProse } from "./prose.js";

const docOf = (body: string): Doc => ({ path: "a.md", frontmatter: {}, body, bodyOffset: 0, blocks: [] });

function proseFor(body: string, id: string) {
  const elements: Record<string, { doc: string | null; appearsIn: string[]; prose?: import("./prose.js").Prose }> = {
    [id]: { doc: null, appearsIn: ["a.md#0"] },
  };
  attachProse(elements, {}, [docOf(body)], new Map([["a.md#0", 1]]));
  return elements[id].prose;
}

describe("attachProse excerpts", () => {
  it("returns the matching list item, not the whole list", () => {
    const body = ["# T", "", "- `Alpha` first one", "- `Beta` second one", "- `InfoPanel` shows the selected element", "  and its details", "- `Gamma` last"].join("\n");
    expect(proseFor(body, "InfoPanel")?.excerpt).toBe("- `InfoPanel` shows the selected element and its details");
  });

  it("cuts a long item at a word boundary with an ellipsis", () => {
    const body = `# T\n\n- Widget ${"word ".repeat(200)}`;
    const excerpt = proseFor(body, "Widget")?.excerpt ?? "";
    expect(excerpt.endsWith("word…")).toBe(true);
    expect(excerpt.length).toBeLessThanOrEqual(401);
  });

  it("keeps a plain paragraph whole", () => {
    expect(proseFor("# T\n\nWidget does\nthings.\n\nOther.", "Widget")?.excerpt).toBe("Widget does things.");
  });
});
