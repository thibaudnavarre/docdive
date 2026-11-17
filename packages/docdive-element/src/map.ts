import { getJson, here, observeTheme, TOKEN_STYLE } from "./runtime.js";
import { divable, el, scenarioElements, scenariosOf, systemTree, INDEX_VERSION, type Index, type TreeNode } from "./shared.js";

// <docdive-map>: the system at a glance. Two columns from index.json: the element tree (parent/children, rooted at
// the parentless elements that own a doc; names link to their page) and the flows (scenarios, with the elements
// they cross). Drop it in any page: `<docdive-map></docdive-map>`.
//
// Inputs (attributes, defaults next to this script): `index-url` (index.json), `map-url` (docdive-map.json).
// Styling: the same `--docdive-*` properties as <docdive-diagram>, plus the `map` part.

const STYLE = `
${TOKEN_STYLE}
[data-docdive-map] { display: grid; grid-template-columns: 1.4fr 1fr; gap: calc(var(--docdive-space) * 2); }
@container (max-width: 720px) { [data-docdive-map] { grid-template-columns: 1fr; } }
:host { container-type: inline-size; }
h2 { margin: 0 0 .6em; font-size: .78em; text-transform: uppercase; letter-spacing: .08em; color: var(--docdive-fg-muted); font-weight: 600; }
ul { list-style: none; margin: 0; padding: 0; }
[data-docdive-tree] ul { margin-left: .9em; padding-left: .9em; border-left: 1px solid var(--docdive-border); }
[data-docdive-tree-node] { display: flex; gap: .7em; align-items: baseline; flex-wrap: wrap; padding: .35em 0; }
[data-docdive-tree] a { color: inherit; text-decoration: none; font-weight: 650; }
[data-docdive-tree] a:hover { color: var(--docdive-accent); text-decoration: underline; }
[data-docdive-tree] .desc { flex: 1 1 15em; font-size: .92em; }
[data-docdive-flow] { display: grid; gap: .4em; padding: .7em 0; border-top: 1px solid var(--docdive-border); }
[data-docdive-flow]:first-child { border-top: 0; padding-top: 0; }
[data-docdive-flow] a { color: inherit; text-decoration: none; font-weight: 650; }
[data-docdive-flow] a:hover { color: var(--docdive-accent); text-decoration: underline; }
.chips { display: flex; flex-wrap: wrap; gap: .3em; }
[data-docdive-error] { color: var(--docdive-error); font-size: .9em; }
`;

export class DocdiveMap extends HTMLElement {
  static observedAttributes = ["index-url", "map-url"];

  private root = this.attachShadow({ mode: "open" });
  private body = el("div", { "data-docdive-map": "", part: "map" });
  private errorHost = el("div", { "data-docdive-error": "" });
  private unobserveTheme?: () => void;

  constructor() {
    super();
    this.root.append(el("style", {}, STYLE), this.errorHost, this.body);
  }

  connectedCallback(): void {
    this.unobserveTheme ??= observeTheme(this);
    void this.render();
  }

  disconnectedCallback(): void {
    this.unobserveTheme?.();
    this.unobserveTheme = undefined;
  }

  attributeChangedCallback(): void {
    if (this.isConnected) void this.render();
  }

  private async render(): Promise<void> {
    this.errorHost.textContent = "";
    try {
      const indexUrl = this.getAttribute("index-url") ?? new URL("index.json", here).href;
      const mapUrl = this.getAttribute("map-url") ?? new URL("docdive-map.json", here).href;
      const [index, map] = await Promise.all([getJson<Index>(indexUrl), getJson<Record<string, unknown>>(mapUrl).catch((): Record<string, unknown> => ({}))]);
      if (index.version !== INDEX_VERSION) {
        this.errorHost.textContent = `docdive: index.json has schema version ${index.version ?? "none"}, this element reads version ${INDEX_VERSION}.`;
        return;
      }
      const pageUrl = (doc: string | null | undefined): string | undefined => {
        const u = doc ? map[doc] : undefined;
        return typeof u === "string" ? u : undefined;
      };
      const name = (id: string, url: string | undefined, attr: string): HTMLElement =>
        url ? el("a", { [attr]: id, href: url }, id) : el("span", { [attr]: id }, id);

      const node = (n: TreeNode): HTMLLIElement => {
        const li = el("li");
        const row = el("div", { "data-docdive-tree-node": n.id });
        const e = index.elements[n.id];
        row.append(name(n.id, divable(index, n.id) ? pageUrl(e?.doc) : undefined, "data-docdive-map-element"));
        if (e?.description) row.append(el("span", { class: "desc muted" }, e.description));
        const flows = scenariosOf(index, n.id).length;
        if (flows) row.append(el("span", { class: "chip muted", title: `${flows} flow${flows > 1 ? "s" : ""} cross ${n.id}` }, `${flows} flow${flows > 1 ? "s" : ""}`));
        li.append(row);
        if (n.children.length) {
          const ul = el("ul");
          ul.append(...n.children.map(node));
          li.append(ul);
        }
        return li;
      };
      const tree = el("ul", { "data-docdive-tree": "" });
      tree.append(...systemTree(index).map(node));

      const flows = el("ul", { "data-docdive-flows": "" });
      for (const [id, sc] of Object.entries(index.scenarios)) {
        const li = el("li", { "data-docdive-flow": id });
        const head = el("div");
        head.append(name(id, pageUrl(sc.doc), "data-docdive-map-scenario"), " ", el("span", { class: "muted" }, `${sc.steps.length} steps`));
        const chips = el("div", { class: "chips" });
        chips.append(...scenarioElements(index, id).map((x) => el("span", { class: "chip" }, x)));
        li.append(head, chips);
        flows.append(li);
      }

      const system = el("section");
      system.append(el("h2", {}, "System"), tree);
      const scenarios = el("section");
      scenarios.append(el("h2", {}, "Flows"), flows.children.length ? flows : el("p", { class: "muted" }, "No scenario yet."));
      this.body.replaceChildren(system, scenarios);
    } catch (e) {
      this.errorHost.textContent = `docdive: ${String(e)}`;
    }
  }
}

if (!customElements.get("docdive-map")) customElements.define("docdive-map", DocdiveMap);
