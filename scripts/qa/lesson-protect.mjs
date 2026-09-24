// QA da aula protegida: stream pessoal, bloqueio de abertura direta, limite de avanço,
// cobertura registrada no servidor, próxima aula bloqueada e comentários removidos ocultos.
// Uso: CHROME=... node scripts/qa/lesson-protect.mjs <courseId> <lessonId> <fileId> [nextLessonId] [saida]
import { chromium } from "playwright";
import { contextFor } from "./session.mjs";
const [courseId, lessonId, fileId, nextId, out = "/tmp/lesson"] = process.argv.slice(2);
const base = process.env.BASE ?? "http://localhost:3000";
const browser = await chromium.launch({ executablePath: process.env.CHROME });
const { ctx, page: p } = await contextFor(browser, "aluno", { viewport: { width: 1440, height: 900 } });
const errors = [];
p.on("pageerror", (e) => errors.push(e.message));
const r = {};
await p.goto(`${base}/learn/${courseId}/${lessonId}`, { waitUntil: "networkidle" });
const v = p.locator("video");
await v.waitFor();
await p.waitForFunction(() => document.querySelector("video")?.readyState >= 1, null, { timeout: 15000 });
r.src = await v.evaluate((el) => el.currentSrc.replace(location.origin, "").slice(0, 20) + "…");
r.videoLoads = await v.evaluate((el) => el.readyState >= 1 && el.duration > 0);
const stream = await v.evaluate((el) => el.currentSrc);

// Abrir o endereço do vídeo numa aba / via fetch do console / arquivo direto: tudo recusado.
const tab = await ctx.newPage();
r.openInTab = (await tab.goto(stream))?.status();
r.fetchFromConsole = await p.evaluate((u) => fetch(u).then((x) => x.status), stream);
r.filesRoute = (await tab.goto(`${base}/api/files/${fileId}`))?.status();
await tab.close();

// Pular para o final pela barra: fica limitado ao já assistido.
await p.locator('input[aria-label="Posição do vídeo"]').fill("140");
await p.waitForTimeout(400);
r.afterSeekToEnd = await v.evaluate((el) => Math.round(el.currentTime));

// Assiste 24s a 2x (≈48s de vídeo) e espera o envio ao servidor.
await v.evaluate((el) => { el.muted = true; el.playbackRate = 2; return el.play(); });
await p.waitForTimeout(24_000);
await v.evaluate((el) => el.pause());
await p.waitForTimeout(2500);
r.watchedLabel = await p.getByText(/% assistido/).first().textContent().catch(() => null);
r.completeButton = await p.getByRole("button", { name: /Marcar como concluída|Concluir e avançar/ }).count();
r.headerNextDisabled = await p.getByRole("button", { name: "Conclua esta aula para liberar a próxima" }).isDisabled().catch(() => "n/a");
await p.screenshot({ path: `${out}-1.png` });

await p.getByRole("tab", { name: /Comentários/ }).click();
r.removedCommentVisible = (await p.getByText("COMENTARIO-REMOVIDO-QA").count()) > 0;
r.removedPlaceholder = (await p.getByText("Comentário removido.").count()) > 0;

if (nextId) {
  await p.goto(`${base}/learn/${courseId}/${nextId}`, { waitUntil: "networkidle" });
  r.nextLocked = (await p.getByText("Esta aula ainda está bloqueada").count()) > 0;
}
r.errors = errors;
console.log(JSON.stringify(r, null, 1));
await browser.close();
