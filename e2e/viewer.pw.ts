import { test, expect, type Page } from "@playwright/test";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import matter from "gray-matter";
import { TOY, toyIndex } from "./helpers.js";

// One test per item of the frozen checklist in docs/viewer-findings.md (C1-C10).

interface Step { from: string; to: string; label: string; isReturn: boolean }
interface Index {
  diagrams: { id: string; type: string; nodes: string[]; edges: [string, string][] }[];
  elements: Record<string, { parent?: string; children?: string[]; appearsIn?: string[]; src?: string[] }>;
  scenarios: Record<string, { doc: string; steps: Step[] }>;
}
const index = toyIndex<Index>();
const scenario = "checkout-happy-path";
const steps = index.scenarios[scenario]!.steps;

const nodes = (page: Page) => page.$$eval("[data-docdive-node]", (e) => e.map((x) => x.getAttribute("data-docdive-node")));
const crumbs = (page: Page) => page.textContent("[data-docdive-breadcrumb]");
const stepNo = async (page: Page) => Number(await page.textContent("[data-docdive-step]"));
const field = (page: Page, name: string) =>
  page.locator(`[data-docdive-panel] [data-docdive-field="${name}"] [data-docdive-value]`);
const activeNodes = (page: Page) =>
  page.$$eval("[data-docdive-node][data-docdive-active]", (e) => e.map((x) => x.getAttribute("data-docdive-node")!).sort());
const activeEdges = (page: Page) =>
  page.$$eval("[data-docdive-edge][data-docdive-active]", (e) => e.map((x) => x.getAttribute("data-docdive-edge")!));

async function open(page: Page, query = ""): Promise<void> {
  await page.goto(`/${query}`);
  await page.waitForSelector("[data-docdive-node]");
}
async function dive(page: Page, id: string, expectNode: string): Promise<void> {
  await page.click(`[data-docdive-node="${id}"]`);
  await page.waitForSelector(`[data-docdive-node="${expectNode}"]`);
}

test("C1 render and ID mapping", async ({ page }) => {
  await open(page);
  const system = index.diagrams.find((d) => d.id === "architecture/system.md#0")!;
  for (const id of system.nodes) await expect(page.locator(`[data-docdive-node="${id}"]`)).toHaveCount(1);
  await expect(page.locator("[data-docdive-error]")).toHaveText("");
});

test("C2 deep dive across three levels", async ({ page }) => {
  await open(page);
  await page.click('[data-docdive-node="API"]');
  expect(await nodes(page)).toEqual(["API", "OrderService", "PaymentGateway", "OrdersDB"]);
  await dive(page, "OrderService", "Controller");
  expect(await nodes(page)).toEqual(["Controller", "Validator", "Repository"]);
  await dive(page, "Validator", "SchemaCheck");
  expect(await nodes(page)).toEqual(["SchemaCheck", "StockCheck"]);
});

test("C3 breadcrumb and back", async ({ page }) => {
  await open(page);
  await dive(page, "OrderService", "Controller");
  await dive(page, "Validator", "SchemaCheck");
  expect(await crumbs(page)).toBe("system › OrderService › Validator");
  await page.click('[data-docdive-crumb="OrderService"]');
  await page.waitForSelector('[data-docdive-node="Controller"]');
  expect(await nodes(page)).toEqual(["Controller", "Validator", "Repository"]);
  await page.click("[data-docdive-back]");
  await page.waitForSelector('[data-docdive-node="SchemaCheck"]');
  expect(await crumbs(page)).toBe("system › OrderService › Validator");
});

test("C4 info panel, documented element", async ({ page }) => {
  await open(page);
  await dive(page, "OrderService", "Controller");
  const e = index.elements["OrderService"]!;
  await expect(field(page, "parent")).toHaveText(e.parent!);
  await expect(field(page, "children")).toHaveText(e.children!.join(", "));
  await expect(field(page, "appearsIn")).toHaveText(e.appearsIn!.join(", "));
  await expect(field(page, "scenarios")).toHaveText(scenario);
  await expect(field(page, "src")).toHaveText(e.src!.join(", "));
});

test("C5 info panel, undocumented element", async ({ page }) => {
  await open(page);
  await page.click('[data-docdive-node="PaymentGateway"]');
  const e = index.elements["PaymentGateway"]!;
  await expect(field(page, "parent")).toHaveText(e.parent!);
  await expect(field(page, "appearsIn")).toHaveText(e.appearsIn!.join(", "));
  await expect(field(page, "scenarios")).toHaveText(scenario);
  await expect(field(page, "children")).toHaveCount(0);
  await expect(field(page, "src")).toHaveCount(0);
  await expect(page.locator("[data-docdive-error]")).toHaveText("");
});

