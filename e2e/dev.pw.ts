import { test, expect } from "@playwright/test";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { TOY } from "./helpers.js";

// `docusaurus start` on examples/docusaurus: the theme serves the docdive assets and keeps the data fresh.
const ORIGIN = "http://localhost:4301";
const PAGE = `${ORIGIN}/docdive/docs/architecture/system`;
const SYSTEM = join(TOY, "architecture", "system.md");
const nodeIds = (page: import("@playwright/test").Page) =>
  page.$$eval("docdive-diagram [data-docdive-node]", (e) => e.map((x) => x.getAttribute("data-docdive-node")!));

test("dev server: interactive diagram, and a Markdown edit shows up after a reload", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));

  await page.goto(PAGE);
  await page.waitForSelector("docdive-diagram [data-docdive-node]");
  expect(await nodeIds(page)).not.toContain("Cache");
  await page.click('docdive-diagram [data-docdive-node="OrderService"]');
  await expect(page.locator("docdive-diagram [data-docdive-panel] [data-docdive-title]")).toHaveText("OrderService");
  expect(errors).toEqual([]);

  const original = readFileSync(SYSTEM, "utf8");
  try {
    writeFileSync(SYSTEM, original.replace("```\n", "  API --> Cache\n```\n"));
    await expect
      .poll(async () => (await fetch(`${ORIGIN}/docdive/docdive/index.json`)).text(), { timeout: 15_000 })
      .toContain('"Cache"');
    await page.reload();
    await page.waitForSelector('docdive-diagram [data-docdive-node="Cache"]');
  } finally {
    writeFileSync(SYSTEM, original);
  }
});
