// Gera o fundo decorativo das páginas (public/bg/pattern-{light,dark}.svg).
// Um painel geométrico (1600×1100), exibido uma vez no topo da página: círculos cheios/contorno,
// arcos concêntricos, ondas, "×" e anel pontilhado.
// Cores: preto + verde-limão #C7E600. Uso: node scripts/gen-backdrop.mjs
import { mkdirSync, writeFileSync } from "node:fs";

const W = 1600;
const H = 1100;
const LIME = "#C7E600";

const THEMES = {
  // tema claro: preto suave, limão marcado nas linhas
  light: { ink: "#0b0d0c", inkFill: 0.07, inkLine: 0.2, limeFill: 0.28, limeLine: 0.75 },
  // tema escuro: preto aprofunda as manchas, limão mais contido
  dark: { ink: "#000000", inkFill: 0.5, inkLine: 0.55, limeFill: 0.1, limeLine: 0.38 },
};

const f = (n) => Number(n.toFixed(1));

function xMark(x, y, s, stroke, w) {
  return `<path d="M${x} ${y} l${s} ${s} M${x + s} ${y} l${-s} ${s}" stroke="${stroke}" stroke-width="${w}" stroke-linecap="round"/>`;
}

function panelGeometric(t, oy) {
  const ink = t.ink;
  let s = `<g transform="translate(0 ${oy})">`;
  s += `<circle cx="90" cy="30" r="190" fill="${ink}" opacity="${t.inkFill}"/>`;
  s += `<circle cx="190" cy="190" r="86" fill="none" stroke="${LIME}" stroke-width="3" opacity="${t.limeLine}"/>`;
  s += `<g fill="none" stroke="${LIME}" opacity="${t.limeLine}">`;
  for (let i = 0; i < 8; i++) {
    const r = 150 + i * 14;
    s += `<path d="M${1160 - r} 0 A ${r} ${r} 0 0 0 1160 ${r}" stroke-width="2"/><path d="M1160 ${r} A ${r} ${r} 0 0 0 ${1160 + r} 0" stroke-width="7"/>`;
  }
  s += `</g>`;
  s += `<circle cx="1330" cy="330" r="52" fill="${ink}" opacity="${t.inkFill * 1.6}"/>`;
  const zig = (x, y) => `M${x} ${y} c0 -14 22 -14 22 0 s-22 14 -22 28 s22 14 22 28 s-22 14 -22 28 s22 14 22 28`;
  s += `<path d="${zig(1478, 190)}" fill="none" stroke="${LIME}" stroke-width="9" stroke-linecap="round" opacity="${t.limeLine}"/>`;
  s += `<path d="${zig(110, 650)}" fill="none" stroke="${ink}" stroke-width="9" stroke-linecap="round" opacity="${t.inkLine}"/>`;
  s += `<g opacity="${t.inkLine}">${xMark(122, 350, 40, ink, 6)}${xMark(880, 140, 24, ink, 6)}${xMark(1100, 840, 18, ink, 6)}</g>`;
  s += `<g opacity="${t.limeLine}">${xMark(620, 520, 16, LIME, 5)}</g>`;
  s += `<circle cx="210" cy="870" r="400" fill="${LIME}" opacity="${t.limeFill}"/>`;
  s += `<path d="M360 1100 A 190 190 0 0 1 740 1100" fill="none" stroke="${ink}" stroke-width="5" opacity="${t.inkLine}"/>`;
  s += `<g fill="${LIME}" opacity="${t.limeLine}">`;
  for (let ring = 0; ring < 4; ring++) {
    const r = 92 + ring * 18;
    const n = 30 + ring * 6;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      s += `<circle cx="${f(1330 + Math.cos(a) * r)}" cy="${f(800 + Math.sin(a) * r)}" r="4.5"/>`;
    }
  }
  s += `</g>`;
  s += `<circle cx="1520" cy="1060" r="300" fill="${ink}" opacity="${t.inkFill}"/>`;
  return s + `</g>`;
}

mkdirSync("public/bg", { recursive: true });
for (const [name, t] of Object.entries(THEMES)) {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMin slice">` +
    panelGeometric(t, 0) +
    `</svg>`;
  writeFileSync(`public/bg/pattern-${name}.svg`, svg);
  console.log(`public/bg/pattern-${name}.svg`, (svg.length / 1024).toFixed(1), "KB");
}
