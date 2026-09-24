// Gera o fundo decorativo das páginas (public/bg/pattern-{light,dark}.svg).
// Composição vertical única (1111×2000) que se repete na vertical: círculos cheios,
// contornos, ondas em "U", "×", arcos concêntricos na borda, anel pontilhado e esfera.
// Cores: preto + verde-limão #C7E600. Uso: node scripts/gen-backdrop.mjs
import { mkdirSync, writeFileSync } from "node:fs";

const W = 1111;
const H = 2000;
const LIME = "#C7E600";

const THEMES = {
  // tema claro: preto suave nas esferas, limão marcado nas linhas
  light: { ink: "#0b0d0c", inkFill: 0.08, inkLine: 0.24, limeFill: 0.3, limeLine: 0.8 },
  // tema escuro: preto aprofunda as esferas, limão mais contido
  dark: { ink: "#000000", inkFill: 0.5, inkLine: 0.55, limeFill: 0.1, limeLine: 0.3 },
};

const f = (n) => Number(n.toFixed(1));

/** Esfera com degradê (claro no alto à esquerda → cor cheia embaixo à direita). */
function sphere(id, cx, cy, r, color, opacity) {
  return (
    `<defs><linearGradient id="${id}" x1="0.15" y1="0.1" x2="0.85" y2="0.95">` +
    `<stop offset="0" stop-color="${color}" stop-opacity="0.15"/><stop offset="1" stop-color="${color}" stop-opacity="1"/>` +
    `</linearGradient></defs><circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#${id})" opacity="${opacity}"/>`
  );
}

/** Onda em "U" (meandro): n voltas de largura w, altura h. */
function meander(x, y, n, w, h, stroke, sw, opacity) {
  const r = w / 2;
  let d = `M${x} ${y}`;
  for (let i = 0; i < n; i++) {
    const up = i % 2 === 0;
    d += up ? ` v${-h} a${r} ${r} 0 0 1 ${w} 0` : ` v${h} a${r} ${r} 0 0 0 ${w} 0`;
  }
  d += n % 2 === 0 ? "" : ` v${h}`;
  return `<path d="${d}" fill="none" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" opacity="${opacity}"/>`;
}

function xMark(cx, cy, s, stroke, w, opacity) {
  const h = s / 2;
  return `<path d="M${cx - h} ${cy - h} L${cx + h} ${cy + h} M${cx + h} ${cy - h} L${cx - h} ${cy + h}" stroke="${stroke}" stroke-width="${w}" stroke-linecap="round" opacity="${opacity}"/>`;
}

function tile(t, name) {
  const ink = t.ink;
  let s = "";
  // esferas grandes (preto) e contornos (limão)
  s += sphere(`${name}-a`, 330, 260, 380, ink, t.inkFill);
  s += `<circle cx="-20" cy="670" r="172" fill="none" stroke="${LIME}" stroke-width="5" opacity="${t.limeLine}"/>`;
  s += sphere(`${name}-b`, 1110, 100, 180, LIME, t.limeFill * 1.6);
  s += `<circle cx="960" cy="230" r="104" fill="none" stroke="${ink}" stroke-width="3" opacity="${t.inkLine}"/>`;
  // ondas em "U" e "×"
  s += meander(262, 145, 5, 30, 50, LIME, 9, t.limeLine);
  s += xMark(746, 172, 52, ink, 10, t.inkLine * 1.4);
  s += xMark(1010, 1092, 32, ink, 6, t.inkLine * 1.4);
  s += xMark(168, 1355, 22, LIME, 5, t.limeLine);
  // arcos concêntricos na borda direita: metade de cima fina, de baixo grossa
  let arcs = "";
  for (let i = 0; i < 8; i++) {
    const r = 155 - i * 16;
    arcs += `<path d="M${1111 - r} 1450 A ${r} ${r} 0 0 1 1111 ${1450 - r}" stroke-width="3"/>`;
    arcs += `<path d="M${1111 - r} 1450 A ${r} ${r} 0 0 0 1111 ${1450 + r}" stroke-width="9"/>`;
  }
  s += `<g fill="none" stroke="${ink}" opacity="${t.inkLine}">${arcs}</g>`;
  // esfera inferior esquerda (limão) + anel pontilhado (preto)
  s += sphere(`${name}-c`, 100, 1860, 250, LIME, t.limeFill * 1.6);
  let dots = "";
  for (let ring = 0; ring < 5; ring++) {
    const r = 108 + ring * 15;
    const n = 34 + ring * 6;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      dots += `<circle cx="${f(268 + Math.cos(a) * r)}" cy="${f(1690 + Math.sin(a) * r)}" r="3.8"/>`;
    }
  }
  s += `<g fill="${ink}" opacity="${t.inkLine}">${dots}</g>`;
  // esfera pequena e onda inferior
  s += sphere(`${name}-d`, 800, 1665, 64, ink, t.inkFill * 2);
  s += meander(830, 1880, 5, 30, 50, ink, 9, t.inkLine * 1.2);
  return s;
}

mkdirSync("public/bg", { recursive: true });
for (const [name, t] of Object.entries(THEMES)) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${tile(t, name)}</svg>`;
  writeFileSync(`public/bg/pattern-${name}.svg`, svg);
  console.log(`public/bg/pattern-${name}.svg`, (svg.length / 1024).toFixed(1), "KB");
}
