"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function CertificateLookup({ initial = "" }: { initial?: string }) {
  const router = useRouter();
  const [code, setCode] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const c = code.trim().toUpperCase().replace(/\s+/g, "");
        if (!/^[A-Z]{2,6}-\d{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(c)) {
          setError("Formato esperado: EBA-2026-XXXX-XXXX");
          return;
        }
        setError(null);
        router.push(`/certificate/${c}`);
      }}
      className="flex flex-col gap-2 sm:flex-row"
    >
      <div className="flex-1">
        <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="EBA-2026-XXXX-XXXX" className="h-11 font-mono uppercase tracking-wider sm:h-11" aria-label="Código do certificado" aria-invalid={!!error} />
        {error && <p className="mt-1 text-caption text-danger" role="alert">{error}</p>}
      </div>
      <Button type="submit" size="lg"><Search /> Validar</Button>
    </form>
  );
}
