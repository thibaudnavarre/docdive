import { test, expect } from "@playwright/test";
import { SITES, docMap, toyIndex, watchErrors } from "./helpers.js";

// <docdive-map> on the overview page (fixtures/toy/index.md) of both example sites: the element tree links to the
// element pages, the flow links to the scenario page. Expected values come from `docdive build fixtures/toy`.

interface Index {
  elements: Record<string, { doc: string | null; parent?: string | null; children?: string[] }>;
  scenarios: Record<string, { doc: string; steps: unknown[] }>;
}
const index = toyIndex<Index>();
const documented = Object.entries(index.elements).filter(([, e]) => e.doc).map(([id]) => id).sort();

for (const site of SITES) {
  test.describe(site.name, () => {
    let map: Record<string, string>;
    test.beforeAll(async () => {
      map = await docMap(site.origin);
    });

    test(`M1 overview lists every element and links the documented ones (${site.name})`, async ({ page }) => {
      const errors = watchErrors(page);
      await page.goto(`${site.origin}${map["index.md"]}`);
      await page.waitForSelector("docdive-map [data-docdive-tree]");
      const rows = page.locator("docdive-map [data-docdive-tree-node]");
      expect((await rows.evaluateAll((e) => e.map((x) => x.getAttribute("data-docdive-tree-node")))).sort()).toEqual(Object.keys(index.elements).sort());
      const links = page.locator("docdive-map a[data-docdive-map-element]");
      expect((await links.evaluateAll((e) => e.map((x) => x.getAttribute("data-docdive-map-element")))).sort()).toEqual(documented);
      await expect(page.locator('docdive-map a[data-docdive-map-element="OrderService"]')).toHaveAttribute("href", map["architecture/order-service.md"]!);
      // Children sit under their parent.
      await expect(page.locator('docdive-map [data-docdive-tree-node="OrderService"] + ul [data-docdive-tree-node="Validator"]')).toHaveCount(1);
      expect(errors).toEqual([]);
    });

    test(`M2 overview lists the flows with the elements they cross (${site.name})`, async ({ page }) => {
      await page.goto(`${site.origin}${map["index.md"]}`);
      await page.waitForSelector("docdive-map [data-docdive-flows]");
      const flow = page.locator('docdive-map [data-docdive-flow="checkout-happy-path"]');
      await expect(flow.locator("a")).toHaveAttribute("href", map["scenarios/checkout.md"]!);
      await expect(flow.locator(".chip")).toHaveText(["API", "OrderService", "PaymentGateway", "OrdersDB"]);
      await expect(flow).toContainText(`${index.scenarios["checkout-happy-path"]!.steps.length} steps`);
    });
  });
}
