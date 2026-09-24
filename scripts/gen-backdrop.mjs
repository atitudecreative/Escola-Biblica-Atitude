// Gera o fundo decorativo das páginas (public/bg/pattern-{light,dark}.svg).
// Três painéis empilhados (1600×1100 cada) que se repetem na vertical:
//   1) geométrico — círculos cheios/contorno, arcos concêntricos, ondas, "×", anel pontilhado
//   2) manchas orgânicas com feixes de linhas onduladas
//   3) ondas com feixes de linhas, círculos e fileiras de "×"
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

/** Feixe de linhas paralelas: a mesma curva deslocada n vezes. */
function bundle(d, n, dx, dy, stroke, width = 1.6) {
  let out = "";
  for (let i = 0; i < n; i++) {
    out += `<path d="${d}" transform="translate(${f(i * dx)} ${f(i * dy)})" fill="none" stroke="${stroke}" stroke-width="${width}"/>`;
  }
  return out;
}

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

function panelBlobs(t, oy) {
  const ink = t.ink;
  let s = `<g transform="translate(0 ${oy})">`;
  // faixa orgânica superior e inferior (manchas)
  s += `<path d="M0 0 H1600 V170 C1400 250 1250 130 1060 190 C860 250 760 90 560 150 C380 205 180 60 0 140 Z" fill="${ink}" opacity="${t.inkFill}"/>`;
  s += `<path d="M1600 0 V330 C1400 360 1220 280 1110 150 C1060 90 1030 40 1020 0 Z" fill="${LIME}" opacity="${t.limeFill}"/>`;
  s += `<path d="M0 1100 V820 C150 780 330 800 440 880 C520 940 560 1030 600 1100 Z" fill="${LIME}" opacity="${t.limeFill}"/>`;
  s += `<path d="M560 1100 C700 980 900 1040 1040 1000 C1220 950 1350 870 1600 910 V1100 Z" fill="${ink}" opacity="${t.inkFill}"/>`;
  // feixes de linhas onduladas
  s += `<g opacity="${t.inkLine}">${bundle("M1000 -20 C1060 120 1180 180 1300 200 C1440 225 1500 330 1490 470 C1480 620 1560 700 1640 760", 16, 7, 0, ink)}</g>`;
  s += `<g opacity="${t.limeLine}">${bundle("M-20 560 C20 700 10 820 120 880 C260 950 420 900 560 940 C660 970 700 1060 760 1120", 16, 0, 9, LIME)}</g>`;
  s += `<g opacity="${t.limeLine}">${bundle("M620 900 C700 870 760 930 800 1000 C840 1060 880 1090 960 1120", 10, 6, 0, LIME, 1.4)}</g>`;
  return s + `</g>`;
}

function panelWaves(t, oy) {
  const ink = t.ink;
  let s = `<g transform="translate(0 ${oy})">`;
  // círculos grandes nos cantos
  s += `<circle cx="1470" cy="50" r="310" fill="${LIME}" opacity="${t.limeFill}"/>`;
  s += `<circle cx="230" cy="1010" r="300" fill="${ink}" opacity="${t.inkFill}"/>`;
  s += `<path d="M0 0 H520 C470 120 430 190 300 210 C170 230 120 330 90 420 C60 480 30 500 0 510 Z" fill="${ink}" opacity="${t.inkFill}"/>`;
  s += `<path d="M1600 560 C1520 560 1480 640 1470 740 C1455 880 1380 900 1250 920 C1150 935 1100 1020 1060 1100 H1600 Z" fill="${ink}" opacity="${t.inkFill}"/>`;
  // feixes ondulados (canto superior esquerdo e inferior direito)
  s += `<g opacity="${t.limeLine}">${bundle("M-20 420 C80 380 120 300 140 230 C165 150 250 130 360 160 C470 190 520 120 560 0", 14, 0, 11, LIME)}</g>`;
  s += `<g opacity="${t.inkLine}">${bundle("M1080 1120 C1140 1000 1240 1010 1330 990 C1440 965 1480 880 1510 790 C1540 700 1600 660 1660 650", 14, 0, 11, ink)}</g>`;
  // fileiras de "×"
  let xs = "";
  for (let i = 0; i < 5; i++) xs += xMark(1020 + i * 50, 150, 26, ink, 7) + xMark(310 + i * 50, 800, 26, ink, 7);
  s += `<g opacity="${t.inkLine * 1.8}">${xs}</g>`;
  return s + `</g>`;
}

mkdirSync("public/bg", { recursive: true });
for (const [name, t] of Object.entries(THEMES)) {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H * 3}" viewBox="0 0 ${W} ${H * 3}" preserveAspectRatio="xMidYMin slice">` +
    panelGeometric(t, 0) +
    panelBlobs(t, H) +
    panelWaves(t, H * 2) +
    `</svg>`;
  writeFileSync(`public/bg/pattern-${name}.svg`, svg);
  console.log(`public/bg/pattern-${name}.svg`, (svg.length / 1024).toFixed(1), "KB");
}
