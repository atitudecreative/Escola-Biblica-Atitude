import { chromium } from "@playwright/test";
import { contextFor } from "./session.mjs";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const { page: p } = await contextFor(b, "aluno", { viewport: { width: 1280, height: 900 } });
const errs = []; p.on("pageerror", e => errs.push(e.message));
await p.goto("http://localhost:3000/learn/cmud4g2sb00ad7df1it686mqu/cmud4g2tc00b77df16hgqhv9c", { waitUntil: "networkidle" });
await p.screenshot({ path: "/tmp/claude-0/shots/quiz-intro.png" });
await p.getByRole("button", { name: /Começar avaliação|Tentar novamente/ }).click();
await p.waitForSelector("ol li fieldset", { timeout: 15000 });
for (const fs of await p.locator("ol > li fieldset").all()) {
  const radios = fs.locator('[role=radio]'); if (await radios.count()) { await radios.first().click(); continue; }
  const checks = fs.locator('[role=checkbox]'); if (await checks.count()) { await checks.first().click(); await checks.nth(1).click(); continue; }
  const inp = fs.locator("input,textarea"); if (await inp.count()) await inp.first().fill("aliança");
}
await p.screenshot({ path: "/tmp/claude-0/shots/quiz-running.png" });
await p.getByRole("button", { name: "Enviar respostas" }).click();
await p.getByRole("alertdialog").getByRole("button", { name: "Enviar respostas" }).click();
await p.waitForTimeout(3000);
await p.screenshot({ path: "/tmp/claude-0/shots/quiz-result.png", fullPage: true });
console.log("errors", errs);
await b.close();
