// Utilitário de QA visual: node scripts/shot.mjs <role|-> <out-prefix> <path...>
// Env: W (largura), H, THEME=dark, FULL=1
import { chromium } from "@playwright/test";
const [role, prefix, ...paths] = process.argv.slice(2);
const base = process.env.BASE ?? "http://localhost:3000";
const browser = await chromium.launch({ executablePath: process.env.CHROME ?? undefined });
const ctx = await browser.newContext({ viewport: { width: +(process.env.W ?? 1440), height: +(process.env.H ?? 900) }, colorScheme: process.env.THEME === "dark" ? "dark" : "light", deviceScaleFactor: 1 });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
page.on("console", (m) => { if (m.type() === "error") errors.push(`console: ${m.text()}`); });
if (role && role !== "-") {
  await page.goto(`${base}/login`);
  await page.fill('input[name="email"]', `${role}@demo.eba`);
  await page.fill('input[name="password"]', "Demo@2026");
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30000 });
}
for (const [i, p] of paths.entries()) {
  const res = await page.goto(base + p, { waitUntil: "networkidle", timeout: 60000 }).catch((e) => ({ status: () => "ERR " + e.message }));
  await page.waitForTimeout(+(process.env.WAIT ?? 400));
  const file = `${prefix}-${i}.png`;
  await page.screenshot({ path: file, fullPage: !!process.env.FULL });
  console.log(p, res?.status?.(), "→", file);
}
if (errors.length) console.log("ERRORS:\n" + [...new Set(errors)].join("\n"));
await browser.close();
