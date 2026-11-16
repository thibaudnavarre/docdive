import { test, expect, type Page } from "@playwright/test";
import { toyIndex } from "./helpers.js";

// Pages with several Mermaid fences: URL state (selection, scenario/step) applies to one diagram only.
// Fixture: architecture/orders-db.md has two fences sharing the node ConnectionPool; checkout-happy-path touches both.

interface Index {
  diagrams: { id: string; nodes: string[] }[];
  scenarios: Record<string, { steps: unknown[] }>;
}
const index = toyIndex<Index>();
const DOC = "architecture/orders-db.md";
const SCENARIO = "checkout-happy-path";
const SHARED = "ConnectionPool";
const nodesOf = (n: number) => index.diagrams.find((d) => d.id === `${DOC}#${n}`)!.nodes;

const SITES = [
  { name: "docusaurus", origin: "http://localhost:4201" },
  { name: "mkdocs", origin: "http://localhost:4202" },
];

const dia = (n: number, sel = "") => `docdive-diagram[data-docdive-diagram="${DOC}#${n}"] ${sel}`.trim();
const titles = (page: Page) => page.locator("docdive-diagram [data-docdive-title]");
const step = (page: Page, n: number) => page.locator(dia(n, "[data-docdive-step]"));

for (const site of SITES) {
  test.describe(site.name, () => {
    let map: Record<string, string>;
    const url = (doc: string, query = "") => `${site.origin}${map[doc]}${query}`;
    const open = async (page: Page, query = "") => {
      await page.goto(url(DOC, query));
      await expect(page.locator("docdive-diagram [data-docdive-node]").first()).toBeVisible();
      await expect(page.locator(dia(1, "[data-docdive-node]")).first()).toBeVisible();
    };
    test.beforeAll(async () => {
      map = (await (await fetch(`${site.origin}/docdive/docdive/docdive-map.json`)).json()) as Record<string, string>;
    });

    test(`M1 both diagrams render and map (${site.name})`, async ({ page }) => {
      await open(page);
      await expect(page.locator("docdive-diagram")).toHaveCount(2);
      for (const n of [0, 1]) {
        const ids = await page.$$eval(dia(n, "[data-docdive-node]"), (e) => e.map((x) => x.getAttribute("data-docdive-node")!));
        expect(ids.sort()).toEqual([...nodesOf(n)].sort());
        await expect(page.locator(dia(n, "[data-docdive-error]"))).toHaveText("");
      }
    });

    test(`M2 clicking a shared node selects it in that diagram only (${site.name})`, async ({ page }) => {
      await open(page);
      await page.click(dia(1, `[data-docdive-node="${SHARED}"]`));
      await expect(page.locator(dia(1, "[data-docdive-title]"))).toHaveText(SHARED);
      await expect(titles(page)).toHaveCount(1);
    });

    test(`M3 a link copied from diagram #2 restores it there only (${site.name})`, async ({ page, context }) => {
      await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: site.origin });
      await open(page);
      await page.click(dia(1, `[data-docdive-node="${SHARED}"]`));
      await page.click(dia(1, "[data-docdive-copy-link]"));
      await expect(page.locator(dia(1, "[data-docdive-copy-link-status]"))).toHaveText("ok");
      const link = await page.evaluate(() => navigator.clipboard.readText());
      expect(link).toBe(url(DOC, `?docdive-select=${SHARED}&docdive-diagram=1`));

      await open(page, new URL(link).search);
      await expect(page.locator(dia(1, "[data-docdive-title]"))).toHaveText(SHARED);
      await expect(titles(page)).toHaveCount(1);
    });

    test(`M4 an unqualified link restores in the first matching diagram only (${site.name})`, async ({ page }) => {
      await open(page, `?docdive-select=${SHARED}`);
      await expect(page.locator(dia(0, "[data-docdive-title]"))).toHaveText(SHARED);
      await expect(titles(page)).toHaveCount(1);
      // A node only the second diagram draws goes to the second diagram.
      await open(page, "?docdive-select=Replica");
      await expect(page.locator(dia(1, "[data-docdive-title]"))).toHaveText("Replica");
      await expect(titles(page)).toHaveCount(1);
    });

    test(`M5 each diagram traces independently (${site.name})`, async ({ page }) => {
      await open(page);
      await page.click(dia(0, "[data-docdive-next]"));
      await page.click(dia(0, "[data-docdive-next]"));
      await page.click(dia(1, "[data-docdive-next]"));
      await expect(step(page, 0)).toHaveText("2");
      await expect(step(page, 1)).toHaveText("1");
    });

    test(`M6 deep dive with a trace traces the first touched diagram only (${site.name})`, async ({ page }) => {
      await page.goto(url("architecture/system.md"));
      await page.waitForSelector("docdive-diagram [data-docdive-node]");
      await page.click('docdive-diagram [data-docdive-node="OrdersDB"]');
      await page.click("docdive-diagram [data-docdive-next]");
      await page.click("docdive-diagram [data-docdive-next]");
      await page.click("docdive-diagram [data-docdive-open]");
      await page.waitForURL(`**${map[DOC]}?docdive-scenario=${SCENARIO}&docdive-step=2`);
      await expect(page.locator(dia(1, "[data-docdive-node]")).first()).toBeVisible();
      await expect(step(page, 0)).toHaveText("2");
      await expect(step(page, 1)).toHaveText("0");
    });
  });
}
