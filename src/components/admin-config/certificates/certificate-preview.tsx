import { cn } from "@/lib/utils";

export type TemplateDraft = { heading: string; body: string; signatureName: string; signatureRole: string; accentColor: string };

export const SAMPLE = { aluno: "Maria Aparecida Souza", curso: "Panorama do Antigo Testamento", carga: "20", data: "", professor: "Pr. João Almeida" };

export function fillSample(body: string) {
  const data = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "short", year: "numeric" }).format(new Date());
  return body.replace(/\{\{\s*(aluno|curso|carga|data|professor)\s*\}\}/g, (_, k: keyof typeof SAMPLE) => (k === "data" ? data : SAMPLE[k]));
}

/** Pré-visualização em HTML que reproduz o layout do PDF (A4 paisagem). */
export function CertificatePreview({ t, platformName, className }: { t: TemplateDraft; platformName: string; className?: string }) {
  const color = /^#[0-9a-fA-F]{6}$/.test(t.accentColor) ? t.accentColor : "#1F5B4B";
  return (
    <div className={cn("@container relative aspect-[842/595] w-full overflow-hidden rounded-md bg-[#fbfaf6] text-[#1c1a17] shadow-sm ring-1 ring-black/5", className)}>
      <div className="absolute inset-[2.8%] border" style={{ borderColor: color }} />
      <div className="absolute inset-x-[2.8%] top-[4%] h-[1.4%]" style={{ background: color }} />
      <div className="absolute inset-0 flex flex-col items-center px-[12%] pt-[11%] text-center">
        <p className="text-[1.3cqw] font-bold tracking-[0.12em] uppercase" style={{ color }}>{platformName}</p>
        <p className="mt-[3%] font-serif text-[4.6cqw] leading-none">{t.heading || "Certificado de Conclusão"}</p>
        <p className="mt-[3.2%] text-[1.45cqw] text-[#66635c]">Certificamos que</p>
        <p className="mt-[2.4%] font-serif text-[4cqw] leading-none italic">{SAMPLE.aluno}</p>
        <div className="mt-[1.6%] h-px w-[42%]" style={{ background: color }} />
        <p className="mt-[3.4%] max-w-[70cqw] text-[1.6cqw] leading-[1.5]">{fillSample(t.body)}</p>
      </div>
      <div className="absolute inset-x-[15%] bottom-[18%] flex justify-between text-center">
        {[{ n: SAMPLE.professor, r: "Professor(a) responsável" }, { n: t.signatureName || platformName, r: t.signatureRole || "Direção" }].map((s, i) => (
          <div key={i} className="w-[30%]">
            <div className="mb-[4%] h-px bg-[#66635c]" />
            <p className="text-[1.3cqw] font-bold">{s.n}</p>
            <p className="text-[1.05cqw] text-[#66635c]">{s.r}</p>
          </div>
        ))}
      </div>
      <p className="absolute bottom-[8%] left-[7%] text-[1.05cqw] font-bold" style={{ color }}>Código: EBA-0000-EXEM-PLO0</p>
      <div className="absolute right-[8%] bottom-[10%] size-[10%] bg-[repeating-linear-gradient(45deg,#1b1a17_0_2px,transparent_2px_5px)] opacity-70" aria-hidden />
    </div>
  );
}
