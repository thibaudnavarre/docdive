import { test, expect, type Page } from "@playwright/test";
import { SITES, docMap, toyContexts, toyIndex, watchErrors } from "./helpers.js";

// Scenario animation (rail, play/pause, sequence, deep dive with trace, state strip), copy context and copy link, on
// both example sites. Expected values come from `docdive build fixtures/toy`.

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

const contexts = toyContexts();

const q = (sel: string) => `docdive-diagram ${sel}`;
const stepText = (page: Page) => page.locator(q("[data-docdive-step]")).textContent();
// The rail is the slider: ←/→ move one step, a mark jumps to its step.
const next = (page: Page) => page.locator(q("[data-docdive-scrub]")).press("ArrowRight");
const prev = (page: Page) => page.locator(q("[data-docdive-scrub]")).press("ArrowLeft");
const activeNodes = (page: Page) =>
  page.$$eval(q("[data-docdive-node][data-docdive-active]"), (e) => e.map((x) => x.getAttribute("data-docdive-node")!).sort());

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
      map = await docMap(site.origin);
    });

    test(`T1 trace bar on the flowchart (${site.name})`, async ({ page }) => {
      await open(page, "architecture/system.md");
      const before = page.url();
      await expect(page.locator(q("[data-docdive-trace]"))).toBeVisible();
      expect(await page.locator(q("[data-docdive-scenario-picker] option")).allTextContents()).toContain(SCENARIO);
      await expect(page.locator(q("[data-docdive-mark]"))).toHaveCount(steps.length);
      for (let i = 1; i <= steps.length; i++) {
        await next(page);
        await expect(page.locator(q("[data-docdive-step]"))).toHaveText(String(i));
        await expect(page.locator(q("[data-docdive-scrub]"))).toHaveAttribute("aria-valuenow", String(i));
        const s = steps[i - 1]!;
        expect(await activeNodes(page)).toEqual([...new Set([s.from, s.to])].sort());
      }
      await next(page);
      await expect(page.locator(q("[data-docdive-step]"))).toHaveText(String(steps.length));
      await prev(page);
      await expect(page.locator(q("[data-docdive-step]"))).toHaveText(String(steps.length - 1));
      await page.click(q('[data-docdive-mark="2"]'));
      await expect(page.locator(q("[data-docdive-step]"))).toHaveText("2");
      await expect(page.locator(q('[data-docdive-mark="2"]'))).toHaveAttribute("aria-current", "step");
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
        await next(page);
        const active = page.locator(q("text[data-docdive-active]"));
        await expect(active).toHaveCount(1);
        await expect(active).toHaveText(steps[i - 1]!.label);
      }
      // A message is a step: clicking its label jumps there and pauses.
      await page.click(q('text[data-docdive-message="2"]'));
      await expectPaused(page, "2");
      await expect(page.locator(q("[data-docdive-scrub]"))).toHaveAttribute("aria-valuenow", "2");
      // The SVG never shrinks below its natural width (the card scrolls instead).
      const svg = page.locator(q("svg"));
      const natural = (await svg.getAttribute("viewBox"))!.split(/\s+/)[2];
      await expect(svg).toHaveCSS("min-width", `${natural}px`);
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

      await next(page);
      await next(page);
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
        await expect(page.locator(q("[data-docdive-copy-status]"))).toHaveText("Copied");
        expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(contexts[id]);
      });
    }

    test(`T11 state strip follows the step, by participant and by entity (${site.name})`, async ({ page }) => {
      await open(page, "architecture/system.md", `?docdive-scenario=${SCENARIO}&docdive-step=2`);
      const strip = page.locator(q("[data-docdive-state]"));
      await expect(strip.locator("[data-docdive-state-card]")).toHaveCount(3);
      // Step 2 writes OrderService (status=pending) and PaymentGateway; API's draft card is unchanged.
      await expect(strip.locator('[data-docdive-state-card="OrderService"]')).toHaveAttribute("data-changed", "");
      await expect(strip.locator('[data-docdive-state-card="API"]')).not.toHaveAttribute("data-changed", "");
      await expect(strip.locator('[data-docdive-state-card="OrderService"] [data-docdive-field-chip="status"] .v')).toHaveText("pending");
      // Step 6: fields accumulate, later wins (API's Order goes draft → paid), and the DB row appears.
      await page.click(q('[data-docdive-mark="6"]'));
      await expect(strip.locator('[data-docdive-state-card="API"] [data-docdive-field-chip="status"] .v')).toHaveText("paid");
      await expect(strip.locator('[data-docdive-state-card="API"] [data-docdive-field-chip="items"]')).not.toHaveAttribute("data-changed", "");
      await expect(strip.locator('[data-docdive-state-card="OrdersDB"] [data-docdive-field-chip="id"] .v')).toHaveText("42");
      // The card title selects the element; the inspector shows the same state.
      await page.click(q('[data-docdive-state-owner="OrdersDB"]'));
      await expect(page.locator(q("[data-docdive-title]"))).toHaveText("OrdersDB");
      await expect(page.locator(q('[data-docdive-field="state"] [data-docdive-field-chip="status"] .v'))).toHaveText("paid");
      // Entity mode: Order's trail, past and future; a trail step jumps.
      await page.click(q('[data-docdive-state-mode="entities"]'));
      const order = strip.locator('[data-docdive-trail="Order"]');
      await expect(order.locator("li")).toHaveCount(5);
      await expect(order.locator("li[data-future]")).toHaveCount(0);
      await order.locator('[data-docdive-trail-step="1"]').click();
      await expect(page.locator(q("[data-docdive-step]"))).toHaveText("1");
      await expect(order.locator("li[data-future]")).toHaveCount(4);
      // A child page shows only its own state.
      await open(page, "architecture/orders-db.md", `?docdive-scenario=${SCENARIO}&docdive-step=6`);
      await expect(page.locator(q("[data-docdive-state-card]"))).toHaveCount(1);
      await expect(page.locator(q('[data-docdive-state-card="OrdersDB"]'))).toBeVisible();
    });

    test(`T10 copy link restores selection and trace (${site.name})`, async ({ page, context }) => {
      await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: site.origin });
      const copyLink = async () => {
        await page.click(q("[data-docdive-copy-link]"));
        await expect(page.locator(q("[data-docdive-copy-link-status]"))).toHaveText("Copied");
        return page.evaluate(() => navigator.clipboard.readText());
      };
      await open(page, "architecture/system.md");
      await page.click(q('[data-docdive-node="OrderService"]'));
      expect(await copyLink()).toBe(url("architecture/system.md", "?docdive-select=OrderService"));

      await next(page);
      await next(page);
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
  });
}
