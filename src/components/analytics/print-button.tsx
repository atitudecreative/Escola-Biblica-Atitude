"use client";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Impressão nativa do navegador — "Salvar como PDF" está no diálogo de impressão. */
export function PrintButton({ label = "Imprimir / PDF" }: { label?: string }) {
  return (
    <Button variant="outline" onClick={() => window.print()} title="Abre a impressão do navegador; escolha “Salvar como PDF” para gerar o arquivo">
      <Printer /> {label}
    </Button>
  );
}

/**
 * CSS de impressão da área de relatórios: esconde a navegação do app,
 * expande o conteúdo e evita quebrar linhas de tabela entre páginas.
 */
export function PrintStyles() {
  return (
    <style>{`
@media print {
  @page { size: A4 landscape; margin: 12mm; }
  html, body { background: #fff !important; color: #000 !important; }
  aside, header.sticky, nav[aria-label="Navegação principal"], .print\\:hidden, [data-sonner-toaster] { display: none !important; }
  body > div, main#conteudo { display: block !important; max-width: none !important; padding: 0 !important; margin: 0 !important; }
  .lg\\:grid { display: block !important; }
  section, table { box-shadow: none !important; }
  tr, li { break-inside: avoid; }
  thead { display: table-header-group; }
  a { color: inherit !important; text-decoration: none !important; }
  .print-only { display: block !important; }
}
.print-only { display: none; }
`}</style>
  );
}
