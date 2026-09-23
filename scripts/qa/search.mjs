import { chromium } from "@playwright/test";
import { contextFor } from "./session.mjs";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const { page } = await contextFor(b, "aluno");
for (const q of ["biblia", "LIDERANCA", "hermeneutica", "andre"]) {
  await page.goto(`http://localhost:3000/search?q=${q}`, { waitUntil: "domcontentloaded" });
  console.log(q, "→", await page.locator("header p").first().innerText());
}
await b.close();
