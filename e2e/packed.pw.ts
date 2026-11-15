import { test, expect, type Page } from "@playwright/test";
import { join } from "node:path";
import { docdive, toyIndex } from "./helpers.js";

// Sites built from the packed tarballs (scripts/pack-test.sh): render, trace a scenario, copy context.

interface Step {
  from: string;
  to: string;
}
interface Index {
  diagrams: { id: string; nodes: string[] }[];
  scenarios: Record<string, { steps: Step[] }>;
}
const index = toyIndex<Index>();
const SYSTEM = "architecture/system.md";
const steps = index.scenarios["checkout-happy-path"]!.steps;

const SITES = [
  { name: "docusaurus", origin: "http://localhost:4301", mermaid: "injected" },
  { name: "mkdocs", origin: "http://localhost:4302", mermaid: "bundled" },
];

const q = (sel: string) => `docdive-diagram ${sel}`;

for (const site of SITES) {
  test.describe(site.name, () => {
    let map: Record<string, string>;
    test.beforeAll(async () => {
      map = (await (await fetch(`${site.origin}/docdive/docdive/docdive-map.json`)).json()) as Record<string, string>;
    });
    const open = async (page: Page) => {
      await page.goto(`${site.origin}${map[SYSTEM]}`);
      await page.waitForSelector(q("[data-docdive-node]"));
    };

    test(`P1 renders and maps ids (${site.name})`, async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await open(page);
      await expect(page.locator("docdive-diagram")).toHaveAttribute("data-docdive-diagram", `${SYSTEM}#0`);
      await expect(page.locator("docdive-diagram")).toHaveAttribute("data-docdive-mermaid", site.mermaid);
      const nodes = await page.$$eval(q("[data-docdive-node]"), (e) => e.map((x) => x.getAttribute("data-docdive-node")!));
      expect(new Set(nodes)).toEqual(new Set(index.diagrams.find((d) => d.id === `${SYSTEM}#0`)!.nodes));
      await expect(page.locator(q("[data-docdive-error]"))).toHaveText("");
      expect(errors).toEqual([]);
    });

    test(`P2 traces a scenario (${site.name})`, async ({ page }) => {
      await open(page);
      await page.click(q("[data-docdive-next]"));
      await expect(page.locator(q("[data-docdive-step]"))).toHaveText("1");
      const active = await page.$$eval(q("[data-docdive-node][data-docdive-active]"), (e) =>
        e.map((x) => x.getAttribute("data-docdive-node")!).sort(),
      );
      expect(active).toEqual([...new Set([steps[0]!.from, steps[0]!.to])].sort());
    });

    test(`P3 copies the context (${site.name})`, async ({ page, context }) => {
      await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: site.origin });
      await open(page);
      await page.click(q('[data-docdive-node="OrderService"]'));
      await page.click(q("[data-docdive-copy]"));
      await expect(page.locator(q("[data-docdive-copy-status]"))).toHaveText("ok");
      expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
        // The docs sit next to the site config here, so the CLI infers more than on the bare fixture: compare in place.
        docdive("context", "OrderService", "--folder", join(process.env.PACK_DIR!, site.name, "docs")).slice(0, -1),
      );
    });
  });
}
