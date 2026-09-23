// Utilitário de QA visual: node scripts/shot.mjs <role|-> <out-prefix> <path...>
// Env: W (largura), H, THEME=dark, FULL=1
import { chromium } from "@playwright/test";
import { contextFor } from "./qa/session.mjs";
const [role, prefix, ...paths] = process.argv.slice(2);
const base = process.env.BASE ?? "http://localhost:3000";
const browser = await chromium.launch({ executablePath: process.env.CHROME ?? undefined });
const { page } = await contextFor(browser, role, { viewport: { width: +(process.env.W ?? 1440), height: +(process.env.H ?? 900) }, colorScheme: process.env.THEME === "dark" ? "dark" : "light", deviceScaleFactor: 1 });
const errors = [];
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
page.on("console", (m) => { if (m.type() === "error") errors.push(`console: ${m.text()}`); });
for (const [i, p] of paths.entries()) {
  const res = await page.goto(base + p, { waitUntil: "networkidle", timeout: 60000 }).catch((e) => ({ status: () => "ERR " + e.message }));
  await page.waitForTimeout(+(process.env.WAIT ?? 400));
  const file = `${prefix}-${i}.png`;
  await page.screenshot({ path: file, fullPage: !!process.env.FULL });
  console.log(p, res?.status?.(), "→", file);
}
if (errors.length) console.log("ERRORS:\n" + [...new Set(errors)].join("\n"));
await browser.close();
