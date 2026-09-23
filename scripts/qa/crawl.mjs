// QA automatizado: para cada perfil, visita todos os links da navegação (sidebar)
// e algumas páginas de detalhe, em desktop e mobile. Reporta status, erros de
// console/página e overflow horizontal.  Uso: node scripts/qa/crawl.mjs [perfil...]
import { chromium } from "@playwright/test";
import { contextFor } from "./session.mjs";
const base = "http://localhost:3000";
const roles = process.argv.slice(2).length ? process.argv.slice(2) : ["aluno", "professor", "gestor", "admin"];
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
let problems = 0;
for (const role of roles) {
  const { ctx, page } = await contextFor(browser, role, { viewport: { width: 1440, height: 900 } });
  await page.goto(`${base}/dashboard`, { waitUntil: "domcontentloaded" });
  const links = await page.$$eval('nav[aria-label="Navegação principal"] a', (as) => [...new Set(as.map((a) => a.getAttribute("href")))]);
  const extra = ["/", "/courses", "/courses/panorama-do-antigo-testamento", "/profile", "/profile/settings", "/search?q=biblia", "/certificate/EBA-2026-DEMO-7K3P", "/community/new"];
  const urls = [...new Set([...links, ...extra])];
  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, storageState: await ctx.storageState() });
  const mpage = await mobile.newPage();
  for (const url of urls) {
    for (const [label, p] of [["desktop", page], ["mobile", mpage]]) {
      const errors = [];
      const onErr = (e) => errors.push(e.message);
      const onCon = (m) => m.type() === "error" && !/Failed to load resource/.test(m.text()) && errors.push(m.text().slice(0, 200));
      p.on("pageerror", onErr); p.on("console", onCon);
      let status = "ERR";
      try {
        const res = await p.goto(base + url, { waitUntil: "networkidle", timeout: 90000 });
        status = res?.status();
        await p.waitForTimeout(300);
      } catch (e) { errors.push(String(e).slice(0, 150)); }
      const overflow = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth).catch(() => 0);
      p.off("pageerror", onErr); p.off("console", onCon);
      const bad = status !== 200 || errors.length || overflow > 1;
      if (bad) {
        problems++;
        console.log(`✗ [${role}/${label}] ${url} status=${status} overflow=${overflow}${errors.length ? "\n    " + [...new Set(errors)].join("\n    ") : ""}`);
      }
    }
  }
  console.log(`✓ ${role}: ${urls.length} rotas verificadas`);
  await mobile.close(); await ctx.close();
}
console.log(problems ? `\n${problems} problema(s) encontrado(s)` : "\nNenhum problema encontrado");
await browser.close();
