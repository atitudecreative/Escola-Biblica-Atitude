// QA da Home: prévia ao passar o mouse (desktop) e clique no card → página do curso.
// Uso: CHROME=... node scripts/qa/home.mjs <saida-prefixo> [largura] [perfil|-]
import { chromium } from "playwright";
import { contextFor } from "./session.mjs";
const [out = "/tmp/home", w = "1440", role = "-"] = process.argv.slice(2);
const base = process.env.BASE ?? "http://localhost:3000";
const browser = await chromium.launch({ executablePath: process.env.CHROME });
const { page: p } = await contextFor(browser, role, { viewport: { width: +w, height: 900 } });
const errors = [];
p.on("console", (m) => m.type() === "error" && errors.push(m.text()));
p.on("pageerror", (e) => errors.push(e.message));
await p.goto(`${base}/`, { waitUntil: "networkidle" });
const card = p.locator("#destaques a[href^='/courses/']").first();
await card.scrollIntoViewIfNeeded();
await p.screenshot({ path: `${out}-0.png` });
const result = { width: +w };
if (+w >= 1024) {
  const bb = await card.boundingBox();
  await p.mouse.move(bb.x + bb.width / 2, bb.y + 60, { steps: 4 });
  await p.waitForTimeout(1800);
  await p.screenshot({ path: `${out}-1-preview.png` });
  result.preview = await p.evaluate(() => {
    const v = document.querySelector("#destaques video");
    return v ? { playing: !v.paused, muted: v.muted } : "sem vídeo (capa)";
  });
  await p.mouse.move(2, 2);
  await p.waitForTimeout(300);
  result.previewClosed = (await p.locator("#destaques video").count()) === 0;
}
const href = await card.getAttribute("href");
await card.click();
await p.waitForURL((u) => u.pathname === href, { timeout: 15000 });
result.navigatedTo = href;
result.overflow = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
result.errors = errors;
console.log(JSON.stringify(result, null, 1));
await browser.close();
