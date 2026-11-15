import { test, expect, type Page } from "@playwright/test";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { docdive, ROOT, TOY, toyIndex } from "./helpers.js";

// The Docusaurus example built with the site's own `mermaid` pinned to 11.17.2 (build-mermaid11). The element
// must use that injected instance, never load its bundled Mermaid 12 chunks, and still map ids, trace and copy.

interface Step {
  from: string;
  to: string;
  label: string;
  isReturn: boolean;
}
interface Index {
  diagrams: { id: string; edges: [string, string][] }[];
  scenarios: Record<string, { steps: Step[] }>;
}
const index = toyIndex<Index>();
const SCENARIO = "checkout-happy-path";
const steps = index.scenarios[SCENARIO]!.steps;
const SYSTEM = "architecture/system.md";
const BUILD = join(ROOT, "examples", "docusaurus", "build-mermaid11");
const ORIGIN = "http://localhost:4205";

const q = (sel: string) => `docdive-diagram ${sel}`;
const activeEdges = (page: Page) =>
  page.$$eval(q("[data-docdive-edge][data-docdive-active]"), (e) => e.map((x) => x.getAttribute("data-docdive-edge")!));

let map: Record<string, string>;
test.beforeAll(async () => {
  map = (await (await fetch(`${ORIGIN}/docdive/docdive/docdive-map.json`)).json()) as Record<string, string>;
});

async function open(page: Page, doc = SYSTEM): Promise<string[]> {
  const elementRequests: string[] = [];
  page.on("request", (r) => {
    const { pathname } = new URL(r.url());
    if (pathname.startsWith("/docdive/docdive/")) elementRequests.push(pathname.split("/").pop()!);
  });
  await page.goto(`${ORIGIN}${map[doc]}`);
  await page.waitForSelector(q("[data-docdive-node], [data-docdive-message]"));
  return elementRequests;
}

test("H1 the site bundles Mermaid 11.17.2 and not 12", () => {
  const js = join(BUILD, "assets", "js");
  const all = readdirSync(js).map((f) => readFileSync(join(js, f), "utf8")).join("\n");
  expect(all).toContain('version:"11.17.2"');
  expect(all).not.toContain('version:"12.3.0"');
});

test("H2 renders with the injected host instance, no bundled chunk loaded", async ({ page }) => {
  const requests = await open(page);
  await expect(page.locator("docdive-diagram")).toHaveAttribute("data-docdive-mermaid", "injected");
  await expect(page.locator(q("[data-docdive-error]"))).toHaveText("");
  const diagram = index.diagrams.find((d) => d.id === `${SYSTEM}#0`)!;
  expect(await page.locator(q("[data-docdive-edge]")).count()).toBe(diagram.edges.length);
  // Only the element, its data and its small helper chunks load; none of them carries a bundled Mermaid.
  const files = new Set(requests.filter((f) => f !== "contexts.json"));
  expect(files).toContain("docdive-element.js");
  for (const f of files) {
    expect(f).toMatch(/^(docdive-element\.js|index\.json|docdive-map\.json|chunk-[A-Z0-9]+\.js)$/);
    if (f.endsWith(".js")) {
      const body = readFileSync(join(BUILD, "docdive", f), "utf8");
      expect(body.length).toBeLessThan(50_000);
    }
  }
});

test("H3 trace highlights one edge per step, parallel edges stay distinct", async ({ page }) => {
  await open(page);
  const edgesByStep: string[] = [];
  for (let i = 0; i < steps.length; i++) {
    await page.click(q("[data-docdive-next]"));
    await expect(page.locator(q("[data-docdive-step]"))).toHaveText(String(i + 1));
    const edges = await activeEdges(page);
    expect(edges).toHaveLength(1);
    edgesByStep.push(edges[0]!);
  }
  const forward = steps.flatMap((s, i) => (s.isReturn ? [] : [{ pair: `${s.from}>${s.to}`, edge: edgesByStep[i]! }]));
  for (const { pair, edge } of forward) expect(edge.startsWith(`${pair}#`)).toBe(true);
  const samePair = forward.filter((f) => f.pair === forward.find((g) => forward.filter((h) => h.pair === g.pair).length > 1)?.pair);
  expect(samePair.length).toBeGreaterThan(1);
  expect(new Set(samePair.map((f) => f.edge)).size).toBe(samePair.length);
});

test("H4 sequence diagram maps on the host instance", async ({ page }) => {
  await open(page, "scenarios/checkout.md");
  await expect(page.locator("docdive-diagram")).toHaveAttribute("data-docdive-mermaid", "injected");
  for (let i = 1; i <= steps.length; i++) {
    await page.click(q("[data-docdive-next]"));
    await expect(page.locator(q("text[data-docdive-active]"))).toHaveText(steps[i - 1]!.label);
  }
  await expect(page.locator(q("[data-docdive-error]"))).toHaveText("");
});

test("H5 copy context equals the CLI output", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: ORIGIN });
  await open(page);
  await page.click(q('[data-docdive-node="OrderService"]'));
  await page.click(q("[data-docdive-copy]"));
  await expect(page.locator(q("[data-docdive-copy-status]"))).toHaveText("ok");
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(docdive("context", "OrderService", "--folder", TOY).slice(0, -1));
});
