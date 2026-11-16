import { test, expect } from "@playwright/test";

// Selecting a node shows a Source link to the repo web page at the node's Markdown line. The example sites set
// the GitHub edit URL (Docusaurus `editUrl`, MkDocs `repo_url` + `edit_uri`); the element rewrites it to /blob/.
// Fixture: fixtures/toy/architecture/system.md declares OrdersDB on line 8.
const DOC = "architecture/system.md";
const SITES = [
  { name: "docusaurus", origin: "http://localhost:4201" },
  { name: "mkdocs", origin: "http://localhost:4202" },
];

for (const site of SITES) {
  test(`Source link opens the repo page at the node line (${site.name})`, async ({ page }) => {
    const map = (await (await fetch(`${site.origin}/docdive/docdive/docdive-map.json`)).json()) as Record<string, string>;
    await page.goto(`${site.origin}${map[DOC]}`);
    await page.locator('docdive-diagram [data-docdive-node="OrdersDB"]').click();
    const source = page.locator("docdive-diagram [data-docdive-source]");
    await expect(source).toHaveAttribute("href", "https://github.com/thibaudnavarre/docdive/blob/main/fixtures/toy/architecture/system.md#L8");
    await expect(source).toHaveAttribute("target", "_blank");
  });
}
