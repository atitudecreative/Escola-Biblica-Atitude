// Reaproveita a sessão por perfil (evita esbarrar no rate limit de login durante o QA).
import { existsSync, mkdirSync } from "node:fs";
const DIR = "/tmp/claude-0/sessions";
export async function contextFor(browser, role, opts = {}) {
  mkdirSync(DIR, { recursive: true });
  const base = process.env.BASE ?? "http://localhost:3000";
  const file = `${DIR}/${role}.json`;
  if (role && role !== "-" && existsSync(file)) {
    const ctx = await browser.newContext({ ...opts, storageState: file });
    const page = await ctx.newPage();
    const res = await page.goto(`${base}/dashboard`, { waitUntil: "domcontentloaded" });
    if (!page.url().includes("/login") && res?.ok()) return { ctx, page };
    await ctx.close();
  }
  const ctx = await browser.newContext(opts);
  const page = await ctx.newPage();
  if (role && role !== "-") {
    await page.goto(`${base}/login`, { waitUntil: "networkidle" });
    await page.waitForTimeout(600);
    await page.fill('input[name="email"]', `${role}@demo.eba`);
    await page.fill('input[name="password"]', "Demo@2026");
    await page.click('button[type="submit"]');
    await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30000 });
    await ctx.storageState({ path: file });
  }
  return { ctx, page };
}
