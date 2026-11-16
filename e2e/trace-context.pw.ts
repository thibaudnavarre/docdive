import { test, expect, type Page } from "@playwright/test";
import { docdive, docUrls, fenceCount, TOY, toyIndex } from "./helpers.js";

// One test per item of the frozen checklist in docs/trace-context-findings.md (T1-T9), per SSG.
// Expected values come from `docdive index fixtures/toy`, the built site's docdive-map.json and the CLI.

interface Step {
  from: string;
  to: string;
  label: string;
}
interface Index {
  scenarios: Record<string, { doc: string; steps: Step[] }>;
}
const index = toyIndex<Index>();
const SCENARIO = "checkout-happy-path";
const steps = index.scenarios[SCENARIO]!.steps;

// `docdive context <id>` stdout minus the final newline added by console.log.
const cliReference = (id: string): string =>
  docdive("context", id, "--folder", TOY).slice(0, -1);

interface Site {
  name: string;
  origin: string;
  plainOrigin: string;
}
const SITES: Site[] = [
  { name: "docusaurus", origin: "http://localhost:4201", plainOrigin: "http://localhost:4203" },
  { name: "mkdocs", origin: "http://localhost:4202", plainOrigin: "http://localhost:4204" },
];

const q = (sel: string) => `docdive-diagram ${sel}`;
const stepText = (page: Page) => page.locator(q("[data-docdive-step]")).textContent();
const activeNodes = (page: Page) =>
  page.$$eval(q("[data-docdive-node][data-docdive-active]"), (e) => e.map((x) => x.getAttribute("data-docdive-node")!).sort());

function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  return errors;
}

async function expectPaused(page: Page, step: string): Promise<void> {
  await expect(page.locator(q("[data-docdive-step]"))).toHaveText(step);
  await page.waitForTimeout(600);
  await expect(page.locator(q("[data-docdive-step]"))).toHaveText(step);
}

