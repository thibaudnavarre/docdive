// Screenshots of the lab: 3 styles × light/dark × desktop/mobile → .cor/design-lab/shots/
import { chromium } from "@playwright/test";
const b = await chromium.launch();
const errors = [];
for (const style of ["a", "b", "c"]) for (const theme of ["light", "dark"]) for (const [vp, w] of [["desktop", 1280], ["mobile", 390]]) {
  const p = await b.newPage({ viewport: { width: w, height: 900 } });
  p.on("pageerror", (e) => errors.push(`${style}/${theme}/${vp}: ${e.message}`));
  p.on("console", (m) => m.type() === "error" && errors.push(`${style}/${theme}/${vp}: ${m.text()}`));
  await p.goto(`http://localhost:4300/.cor/design-lab/index.html?style=${style}&theme=${theme}`);
  await p.waitForSelector("html[data-ready]", { timeout: 20000 });
  await p.waitForTimeout(300);
  await p.screenshot({ path: `.cor/design-lab/shots/${style}-${theme}-${vp}.png`, fullPage: true });
  await p.close();
}
await b.close();
console.log(errors.length ? errors.join("\n") : "no page errors");