test("C6 trace on the flowchart", async ({ page }) => {
  await open(page);
  await expect(page.locator(`[data-docdive-scenario-picker] option[value="${scenario}"]`)).toHaveCount(1);
  const edgesByStep: string[][] = [];
  for (let i = 0; i < steps.length; i++) {
    await page.click("[data-docdive-next]");
    expect(await stepNo(page)).toBe(i + 1);
    const s = steps[i]!;
    expect(await activeNodes(page)).toEqual([s.from, s.to].sort());
    edgesByStep.push(await activeEdges(page));
    expect(edgesByStep[i]).toHaveLength(1);
  }
  // A return highlights the same pair (and here the same edge) as its forward step.
  expect(edgesByStep[2]).toEqual(edgesByStep[1]);
  expect(edgesByStep[4]).toEqual(edgesByStep[3]);
  await expect(page.locator("[data-docdive-next]")).toBeDisabled();
  await page.click("[data-docdive-prev]");
  expect(await stepNo(page)).toBe(steps.length - 1);
  expect(await activeNodes(page)).toEqual([steps[4]!.from, steps[4]!.to].sort());
  // A3 (recorded, not gated): which parallel edge each message highlighted.
  test.info().annotations.push({
    type: "A3",
    description: `charge()->${edgesByStep[1]}; ok->${edgesByStep[2]}; capture()->${edgesByStep[3]}; ok->${edgesByStep[4]}`,
  });
});

test("C7 play and pause", async ({ page }) => {
  await open(page, "?interval=200");
  await page.click("[data-docdive-play]");
  await expect.poll(() => stepNo(page), { timeout: 2000 }).toBeGreaterThanOrEqual(2);
  await page.click("[data-docdive-pause]");
  const frozen = await stepNo(page);
  await page.waitForTimeout(600);
  expect(await stepNo(page)).toBe(frozen);
});

test("C8 trace across diagrams", async ({ page }) => {
  await open(page);
  const through = page.locator('[data-docdive-through="OrderService"]');
  const goTo = async (n: number): Promise<void> => {
    while ((await stepNo(page)) > n) await page.click("[data-docdive-prev]");
    while ((await stepNo(page)) < n) await page.click("[data-docdive-next]");
  };
  await page.click("[data-docdive-next]");
  await dive(page, "OrderService", "Controller");
  for (const level of ["OrderService", "Validator"]) {
    if (level === "Validator") await dive(page, "Validator", "SchemaCheck");
    for (let i = 0; i <= steps.length; i++) {
      await goTo(i);
      const s = steps[i - 1];
      const involved = !!s && (s.from === "OrderService" || s.to === "OrderService");
      await expect(through, `${level} step ${i}`).toHaveCount(involved ? 1 : 0);
    }
  }
  // Step number is preserved when navigating between diagrams.
  const before = await stepNo(page);
  await page.click('[data-docdive-crumb="system"]');
  await page.waitForSelector('[data-docdive-node="API"]');
  expect(await stepNo(page)).toBe(before);
});

test("C9 trace on the sequence diagram", async ({ page }) => {
  await open(page);
  await page.click("[data-docdive-show-sequence]");
  await page.waitForSelector("[data-docdive-message]");
  await expect(page.locator("[data-docdive-error]")).toHaveText("");
  for (let i = 0; i < steps.length; i++) {
    await page.click("[data-docdive-next]");
    const active = await page.$$eval("[data-docdive-message][data-docdive-active]", (e) =>
      e.map((x) => ({ n: x.getAttribute("data-docdive-message"), t: x.tagName.toLowerCase(), text: (x.textContent ?? "").trim() })),
    );
    expect(new Set(active.map((a) => a.n))).toEqual(new Set([String(i + 1)]));
    expect(active.find((a) => a.t === "text")?.text).toBe(steps[i]!.label);
  }
});

test("C10 zero extra syntax", () => {
  const files: string[] = [];
  const walk = (dir: string): void => {
    for (const f of readdirSync(dir)) {
      const p = join(dir, f);
      if (statSync(p).isDirectory()) walk(p);
      else if (f.endsWith(".md")) files.push(p);
    }
  };
  walk(TOY);
  expect(files.length).toBeGreaterThanOrEqual(4);
  for (const f of files) {
    const { data, content } = matter(readFileSync(f, "utf8"));
    expect(Object.keys(data).filter((k) => !["id", "parent", "src", "kind"].includes(k)), f).toEqual([]);
    expect(content.replace(/```mermaid\n[\s\S]*?```/g, "").trim(), f).toBe("");
  }
});
