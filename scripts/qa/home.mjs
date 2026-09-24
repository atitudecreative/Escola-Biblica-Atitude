// QA da Home: expande um card, captura as etapas e verifica foco/Esc/overflow.
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
const card = p.locator("#destaques a[aria-expanded]").first();
await card.scrollIntoViewIfNeeded();
await p.screenshot({ path: `${out}-0.png` });
await card.click();
await p.waitForTimeout(180);
await p.screenshot({ path: `${out}-1-mid.png` });
await p.waitForTimeout(700);
await p.screenshot({ path: `${out}-2-open.png` });
const expanded = await card.getAttribute("aria-expanded").catch(() => "(card substituído)");
const focused = await p.evaluate(() => document.activeElement?.getAttribute("data-panel-title") !== null ? "título do painel" : document.activeElement?.tagName);
const overflow = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
await p.keyboard.press("Escape");
await p.waitForTimeout(500);
const closed = await p.locator("#featured-panel").count();
console.log(JSON.stringify({ width: +w, expanded, focused, overflow, panelAfterEsc: closed, errors }, null, 1));
await browser.close();
