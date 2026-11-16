import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT, docUrls, fenceCount, toyIndex } from "./helpers.js";

// One test per item of the frozen checklist in docs/ssg-findings.md (S1-S7), per SSG.
// Expected values come from `docdive index fixtures/toy`.

interface Index {
  diagrams: { id: string; type: string; nodes: string[] }[];
  elements: Record<string, { parent?: string; children?: string[]; appearsIn?: string[]; src?: string[] }>;
  scenarios: Record<string, { doc: string; steps: { from: string; to: string }[] }>;
}
const SITE = join(ROOT, "examples", "docusaurus");
const index = toyIndex<Index>();
const SYSTEM = "architecture/system.md";
const nodesOf = (diagram: string) => index.diagrams.find((d) => d.id === diagram)!.nodes;

interface Site {
  name: string;
  origin: string;
  plainOrigin: string;
}
const SITES: Site[] = [
  { name: "docusaurus", origin: "http://localhost:4201", plainOrigin: "http://localhost:4203" },
  { name: "mkdocs", origin: "http://localhost:4202", plainOrigin: "http://localhost:4204" },
];

async function docMap(origin: string): Promise<Record<string, string>> {
  const res = await fetch(`${origin}/docdive/docdive/docdive-map.json`);
  return (await res.json()) as Record<string, string>;
}
const nodeIds = (page: Page) => page.$$eval("docdive-diagram [data-docdive-node]", (e) => e.map((x) => x.getAttribute("data-docdive-node")!));
const field = (page: Page, name: string) => page.locator(`docdive-diagram [data-docdive-panel] [data-docdive-field="${name}"] [data-docdive-value]`);

function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  return errors;
}

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

    // S3 as amended 2026-11-15 (docs/ssg-findings.md): select the node, then follow the panel's "Open" link.
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

    // S4/S5: a node click no longer navigates (S3 amendment), so the panel is read in place.
    test(`S4 info panel, documented element (${site.name})`, async ({ page }) => {
      await page.goto(url("architecture/system.md"));
      await page.waitForSelector("docdive-diagram [data-docdive-node]");
      await page.click('docdive-diagram [data-docdive-node="OrderService"]');
      const e = index.elements["OrderService"]!;
      const scenarios = Object.entries(index.scenarios)
        .filter(([, sc]) => sc.steps.some((s) => s.from === "OrderService" || s.to === "OrderService"))
        .map(([id]) => id);
      await expect(field(page, "parent")).toHaveText(e.parent!);
      await expect(field(page, "children")).toHaveText(e.children!.join(", "));
      await expect(field(page, "appearsIn")).toHaveText(e.appearsIn!.join(", "));
      await expect(field(page, "scenarios")).toHaveText(scenarios.join(", "));
      await expect(field(page, "src")).toHaveText(e.src!.join(", "));
    });

    test(`S5 info panel, undocumented element (${site.name})`, async ({ page }) => {
      const errors = watchErrors(page);
      await page.goto(url("architecture/system.md"));
      await page.waitForSelector("docdive-diagram [data-docdive-node]");
      await page.click('docdive-diagram [data-docdive-node="PaymentGateway"]');
      const e = index.elements["PaymentGateway"]!;
      await expect(field(page, "parent")).toHaveText(e.parent!);
      await expect(field(page, "appearsIn")).toHaveText(e.appearsIn!.join(", "));
      await expect(field(page, "scenarios")).toHaveText("checkout-happy-path");
      await expect(field(page, "children")).toHaveCount(0);
      await expect(field(page, "src")).toHaveCount(0);
      await expect(page.locator("docdive-diagram [data-docdive-error]")).toHaveText("");
      expect(errors).toEqual([]);
    });

    test(`S6 deletability (${site.name})`, async ({ page }) => {
      const errors = watchErrors(page);
      for (const doc of Object.keys(docUrls(map))) {
        await page.goto(`${site.plainOrigin}${map[doc]}`);
        await expect(page.locator("docdive-diagram")).toHaveCount(0);
        if (site.name === "docusaurus") {
          await expect(page.locator(".docusaurus-mermaid-container svg")).toHaveCount(fenceCount(doc));
        } else {
          // Material's shadow root is closed: judge by the replaced container and its rendered height.
          await expect(page.locator("pre.mermaid")).toHaveCount(0);
          const box = page.locator("div.mermaid");
          await expect(box).toHaveCount(fenceCount(doc));
          await expect.poll(async () => (await box.first().boundingBox())?.height ?? 0).toBeGreaterThan(50);
        }
      }
      expect(errors).toEqual([]);
    });
  });
}

test("S7 no id: build error (docusaurus)", async () => {
  const status = readFileSync(join(SITE, "build.status"), "utf8").trim();
  const log = readFileSync(join(SITE, "build.log"), "utf8");
  expect(status).toBe("0");
  expect(log).not.toMatch(/\[ERROR\]|duplicate/i);
  const map = await docMap(SITES[0]!.origin);
  expect(Object.keys(docUrls(map)).sort()).toEqual(["architecture/order-service.md", "architecture/orders-db.md", "architecture/system.md", "architecture/validator.md", "scenarios/checkout.md"]);
  expect(new Set(Object.values(docUrls(map))).size).toBe(5);
});