for (const site of SITES) {
  test.describe(site.name, () => {
    let map: Record<string, string>;
    const url = (doc: string, query = "") => `${site.origin}${map[doc]}${query}`;
    const open = async (page: Page, doc: string, query = "") => {
      await page.goto(url(doc, query));
      await page.waitForSelector(q("[data-docdive-node], [data-docdive-message]"));
    };
    test.beforeAll(async () => {
      map = (await (await fetch(`${site.origin}/docdive/docdive/docdive-map.json`)).json()) as Record<string, string>;
    });

    test(`T1 trace bar on the flowchart (${site.name})`, async ({ page }) => {
      await open(page, "architecture/system.md");
      const before = page.url();
      await expect(page.locator(q("[data-docdive-trace]"))).toBeVisible();
      expect(await page.locator(q("[data-docdive-scenario-picker] option")).allTextContents()).toContain(SCENARIO);
      for (let i = 1; i <= steps.length; i++) {
        await page.click(q("[data-docdive-next]"));
        await expect(page.locator(q("[data-docdive-step]"))).toHaveText(String(i));
        const s = steps[i - 1]!;
        expect(await activeNodes(page)).toEqual([...new Set([s.from, s.to])].sort());
      }
      const next = page.locator(q("[data-docdive-next]"));
      if (!(await next.isDisabled())) await next.click();
      await expect(page.locator(q("[data-docdive-step]"))).toHaveText(String(steps.length));
      await page.click(q("[data-docdive-prev]"));
      await expect(page.locator(q("[data-docdive-step]"))).toHaveText(String(steps.length - 1));
      expect(page.url()).toBe(before);
    });

    test(`T2 play / pause (${site.name})`, async ({ page }) => {
      await open(page, "architecture/system.md", "?docdive-interval=200");
      await page.click(q("[data-docdive-play]"));
      await expect.poll(async () => Number(await stepText(page)), { timeout: 2000 }).toBeGreaterThanOrEqual(2);
      await page.click(q("[data-docdive-pause]"));
      await expectPaused(page, (await stepText(page))!);
    });

    test(`T3 sequence trace (${site.name})`, async ({ page }) => {
      await open(page, "scenarios/checkout.md");
      for (let i = 1; i <= steps.length; i++) {
        await page.click(q("[data-docdive-next]"));
        const active = page.locator(q("text[data-docdive-active]"));
        await expect(active).toHaveCount(1);
        await expect(active).toHaveText(steps[i - 1]!.label);
      }
      await expect(page.locator(q("[data-docdive-error]"))).toHaveText("");
    });

    test(`T4 node click doesn't navigate (${site.name})`, async ({ page }) => {
      await open(page, "architecture/system.md");
      await page.evaluate(() => {
        (window as unknown as { navs: unknown[] }).navs = [];
        document.addEventListener("docdive-navigate", (e) => (window as unknown as { navs: unknown[] }).navs.push(e));
      });
      const before = page.url();
      await page.click(q('[data-docdive-node="OrderService"]'));
      await expect(page.locator(q('[data-docdive-field="parent"] [data-docdive-value]'))).toHaveText("system");
      await expect(page.locator(q("[data-docdive-open]"))).toHaveCount(1);
      await page.click(q('[data-docdive-node="API"]'));
      await expect(page.locator(q("[data-docdive-title]"))).toHaveText("API");
      await expect(page.locator(q("[data-docdive-open]"))).toHaveCount(0);
      await page.waitForTimeout(300);
      expect(page.url()).toBe(before);
      expect(await page.evaluate(() => (window as unknown as { navs: unknown[] }).navs.length)).toBe(0);
    });

    test(`T5 deep dive with trace (${site.name})`, async ({ page }) => {
      const trace = `?docdive-scenario=${SCENARIO}&docdive-step=2`;
      await open(page, "architecture/system.md");
      await page.click(q('[data-docdive-node="OrderService"]'));
      expect(await page.locator(q("[data-docdive-open]")).getAttribute("href")).toBe(map["architecture/order-service.md"]);

      await page.click(q("[data-docdive-next]"));
      await page.click(q("[data-docdive-next]"));
      await page.evaluate(() => {
        const w = window as unknown as { nav?: unknown; cancel: boolean };
        w.cancel = true;
        document.addEventListener("docdive-navigate", (e) => {
          w.nav = (e as CustomEvent).detail;
          if (w.cancel) e.preventDefault();
        });
      });
      const before = page.url();
      await page.click(q("[data-docdive-open]"));
      expect(await page.evaluate(() => (window as unknown as { nav: unknown }).nav)).toEqual({
        url: `${map["architecture/order-service.md"]}${trace}`,
        id: "OrderService",
      });
      expect(page.url()).toBe(before);
      await page.evaluate(() => ((window as unknown as { cancel: boolean }).cancel = false));
      await page.click(q("[data-docdive-open]"));
      await page.waitForURL(url("architecture/order-service.md", trace));
      await page.waitForSelector(q('[data-docdive-node="Controller"]'));
      await expect(page.locator(q("[data-docdive-trace]"))).toBeVisible();
      await expect(page.locator(q("[data-docdive-scenario-picker]"))).toHaveValue(SCENARIO);
      await expectPaused(page, "2");
      await expect(page.locator(q('[data-docdive-through="OrderService"]'))).toHaveCount(1);

      await page.click(q('[data-docdive-node="Validator"]'));
      await page.click(q("[data-docdive-open]"));
      await page.waitForURL(url("architecture/validator.md", trace));
      await page.waitForSelector(q('[data-docdive-node="SchemaCheck"]'));
      await expect(page.locator(q("[data-docdive-scenario-picker]"))).toHaveValue(SCENARIO);
      await expectPaused(page, "2");
      await expect(page.locator(q('[data-docdive-through="OrderService"]'))).toHaveCount(1);
    });

    test(`T6 invalid query state (${site.name})`, async ({ page }) => {
      const errors = watchErrors(page);
      for (const [query, step] of [
        ["?docdive-scenario=nope&docdive-step=3", "0"],
        [`?docdive-scenario=${SCENARIO}&docdive-step=99`, String(steps.length)],
        [`?docdive-scenario=${SCENARIO}&docdive-step=abc`, "0"],
      ] as const) {
        await open(page, "architecture/system.md", query);
        await expect(page.locator(q("[data-docdive-step]"))).toHaveText(step);
        await expect(page.locator(q("[data-docdive-error]"))).toHaveText("");
      }
      expect(errors).toEqual([]);
    });

    for (const [item, id] of [["T7", "OrderService"], ["T8", "PaymentGateway"]] as const) {
      test(`${item} copy context, ${id} (${site.name})`, async ({ page, context }) => {
        await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: site.origin });
        await open(page, "architecture/system.md");
        await page.click(q(`[data-docdive-node="${id}"]`));
        await page.click(q("[data-docdive-copy]"));
        await expect(page.locator(q("[data-docdive-copy-status]"))).toHaveText("ok");
        expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(cliReference(id));
      });
    }

    test(`T10 copy link restores selection and trace (${site.name})`, async ({ page, context }) => {
      await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: site.origin });
      const copyLink = async () => {
        await page.click(q("[data-docdive-copy-link]"));
        await expect(page.locator(q("[data-docdive-copy-link-status]"))).toHaveText("ok");
        return page.evaluate(() => navigator.clipboard.readText());
      };
      await open(page, "architecture/system.md");
      await page.click(q('[data-docdive-node="OrderService"]'));
      expect(await copyLink()).toBe(url("architecture/system.md", "?docdive-select=OrderService"));

      await page.click(q("[data-docdive-next]"));
      await page.click(q("[data-docdive-next]"));
      const link = await copyLink();
      expect(link).toBe(url("architecture/system.md", `?docdive-select=OrderService&docdive-scenario=${SCENARIO}&docdive-step=2`));

      await page.goto(link);
      await page.waitForSelector(q("[data-docdive-node]"));
      await expect(page.locator(q("[data-docdive-title]"))).toHaveText("OrderService");
      await expect(page.locator(q("[data-docdive-scenario-picker]"))).toHaveValue(SCENARIO);
      await expectPaused(page, "2");

      // An unknown selection is ignored.
      const errors = watchErrors(page);
      await open(page, "architecture/system.md", "?docdive-select=nope");
      await expect(page.locator(q("[data-docdive-title]"))).toHaveCount(0);
      expect(errors).toEqual([]);
    });

    // Same observation as A7 S6 (as amended in docs/ssg-findings.md).
    test(`T9 deletability (${site.name})`, async ({ page }) => {
      const errors = watchErrors(page);
      for (const doc of Object.keys(docUrls(map))) {
        await page.goto(`${site.plainOrigin}${map[doc]}`);
        await expect(page.locator("docdive-diagram")).toHaveCount(0);
        if (site.name === "docusaurus") {
          await expect(page.locator(".docusaurus-mermaid-container svg")).toHaveCount(fenceCount(doc));
        } else {
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
