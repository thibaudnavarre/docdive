import { test, expect } from "@playwright/test";

// Breadcrumb from the root ancestor to the page's own element. Fixture chain: system > OrderService > Validator.
const SITES = [
  { name: "docusaurus", origin: "http://localhost:4201" },
  { name: "mkdocs", origin: "http://localhost:4202" },
];
const CRUMBS = "docdive-diagram [data-docdive-breadcrumb] [data-docdive-crumb]";

for (const site of SITES) {
  test.describe(site.name, () => {
    let map: Record<string, string>;
    const open = async (page: import("@playwright/test").Page, doc: string, query = "") => {
      await page.goto(`${site.origin}${map[doc]}${query}`);
      await page.waitForSelector("docdive-diagram [data-docdive-node]");
    };
    test.beforeAll(async () => {
      map = (await (await fetch(`${site.origin}/docdive/docdive/docdive-map.json`)).json()) as Record<string, string>;
    });

    test(`shows the trail root-first with the page as current (${site.name})`, async ({ page }) => {
      await open(page, "architecture/validator.md");
      await expect(page.locator(CRUMBS)).toHaveText(["system", "OrderService", "Validator"]);
      await expect(page.locator(`${CRUMBS}[aria-current="page"]`)).toHaveText("Validator");
      await expect(page.locator("docdive-diagram nav[aria-label='Breadcrumb']")).toBeVisible();
    });

    test(`a crumb click keeps the active trace (${site.name})`, async ({ page }) => {
      await open(page, "architecture/validator.md", "?docdive-scenario=checkout-happy-path&docdive-step=1");
      await page.locator('docdive-diagram [data-docdive-crumb="OrderService"]').click();
      await page.waitForURL(/docdive-scenario=checkout-happy-path&docdive-step=1/);
      expect(new URL(page.url()).pathname).toBe(new URL(map["architecture/order-service.md"]!, site.origin).pathname);
      await expect(page.locator("docdive-diagram [data-docdive-step]")).toHaveText("1");
    });

    test(`the root page has no breadcrumb (${site.name})`, async ({ page }) => {
      await open(page, "architecture/system.md");
      await expect(page.locator("docdive-diagram [data-docdive-breadcrumb]")).toHaveCount(0);
    });
  });
}
