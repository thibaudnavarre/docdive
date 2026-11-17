import { test, expect, type Page } from "@playwright/test";
import { SITES, docMap, toyIndex, watchErrors } from "./helpers.js";

// Render, deep dive, info panel, breadcrumb and Source link on both example sites. Expected values come from
// `docdive build fixtures/toy`.

interface Index {
  diagrams: { id: string; type: string; nodes: string[] }[];
  elements: Record<string, { parent?: string; children?: string[]; appearsIn?: string[]; src?: string[] }>;
  scenarios: Record<string, { doc: string; steps: { from: string; to: string }[] }>;
}
const index = toyIndex<Index>();
const SYSTEM = "architecture/system.md";
const nodesOf = (diagram: string) => index.diagrams.find((d) => d.id === diagram)!.nodes;

const nodeIds = (page: Page) => page.$$eval("docdive-diagram [data-docdive-node]", (e) => e.map((x) => x.getAttribute("data-docdive-node")!));
const field = (page: Page, name: string) => page.locator(`docdive-diagram [data-docdive-panel] [data-docdive-field="${name}"] [data-docdive-value]`);

for (const site of SITES) {
  test.describe(site.name, () => {
    let map: Record<string, string>;
    const url = (doc: string) => `${site.origin}${map[doc]}`;
    test.beforeAll(async () => {
      map = await docMap(site.origin);
    });

    test(`S1 render and ID mapping (${site.name})`, async ({ page }) => {
      const errors = watchErrors(page);
      await page.goto(url("architecture/system.md"));
      await page.waitForSelector("docdive-diagram [data-docdive-node]");
      await expect(page.locator("docdive-diagram")).toHaveCount(1);
      await expect(page.locator("docdive-diagram")).toHaveAttribute("data-docdive-diagram", `${SYSTEM}#0`);
      await expect(page.locator("docdive-diagram svg")).toHaveCount(1);
      expect([...(await nodeIds(page))].sort()).toEqual([...nodesOf(`${SYSTEM}#0`)].sort());
      await expect(page.locator("docdive-diagram [data-docdive-error]")).toHaveText("");
      expect(errors).toEqual([]);
    });

    test(`S2 index and map found under the base URL (${site.name})`, async ({ page }) => {
      const bad: string[] = [];
      const seen: Record<string, number> = {};
      page.on("response", (r) => {
        const u = new URL(r.url());
        if (u.origin !== site.origin) return;
        if (r.status() >= 400) bad.push(`${r.status()} ${u.pathname}`);
        for (const f of ["index.json", "docdive-map.json"]) if (u.pathname === `/docdive/docdive/${f}`) seen[f] = r.status();
      });
      page.on("requestfailed", (r) => bad.push(`failed ${r.url()}`));
      await page.goto(url("architecture/system.md"));
      await page.waitForSelector("docdive-diagram [data-docdive-node]");
      expect(seen).toEqual({ "index.json": 200, "docdive-map.json": 200 });
      expect(bad).toEqual([]);
    });

    // A node click selects; the panel's "Open" link dives.
    test(`S3 deep dive (${site.name})`, async ({ page }) => {
      await page.goto(url("architecture/system.md"));
      await page.waitForSelector("docdive-diagram [data-docdive-node]");
      await page.click('docdive-diagram [data-docdive-node="OrderService"]');
      await page.click("docdive-diagram [data-docdive-open]");
      await page.waitForURL(url("architecture/order-service.md"));
      await page.waitForSelector('docdive-diagram [data-docdive-node="Controller"]');
      expect([...(await nodeIds(page))].sort()).toEqual([...nodesOf("architecture/order-service.md#0")].sort());
      await page.click('docdive-diagram [data-docdive-node="Validator"]');
      await page.click("docdive-diagram [data-docdive-open]");
      await page.waitForURL(url("architecture/validator.md"));
      await page.waitForSelector('docdive-diagram [data-docdive-node="SchemaCheck"]');
      expect([...(await nodeIds(page))].sort()).toEqual([...nodesOf("architecture/validator.md#0")].sort());

      await page.goto(url("architecture/system.md"));
      await page.waitForSelector("docdive-diagram [data-docdive-node]");
      const before = page.url();
      await page.click('docdive-diagram [data-docdive-node="API"]');
      await expect(page.locator("docdive-diagram [data-docdive-panel] [data-docdive-title]")).toHaveText("API");
      await expect(page.locator("docdive-diagram [data-docdive-open]")).toHaveCount(0);
      await page.waitForTimeout(500);
      expect(page.url()).toBe(before);
    });

    test(`S4 info panel, documented element (${site.name})`, async ({ page }) => {
      await page.goto(url("architecture/system.md"));
      await page.waitForSelector("docdive-diagram [data-docdive-node]");
      await page.click('docdive-diagram [data-docdive-node="OrderService"]');
      const e = index.elements["OrderService"]!;
      const scenarios = Object.entries(index.scenarios)
        .filter(([, sc]) => sc.steps.some((s) => s.from === "OrderService" || s.to === "OrderService"))
        .map(([id]) => id);
      await expect(field(page, "parent")).toHaveText([e.parent!]);
      await expect(field(page, "children")).toHaveText(e.children!);
      // "Appears in" names the diagram owners, not the raw `doc#n` ids.
      await expect(field(page, "appearsIn")).toHaveText(["system", "checkout-happy-path"]);
      await expect(field(page, "scenarios")).toHaveText(scenarios);
      await expect(field(page, "src")).toHaveText(e.src!);
    });

    test(`S5 info panel, undocumented element (${site.name})`, async ({ page }) => {
      const errors = watchErrors(page);
      await page.goto(url("architecture/system.md"));
      await page.waitForSelector("docdive-diagram [data-docdive-node]");
      await page.click('docdive-diagram [data-docdive-node="PaymentGateway"]');
      const e = index.elements["PaymentGateway"]!;
      await expect(field(page, "parent")).toHaveText(e.parent!);
      await expect(field(page, "appearsIn")).toHaveText(["system", "checkout-happy-path"]);
      await expect(field(page, "scenarios")).toHaveText("checkout-happy-path");
      await expect(field(page, "children")).toHaveCount(0);
      await expect(field(page, "src")).toHaveCount(0);
      await expect(page.locator("docdive-diagram [data-docdive-error]")).toHaveText("");
      expect(errors).toEqual([]);
    });

    test(`breadcrumb shows the trail root-first, and the root page has none (${site.name})`, async ({ page }) => {
      const CRUMBS = "docdive-diagram [data-docdive-breadcrumb] [data-docdive-crumb]";
      await page.goto(url("architecture/validator.md"));
      await page.waitForSelector("docdive-diagram [data-docdive-node]");
      await expect(page.locator(CRUMBS)).toHaveText(["system", "OrderService", "Validator"]);
      await expect(page.locator(`${CRUMBS}[aria-current="page"]`)).toHaveText("Validator");
      await page.goto(url(SYSTEM));
      await page.waitForSelector("docdive-diagram [data-docdive-node]");
      await expect(page.locator("docdive-diagram [data-docdive-breadcrumb]")).toHaveCount(0);
    });

    // orders-db.md ends with a pie chart: docdive does not index it, but it must still render, without an error.
    test(`a fence docdive does not index still renders (${site.name})`, async ({ page }) => {
      await page.goto(url("architecture/orders-db.md"));
      const pie = page.locator("docdive-diagram").nth(2);
      await expect(pie.locator("svg")).toHaveCount(1);
      await expect(pie.locator("[data-docdive-error]")).toHaveText("");
    });

    // The sites set a GitHub edit URL; the element rewrites it to /blob/. system.md declares OrdersDB on line 8.
    test(`Source link opens the repo page at the node line (${site.name})`, async ({ page }) => {
      await page.goto(url(SYSTEM));
      await page.locator('docdive-diagram [data-docdive-node="OrdersDB"]').click();
      const source = page.locator("docdive-diagram [data-docdive-source]");
      await expect(source).toHaveAttribute("href", "https://github.com/thibaudnavarre/docdive/blob/main/fixtures/toy/architecture/system.md#L8");
      await expect(source).toHaveAttribute("target", "_blank");
    });
  });
}
