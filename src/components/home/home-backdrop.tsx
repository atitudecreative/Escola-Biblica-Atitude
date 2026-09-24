/**
 * Fundo decorativo da página inicial: formas geométricas (círculos cheios, contornos,
 * arcos concêntricos, ondas, "×" e anel pontilhado) em preto e verde da marca.
 * Cobre o topo da Home (atrás do banner e da primeira seção) e some em degradê embaixo;
 * opacidade baixa para não competir com o texto. Puramente decorativo (aria-hidden, sem eventos).
 */
export function HomeBackdrop() {
  // Pontos do anel pontilhado (4 voltas), calculados uma vez.
  const dots: { x: number; y: number }[] = [];
  for (let ring = 0; ring < 4; ring++) {
    const r = 92 + ring * 18;
    const n = 30 + ring * 6;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      dots.push({ x: 1330 + Math.cos(a) * r, y: 800 + Math.sin(a) * r });
    }
  }
  const zigzag = (x: number, y: number) =>
    `M${x} ${y} c0 -14 22 -14 22 0 s-22 14 -22 28 s22 14 22 28 s-22 14 -22 28 s22 14 22 28`;

  return (
    <div aria-hidden className="home-backdrop pointer-events-none absolute inset-x-0 top-0 -z-10 h-[1100px] overflow-hidden">
      <svg className="size-full" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id="bd-green" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="var(--brand)" stopOpacity="0" />
            <stop offset="1" stopColor="var(--brand)" stopOpacity="1" />
          </linearGradient>
          <linearGradient id="bd-ink" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="var(--bd-ink)" stopOpacity="0" />
            <stop offset="1" stopColor="var(--bd-ink)" stopOpacity="1" />
          </linearGradient>
        </defs>

        {/* círculo cheio (canto superior esquerdo) + contorno sobreposto */}
        <circle cx="90" cy="30" r="190" fill="url(#bd-ink)" className="bd-ink-fill" />
        <circle cx="190" cy="190" r="86" fill="none" stroke="var(--brand)" strokeWidth="2.5" className="bd-green-line" />

        {/* arcos concêntricos (topo à direita): metade fina, metade grossa */}
        <g fill="none" stroke="var(--brand)" className="bd-green-line">
          {Array.from({ length: 8 }).map((_, i) => {
            const r = 150 + i * 14;
            return (
              <g key={i}>
                <path d={`M${1160 - r} 0 A ${r} ${r} 0 0 0 1160 ${r}`} strokeWidth="2" />
                <path d={`M1160 ${r} A ${r} ${r} 0 0 0 ${1160 + r} 0`} strokeWidth="7" />
              </g>
            );
          })}
        </g>

        {/* esfera pequena */}
        <circle cx="1330" cy="330" r="52" fill="url(#bd-ink)" className="bd-ink-fill" />

        {/* ondas */}
        <path d={zigzag(1478, 190)} fill="none" stroke="var(--brand)" strokeWidth="9" strokeLinecap="round" className="bd-green-line" />
        <path d={zigzag(110, 650)} fill="none" stroke="var(--bd-ink)" strokeWidth="9" strokeLinecap="round" className="bd-ink-line" />

        {/* "×" */}
        <g stroke="var(--bd-ink)" strokeWidth="6" strokeLinecap="round" className="bd-ink-line">
          <path d="M122 350 l40 40 M162 350 l-40 40" />
          <path d="M880 140 l24 24 M904 140 l-24 24" />
          <path d="M1100 840 l18 18 M1118 840 l-18 18" />
        </g>
        <g stroke="var(--brand)" strokeWidth="5" strokeLinecap="round" className="bd-green-line">
          <path d="M620 520 l16 16 M636 520 l-16 16" />
        </g>

        {/* grande círculo cheio (inferior esquerdo) + arco de contorno */}
        <circle cx="210" cy="870" r="400" fill="url(#bd-green)" className="bd-green-fill" />
        <path d="M360 1000 A 190 190 0 0 1 740 1000" fill="none" stroke="var(--bd-ink)" strokeWidth="5" className="bd-ink-line" />

        {/* anel pontilhado + círculo (inferior direito) */}
        <g fill="var(--brand)" className="bd-green-line">
          {dots.map((d, i) => (
            <circle key={i} cx={d.x.toFixed(1)} cy={d.y.toFixed(1)} r="4.5" />
          ))}
        </g>
        <circle cx="1520" cy="1000" r="300" fill="url(#bd-ink)" className="bd-ink-fill" />
      </svg>
    </div>
  );
}
